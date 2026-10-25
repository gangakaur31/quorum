import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { probeProviderJson, normalizeProviderError, providerDiagnostics, providerSelection } from "./agents/providers";
import type { ProviderId } from "./agents/provider-types";

export type ServiceName = ProviderId | "tavily" | "redis";
export type PreflightCheck = { name: string; status: "PASS" | "FAIL" | "SKIP"; required: boolean; latencyMs: number; message: string; category?: string; httpStatus?: number };
export type PreflightReport = { checkedAt: string; passed: boolean; primaryProvider?: ProviderId; checks: PreflightCheck[] };
export type PreflightOptions = { baseUrl?: string; require?: ServiceName[]; timeoutMs?: number; onResult?: (check: PreflightCheck) => void };
const providers: ProviderId[] = ["gemini", "groq", "anthropic"];
const tasks = ["generate", "jury", "marketing", "confidence", "discover", "interview", "knowledge"];

/** Explicit CLI diagnostics. Every provider probe uses real inference; no project is created. */
export async function runPreflight(options: PreflightOptions = {}): Promise<PreflightReport> {
  const timeout = options.timeoutMs ?? 15000;
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 55000) throw new Error("Timeout must be between 1000 and 55000 ms.");
  const base = options.baseUrl ? new URL(options.baseUrl) : undefined;
  if (base && (!/^https?:$/.test(base.protocol) || base.username || base.password || base.search || base.hash)) throw new Error("Use an HTTP(S) app URL without credentials, query parameters or a fragment.");
  const required = new Set(options.require ?? []);
  const checks: PreflightCheck[] = [];
  const add = (check: PreflightCheck) => { checks.push(check); options.onResult?.(check); };
  async function check(name: string, mandatory: boolean, action: () => Promise<string>) {
    const started = Date.now();
    try { const message = await action(); add({ name, required: mandatory, status: "PASS", latencyMs: Date.now() - started, message }); }
    catch (error) {
      const safe = normalizeProviderError(error);
      const timeoutError = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      const networkError = error instanceof TypeError && /fetch|network/i.test(error.message);
      add({ name, required: mandatory, status: "FAIL", latencyMs: Date.now() - started, message: error instanceof ProbeError ? error.message : timeoutError ? "The service did not respond before the probe deadline." : networkError ? "The service could not be reached. Check the endpoint, network and whether the local app is running." : safe.message, category: error instanceof ProbeError ? error.category : timeoutError ? "timeout" : networkError ? "network" : safe.category, httpStatus: error instanceof ProbeError ? error.httpStatus : safe.status });
    }
  }
  function missing(name: ServiceName, mandatory: boolean, message: string) { add({ name, required: mandatory, status: mandatory ? "FAIL" : "SKIP", latencyMs: 0, category: "configuration", message }); }
  const diagnostics = providerDiagnostics();
  let primary: ProviderId | undefined;
  let primaryModel: string | undefined;
  const selections = new Map<string, { provider: ProviderId; model: string; labels: string[] }>();
  try {
    const selected = providerSelection(); primary = selected.provider; primaryModel = selected.model;
    for (const task of tasks) {
      const selection = providerSelection(task);
      required.add(selection.provider);
      const key = `${selection.provider}:${selection.model}`;
      const previous = selections.get(key);
      if (previous) previous.labels.push(task); else selections.set(key, { ...selection, labels: [task] });
    }
  } catch { add({ name: "provider-routing", required: true, status: "FAIL", latencyMs: 0, message: "Provider or per-task routing configuration is invalid.", category: "configuration" }); }
  for (const provider of providers) if (![...selections.values()].some(s => s.provider === provider)) {
    const configuredModel = process.env[`${provider.toUpperCase()}_MODEL`]?.trim();
    // Ask the normal selector for optional providers too, preserving provider-specific config.
    const model = configuredModel || (provider === "groq" ? "auto" : undefined);
    selections.set(`optional:${provider}`, { provider, model: model ?? "", labels: [] });
  }
  const jobs: Promise<void>[] = [];
  for (const selection of selections.values()) {
    const name = selection.labels.length ? `${selection.provider} (${selection.labels.join(", ")})` : selection.provider;
    if (!diagnostics.providers.find(p => p.provider === selection.provider)?.configured) { missing(selection.provider, required.has(selection.provider), "API key not configured; this provider was not contacted."); continue; }
    jobs.push(check(name, required.has(selection.provider), async () => {
      await probeProviderJson('Return only JSON: {"connected":true}.', "Confirm connectivity with the requested JSON object.", { provider: selection.provider, model: selection.model || undefined, task: "preflight", fallback: false, maxRetries: 0, timeoutMs: timeout, deadlineMs: timeout, maxTokens: 256, validate: value => { if ((value as { connected?: unknown })?.connected !== true) throw new Error("Probe response failed its contract."); return true; } });
      return "Real inference returned the expected JSON. No fallback used.";
    }));
  }
  if (!process.env.TAVILY_API_KEY?.trim()) missing("tavily", required.has("tavily"), "Search key not configured; live Discover is unavailable. Supplied excerpts remain usable.");
  else jobs.push(check("tavily", required.has("tavily"), async () => {
    const response = await fetch("https://api.tavily.com/search", { method: "POST", headers: { Authorization: `Bearer ${process.env.TAVILY_API_KEY!.trim()}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: "customer discovery interview methodology", max_results: 1, search_depth: "basic", include_answer: false, include_raw_content: false }), signal: AbortSignal.timeout(timeout) });
    if (!response.ok) throw new ProbeError("Search API rejected the readiness probe. Check credentials, quota and service status.", response.status === 401 || response.status === 403 ? "authentication" : "service", response.status);
    const data = await response.json() as { results?: unknown[] };
    if (!Array.isArray(data.results)) throw new ProbeError("Search API returned an invalid response.", "invalid_output");
    return `Search responded with ${data.results.length} result(s). This is a connectivity test, not market research.`;
  }));
  const redisUrl = process.env.KV_REST_API_URL?.trim(), redisToken = process.env.KV_REST_API_TOKEN?.trim();
  if (redisUrl && redisToken) jobs.push(check("redis", true, async () => {
    const key = `quorum:preflight:${crypto.randomUUID()}`;
    const signal = AbortSignal.timeout(timeout);
    async function command(body: unknown[]) {
      const response = await fetch(redisUrl!, { method: "POST", headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
      if (!response.ok) throw new ProbeError("Redis REST probe failed. Check the endpoint and credentials.", "storage", response.status);
      const data = await response.json() as { error?: unknown; result?: unknown };
      if (data.error) throw new ProbeError("Redis rejected a readiness command. Check read/write permissions.", "storage");
      return data.result;
    }
    let created = false;
    try {
      if (await command(["SET", key, "quorum-preflight", "EX", 60]) !== "OK") throw new ProbeError("Redis did not confirm the temporary write.", "storage");
      created = true;
      if (await command(["GET", key]) !== "quorum-preflight") throw new ProbeError("Redis did not return the temporary value.", "storage");
      await command(["DEL", key]); created = false;
      return "Temporary write/read/delete succeeded. No project records were touched.";
    } finally { if (created) await command(["DEL", key]).catch(() => {}); }
  }));
  else if (redisUrl || redisToken || process.env.VERCEL || required.has("redis")) missing("redis", true, "Configure both KV_REST_API_URL and KV_REST_API_TOKEN for the requested hosted store.");
  else {
    missing("redis", false, "Hosted Redis not configured; the demo uses local disk.");
    jobs.push(check("local-storage", true, async () => {
      const directory = path.resolve(process.env.QUORUM_DATA_DIR || path.join(process.cwd(), ".quorum-data"));
      const file = path.join(directory, `.preflight-${crypto.randomUUID()}.tmp`);
      try { await fs.mkdir(directory, { recursive: true }); await fs.writeFile(file, "quorum-preflight", { flag: "wx", mode: 0o600 }); if (await fs.readFile(file, "utf8") !== "quorum-preflight") throw new Error(); }
      catch { throw new ProbeError("Local project storage is not readable and writable. Check directory permissions and available disk space.", "storage"); }
      finally { await fs.rm(file, { force: true }).catch(() => {}); }
      return "Temporary local write/read/delete succeeded.";
    }));
  }
  if (base) {
    jobs.push(check("application", true, async () => {
      const response = await fetch(new URL("/", base), { signal: AbortSignal.timeout(timeout) });
      if (!response.ok || !(await response.text()).includes("QUORUM")) throw new ProbeError("The Quorum page did not respond correctly. Start the app and check --base-url.", "application", response.status);
      return "Application page responded.";
    }));
    jobs.push(check("/api/health", true, async () => {
      const response = await fetch(new URL("/api/health", base), { signal: AbortSignal.timeout(timeout) });
      const data = await response.json() as { ready?: boolean; selected?: { provider?: string; model?: string } };
      if (!response.ok || typeof data.ready !== "boolean") throw new ProbeError("The app health endpoint did not return its expected contract.", "application", response.status);
      if (!data.ready || data.selected?.provider !== primary || data.selected?.model !== primaryModel) throw new ProbeError("The running app's provider configuration differs or is not ready. Restart it after editing .env.local.", "configuration", response.status);
      return "Running app configuration matches this preflight. Connectivity is tested separately above.";
    }));
    for (const route of ["generate", "jury", "marketing", "confidence", "discover", "interview", "knowledge", "project", "live", "live/invalid-id"]) jobs.push(check(`/api/${route}`, true, async () => {
      const response = await fetch(new URL(`/api/${route}`, base), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(timeout) });
      if (![400, 403, 422].includes(response.status)) throw new ProbeError("Route did not reject an empty request with its expected input guard.", "application", response.status);
      return `Route responded with expected HTTP ${response.status} input rejection. No inference or project creation requested.`;
    }));
    jobs.push(check("/api/session/[id]", true, async () => {
      const response = await fetch(new URL(`/api/session/${crypto.randomUUID()}`, base), { signal: AbortSignal.timeout(timeout) });
      if (response.status !== 404) throw new ProbeError("The session route did not return its expected missing-project response.", "application", response.status);
      return "Session route responded with expected HTTP 404 for an unknown project.";
    }));
  }
  await Promise.all(jobs);
  return { checkedAt: new Date().toISOString(), primaryProvider: primary, passed: !checks.some(c => c.status === "FAIL"), checks };
}
class ProbeError extends Error { constructor(message: string, public category: string, public httpStatus?: number) { super(message); } }
