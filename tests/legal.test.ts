import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildLegalChecklist, ensureLegalProfile, LEGAL_GUIDE_VERSION, legalChecklistMarkdown, saveLegalProfile, saveLegalProgress } from "../lib/legal";
import { POST } from "../app/api/project/route";
import { createShare, getContext, getSharedContext, hydrateContext } from "../lib/context-store";
import type { LegalProfile } from "../lib/legal-types";
import type { SessionContext } from "../lib/types";
import { knowledgeContext } from "../lib/knowledge";
import { juryUserPrompt } from "../lib/prompts";

const profile: LegalProfile = { product: "INTERNAL TEST: appointment scheduling software", home: "india", markets: ["india"], locationDetails: "Karnataka", sector: "general", activities: [] };
const env = { ...process.env }; let directory: string;
before(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), "quorum-legal-")); process.env.QUORUM_DATA_DIR = directory; delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN; delete process.env.VERCEL; });
after(async () => { for (const filename of await fs.readdir(directory)) await fs.unlink(path.join(directory, filename)); await fs.rmdir(directory); for (const key of ["QUORUM_DATA_DIR", "KV_REST_API_URL", "KV_REST_API_TOKEN", "VERCEL"]) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; } });
const post = (context: SessionContext, body: Record<string, unknown>) => POST(new Request("http://localhost/api/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context, ...body }) }));

test("legal scope requires explicit locations, activities and bounded product details", () => {
  assert.throws(() => ensureLegalProfile({ ...profile, home: "" }));
  assert.throws(() => ensureLegalProfile({ ...profile, markets: [] }));
  assert.throws(() => ensureLegalProfile({ ...profile, markets: ["global"] }));
  assert.throws(() => ensureLegalProfile({ ...profile, markets: ["other"], locationDetails: "" }));
  assert.throws(() => ensureLegalProfile({ ...profile, activities: ["guaranteed_compliance"] }));
  assert.throws(() => ensureLegalProfile({ ...profile, product: "x".repeat(2001) }));
  assert.deepEqual(ensureLegalProfile({ ...profile, markets: ["us", "india", "us"] }).markets, ["india", "us"]);
});
test("foundation questions do not invent sensitive processing, children's use or AI", () => {
  const tasks = buildLegalChecklist(profile);
  assert.ok(tasks.some(t => t.id === "ownership")); assert.ok(tasks.some(t => t.id === "business"));
  for (const id of ["privacy", "children", "ai", "subscriptions", "sector"]) assert.ok(!tasks.some(t => t.id === id));
  assert.ok(!tasks.flatMap(t => t.references).some(r => ["eu-ai", "us-children"].includes(r.id)));
});
test("selected markets and activities add relevant questions and authority references without universalising laws", () => {
  const tasks = buildLegalChecklist({ ...profile, markets: ["india", "eu", "us"], sector: "health", activities: ["children", "sensitive_data", "ai", "subscriptions", "consumer_sales"] });
  for (const id of ["privacy", "sensitive", "children", "ai", "payments", "subscriptions", "sector", "cross-border"]) assert.ok(tasks.some(t => t.id === id), id);
  assert.ok(tasks.find(t => t.id === "children")!.references.some(r => r.id === "us-children"));
  assert.ok(tasks.find(t => t.id === "ai")!.references.some(r => r.id === "eu-ai"));
  assert.match(tasks.find(t => t.id === "sector")!.why, /does not classify or authorise/);
  const uk = buildLegalChecklist({ ...profile, home: "uk", markets: ["uk"], activities: ["tracking"] });
  assert.deepEqual(uk.find(t => t.id === "privacy")!.references.map(r => r.id), ["uk-privacy"]);
});
test("unlisted jurisdictions retain research questions and do not inherit another country's laws", () => {
  const other = ensureLegalProfile({ ...profile, home: "other", markets: ["other"], locationDetails: "Brazil", activities: ["personal_data", "ai", "children"] });
  const tasks = buildLegalChecklist(other);
  assert.deepEqual(tasks.find(t => t.id === "privacy")!.references, []);
  assert.ok(tasks.flatMap(t => t.references).every(r => r.id === "ip"));
});
test("scope changes reset earlier task progress; canonical equivalent profiles preserve it", () => {
  let preparation = saveLegalProfile(profile);
  preparation = saveLegalProgress(preparation, { scopeId: preparation.scopeId, taskId: "ownership", status: "preparing", notes: "INTERNAL PRIVATE LEGAL NOTE" });
  const identical = saveLegalProfile(profile, preparation);
  assert.equal(identical.scopeId, preparation.scopeId); assert.equal(identical.progress.ownership.status, "preparing");
  for (const changed of [{ ...profile, markets: ["us"] }, { ...profile, activities: ["ai"] }, { ...profile, sector: "health" }]) {
    const next = saveLegalProfile(changed, preparation); assert.notEqual(next.scopeId, preparation.scopeId); assert.deepEqual(next.progress, {});
  }
  const refreshed = saveLegalProfile(profile, { ...preparation, guideVersion: "old-guide" });
  assert.equal(refreshed.guideVersion, LEGAL_GUIDE_VERSION); assert.deepEqual(refreshed.progress, {});
});
test("task writes reject stale scopes, unsupported statuses, unrelated tasks and oversized notes", () => {
  const preparation = saveLegalProfile(profile);
  for (const value of [
    { scopeId: "old-scope", taskId: "ownership", status: "preparing" },
    { scopeId: preparation.scopeId, taskId: "children", status: "preparing" },
    { scopeId: preparation.scopeId, taskId: "ownership", status: "legally_approved" },
    { scopeId: preparation.scopeId, taskId: "ownership", status: "preparing", notes: "x".repeat(1501) },
  ]) assert.throws(() => saveLegalProgress(preparation, value));
  assert.throws(() => saveLegalProgress(undefined, {}));
});
test("private checklist export carries scope, preparation notes, limitations and authority links", () => {
  const preparation = saveLegalProfile({ ...profile, activities: ["personal_data"] });
  const updated = saveLegalProgress(preparation, { scopeId: preparation.scopeId, taskId: "privacy", status: "discussed", notes: "INTERNAL PRIVATE TASK NOTE" });
  const markdown = legalChecklistMarkdown(updated);
  assert.match(markdown, /not legal advice or a compliance certificate/);
  assert.match(markdown, /No live legal check was performed/);
  assert.match(markdown, /INTERNAL PRIVATE TASK NOTE/); assert.match(markdown, /https:\/\/www.meity.gov.in/);
  assert.match(markdown, /Discussed with an adviser/);
});
test("legal profiles persist through the owned API; forged derived state and other owners cannot replace them", async () => {
  const context = await hydrateContext({ sessionId: crypto.randomUUID(), accessToken: crypto.randomUUID(), idea: "INTERNAL TEST ONLY" });
  const response = await post({ ...context, legalPreparation: { profile } as never }, { operation: "legal-profile", profile });
  assert.equal(response.status, 200);
  const stored = (await getContext(context.sessionId))!;
  assert.equal(stored.legalPreparation?.profile.home, "india"); assert.ok(stored.legalPreparation?.scopeId);
  assert.equal(stored.evaluationRevision, context.evaluationRevision);
  const denied = await post({ ...context, accessToken: crypto.randomUUID() }, { operation: "legal-profile", profile: { ...profile, home: "us" } });
  assert.equal(denied.status, 400); assert.equal((await getContext(context.sessionId))!.legalPreparation!.profile.home, "india");
});
test("legal task notes are private, excluded from public briefs and removable without deleting the project", async () => {
  const context = await hydrateContext({ sessionId: crypto.randomUUID(), accessToken: crypto.randomUUID(), idea: "INTERNAL TEST ONLY" });
  await post(context, { operation: "legal-profile", profile });
  const legal = (await getContext(context.sessionId))!.legalPreparation!;
  assert.equal((await post(context, { operation: "legal-progress", record: { scopeId: legal.scopeId, taskId: "ownership", status: "preparing", notes: "INTERNAL PRIVATE LEGAL NOTE" } })).status, 200);
  const stored = (await getContext(context.sessionId))!;
  const share = await createShare(stored);
  assert.doesNotMatch(knowledgeContext(stored, "legal ownership") + juryUserPrompt(stored, undefined, "analyst"), /INTERNAL PRIVATE LEGAL NOTE/);
  const shared = await getSharedContext(share);
  assert.equal(shared?.legalPreparation, undefined); assert.doesNotMatch(JSON.stringify(shared), /PRIVATE LEGAL NOTE/);
  await post(context, { operation: "delete-legal" });
  assert.equal((await getContext(context.sessionId))!.legalPreparation, undefined); assert.equal((await getContext(context.sessionId))!.idea, context.idea);
});
test("a stale browser cannot attach earlier legal task notes after the profile changes", async () => {
  const context = await hydrateContext({ sessionId: crypto.randomUUID(), accessToken: crypto.randomUUID() });
  await post(context, { operation: "legal-profile", profile });
  const oldScope = (await getContext(context.sessionId))!.legalPreparation!.scopeId;
  const results = await Promise.all([
    post(context, { operation: "legal-profile", profile: { ...profile, markets: ["uk"] } }),
    post(context, { operation: "legal-progress", record: { scopeId: oldScope, taskId: "ownership", status: "preparing", notes: "STALE NOTE" } }),
  ]);
  assert.equal(results[0].status, 200); assert.equal(results[1].status, 400);
  assert.deepEqual((await getContext(context.sessionId))!.legalPreparation!.progress, {});
});
