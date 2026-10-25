import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import type { SessionContext } from "@/lib/types";
import { evaluateEvidence, idField, textField } from "@/lib/evidence";
import { calculateScorecard } from "@/lib/scorecard";

const TTL = 14 * 24 * 60 * 60;
const directory = () => path.resolve(/* turbopackIgnore: true */ process.env.QUORUM_DATA_DIR || path.join(process.cwd(), ".quorum-data"));
const globalStore = globalThis as typeof globalThis & { quorumWriteQueues?: Map<string, Promise<unknown>> };
const queues = globalStore.quorumWriteQueues ??= new Map<string, Promise<unknown>>();
let lastLocalPrune = 0;
async function pruneLocalExpired() {
  if (Date.now() - lastLocalPrune < 3600000) return;
  lastLocalPrune = Date.now();
  for (const filename of await fs.readdir(directory())) {
    if (!/^(?:share-|live-)?[a-zA-Z0-9-]{16,100}\.json$/.test(filename)) continue;
    const target = path.join(directory(), filename);
    try {
      const record = JSON.parse(await fs.readFile(target, "utf8")) as { updatedAt?: string; createdAt?: string; publicId?: string };
      const retainedSince = record.publicId ? record.createdAt : record.updatedAt;
      if (retainedSince && Date.now() - Date.parse(retainedSince) > TTL * 1000) await fs.rm(target, { force: true });
    } catch { /* Preserve unreadable files for an explicit recovery action. */ }
  }
}
export class StoreError extends Error {}
export function isDurableSessionStoreConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}
export function storageMode() { return isDurableSessionStoreConfigured() ? "redis" : process.env.VERCEL ? "unconfigured" : "local"; }
async function redis(command: unknown[]) {
  const response = await fetch(process.env.KV_REST_API_URL!, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command), cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new StoreError("Project storage is unavailable. Nothing was reported as saved; retry shortly.");
  const result = await response.json() as { result?: unknown; error?: string };
  if (result.error) throw new StoreError("Project storage rejected the write. Check the storage configuration.");
  return result.result;
}
function checkStore() {
  if (storageMode() === "unconfigured") throw new StoreError("Configure KV_REST_API_URL and KV_REST_API_TOKEN for persistent projects on this deployment.");
}
async function read<T extends { updatedAt?: string } = SessionContext>(key: string): Promise<T | null> {
  checkStore();
  let raw: string | null;
  if (isDurableSessionStoreConfigured()) raw = await redis(["GET", `quorum:v2:${key}`]) as string | null;
  else {
    try { raw = await fs.readFile(path.join(directory(), `${key}.json`), "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw new StoreError("Cannot read the project store."); }
  }
  if (!raw) return null;
  let context: T;
  try { context = JSON.parse(raw) as T; } catch { throw new StoreError("This stored project is unreadable. Restore a private export or start a new project."); }
  if (!context.updatedAt || Date.now() - Date.parse(context.updatedAt) > TTL * 1000) {
    await remove(key);
    return null;
  }
  return context;
}
async function write<T extends { updatedAt?: string }>(key: string, context: T) {
  checkStore();
  const serializedValue = JSON.stringify(context);
  if (Buffer.byteLength(serializedValue) > 2000000) throw new StoreError("This project has reached the 2 MB archive limit. Export it, then remove old interview notes or decision snapshots before adding more.");
  const live = context as { publicId?: string; createdAt?: string };
  const expiry = live.publicId && live.createdAt ? Math.max(1, Math.ceil((Date.parse(live.createdAt) + TTL * 1000 - Date.now()) / 1000)) : TTL;
  if (isDurableSessionStoreConfigured()) { await redis(["SET", `quorum:v2:${key}`, serializedValue, "EX", expiry]); return; }
  try {
    await fs.mkdir(directory(), { recursive: true });
    const target = path.join(directory(), `${key}.json`);
    const temp = `${target}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temp, serializedValue, { encoding: "utf8", mode: 0o600 });
    await fs.rename(temp, target);
    await pruneLocalExpired().catch(() => {});
  } catch (cause) { throw new StoreError("Project storage could not save this change. Check disk space and write permissions, then retry.", { cause }); }
}
async function remove(key: string) {
  if (isDurableSessionStoreConfigured()) await redis(["DEL", `quorum:v2:${key}`]);
  else await fs.rm(path.join(directory(), `${key}.json`), { force: true });
}
async function serialized<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(id) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    if (!isDurableSessionStoreConfigured()) return fn();
    // A bounded Redis lease also serializes updates made by separate server instances.
    const lockKey = `quorum:v2:lock:${id}`;
    const owner = crypto.randomUUID();
    const deadline = Date.now() + 5000;
    let locked = false;
    while (Date.now() < deadline) {
      locked = await redis(["SET", lockKey, owner, "NX", "PX", 30000]) === "OK";
      if (locked) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!locked) throw new StoreError("Another change is being saved. Wait briefly and retry.");
    try { return await fn(); }
    finally {
      // Only the current lease owner may release it; failed release expires automatically.
      await redis(["EVAL", "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, lockKey, owner]).catch(() => {});
    }
  });
  queues.set(id, next);
  try { return await next; } finally { if (queues.get(id) === next) queues.delete(id); }
}
export function authorizeContext(context: SessionContext, token: unknown) {
  if (typeof token !== "string" || !context.accessToken || Buffer.byteLength(token) !== Buffer.byteLength(context.accessToken) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(context.accessToken))) throw new StoreError("This project's private access key is missing or invalid. Reopen it in the browser where it was created.");
}
export async function getContext(sessionId: string) {
  idField(sessionId);
  return read(sessionId);
}
/** Client snapshots can identify a project; they cannot replace server-owned results. */
export async function hydrateContext(snapshot?: SessionContext): Promise<SessionContext> {
  const id = idField(snapshot?.sessionId);
  return serialized(id, async () => {
    const current = await getContext(id);
    if (current) { authorizeContext(current, snapshot?.accessToken); return current; }
    const accessToken = idField(snapshot?.accessToken);
    const assumptions: Record<string, string> = {};
    for (const key of ["targetAudience", "price", "problem", "currentAlternative"] as const) {
      if (snapshot?.assumptions?.[key]) assumptions[key] = textField(snapshot.assumptions[key], key, 1000);
    }
    const now = new Date().toISOString();
    const next: SessionContext = { sessionId: id, accessToken, createdAt: now, updatedAt: now, assumptions, idea: snapshot?.idea ? textField(snapshot.idea, "Idea", 6000) : undefined };
    await write(id, next);
    return next;
  });
}
export async function updateContext(sessionId: string, patch: Partial<SessionContext> | ((current: SessionContext) => Partial<SessionContext>)) {
  idField(sessionId);
  return serialized(sessionId, async () => {
    const current = await getContext(sessionId);
    if (!current) throw new StoreError("This project has expired. Start a new project.");
    const changes = typeof patch === "function" ? patch(current) : patch;
    const next = { ...current, ...changes, sessionId, accessToken: current.accessToken, updatedAt: new Date().toISOString() };
    const affectsEvaluation = ["artifact", "idea", "assumptions", "customReviewers", "evidence", "hypotheses", "discovery", "knowledgeDocuments", "disabledKnowledgeIds", "interviews", "experiments", "decisionHistory"].some(key => Object.prototype.hasOwnProperty.call(changes, key));
    if (affectsEvaluation) {
      // Removed private source text must not survive in a retained retrieval trace.
      if (!Object.prototype.hasOwnProperty.call(changes, "groundingRuns")) next.groundingRuns = [];
      next.evaluationRevision = (current.evaluationRevision ?? 0) + 1;
      next.confidenceGate = undefined;
      if (next.jury?.length) {
        next.failures = (next.personas ?? []).map(persona => ({ persona, error: "Project context changed. The retained review is from an earlier context; retry it to use the current evidence.", category: "context_changed", retryable: true }));
        next.scorecard = calculateScorecard([], next.personas);
      }
      if (next.marketingRuns) next.marketingRuns = Object.fromEntries(Object.entries(next.marketingRuns).map(([id, run]) => {
        const panel = run.personas ?? next.personas ?? [];
        return [id, { ...run, scorecard: calculateScorecard([], panel), failures: panel.map(persona => ({ persona, error: "Project context changed. Retry this marketing review with current evidence.", category: "context_changed", retryable: true })) }];
      }));
    }
    await write(sessionId, next);
    return next;
  });
}
export async function deleteContext(sessionId: string, token: unknown) {
  return serialized(idField(sessionId), async () => {
    const current = await getContext(sessionId);
    if (!current) return;
    authorizeContext(current, token);
    if (current.shareId) await remove(`share-${idField(current.shareId)}`);
    for (const live of current.liveExperiments ?? []) {
      const key = `live-${idField(live.publicId)}`;
      await serialized(key, async () => {
        const document = await getLiveDocument(live.publicId);
        if (document?.projectId === sessionId) await remove(key);
      });
    }
    await remove(sessionId);
  });
}
export async function createShare(context: SessionContext) {
  return serialized(idField(context.sessionId), async () => {
    const current = await getContext(context.sessionId);
    if (!current) throw new StoreError("This project has expired.");
    authorizeContext(current, context.accessToken);
    const shareId = current.shareId ?? crypto.randomUUID();
    // Explicit snapshot: never publish the project key, interviews, private evidence or raw sources.
    const shared: SessionContext = { sessionId: shareId, updatedAt: new Date().toISOString(), idea: current.idea, artifact: current.artifact, personas: current.personas, jury: current.jury, scorecard: current.scorecard, confidenceGate: current.confidenceGate, evidenceDecision: { ...evaluateEvidence(current), evidenceIds: [] } };
    await write(current.sessionId, { ...current, shareId, updatedAt: new Date().toISOString() });
    await write(`share-${shareId}`, shared);
    return shareId;
  });
}
export async function getSharedContext(shareId: string) { return read(`share-${idField(shareId)}`); }
export async function revokeShare(context: SessionContext) {
  return serialized(idField(context.sessionId), async () => {
    const current = await getContext(context.sessionId);
    if (!current) throw new StoreError("This project has expired.");
    authorizeContext(current, context.accessToken);
    if (current.shareId) await remove(`share-${idField(current.shareId)}`);
    const next = { ...current, shareId: undefined, updatedAt: new Date().toISOString() };
    await write(current.sessionId, next);
    return next;
  });
}

export async function getLiveDocument(publicId: string) {
  const key = `live-${idField(publicId)}`;
  const document = await read<import("./live-types").LiveDocument>(key);
  if (document && Date.now() - Date.parse(document.createdAt) > TTL * 1000) { await remove(key); return null; }
  return document;
}
export async function updateLiveDocument(publicId: string, operation: (current: import("./live-types").LiveDocument | null) => import("./live-types").LiveDocument) {
  const key = `live-${idField(publicId)}`;
  return serialized(key, async () => {
    const next = operation(await getLiveDocument(publicId));
    next.updatedAt = new Date().toISOString();
    await write(key, next);
    return next;
  });
}
