import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { POST as juryPost } from "../app/api/jury/route";
import { POST as livePost } from "../app/api/live/route";
import { POST as contactPost } from "../app/api/live/[publicId]/route";
import { POST as projectPost } from "../app/api/project/route";
import { POST as discoverPost } from "../app/api/discover/route";
import { POST as generatePost } from "../app/api/generate/route";
import { POST as interviewPost } from "../app/api/interview/route";
import { getContext, getLiveDocument, hydrateContext, updateContext } from "../lib/context-store";
const claude = (value: unknown) => Response.json({ model: "test-claude-model", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(value) }] });
const savedEnv = { ...process.env }; const originalFetch = globalThis.fetch;
let directory: string;
const request = (url: string, body: unknown, signal?: AbortSignal) => new Request(`http://localhost${url}`, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "QuorumIntegrationTest" }, body: JSON.stringify(body), signal });
const rawReview = { steelman: "Addresses a stated workflow issue.", objection: "Switching effort needs testing.", evidence_needed: "Observe one real migration.", reasoning_trace: ["The offer describes a use.", "The migration cost is still unknown."], scores: { willingness_to_try: 4, price_resistance: null, trust: 2 }, risk_category: "switching", recommendation: "test", next_step: "Observe a customer workflow.", assumptions: ["A customer can be recruited."] };
const providerResponse = () => claude(rawReview);
before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "quorum-workflow-test-"));
  for (const key of Object.keys(process.env)) if (/^(AI_|GEMINI_|GROQ_|ANTHROPIC_|KV_|VERCEL)/.test(key)) delete process.env[key];
  process.env.QUORUM_DATA_DIR = directory; process.env.AI_PROVIDER = "groq"; process.env.ANTHROPIC_API_KEY = "test-only"; process.env.GROQ_MODEL = "unit-test-model"; process.env.AI_MAX_RETRIES = "0";
});
after(async () => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
  assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
  for (const file of await fs.readdir(directory)) await fs.unlink(path.join(directory, file)); await fs.rmdir(directory);
});
async function project() {
  const context = await hydrateContext({ sessionId: crypto.randomUUID(), accessToken: crypto.randomUUID(), idea: "Test-only clinic idea" });
  return updateContext(context.sessionId, { artifact: { title: "Test offer", headline: "Test clinic offer", html: "<html><body>Test only</body></html>", keyClaims: ["Unverified proposal"] }, hypotheses: [{ id: crypto.randomUUID(), claim: "Customers request an interview", createdAt: new Date().toISOString() }] });
}
test("a partial streamed jury saves successes and failures; targeted retry keeps the successful reviewer", async () => {
  const context = await project();
  let failed = true, calls = 0;
  globalThis.fetch = async (_url, options) => { calls++; const body = JSON.parse(String(options?.body)); return failed && JSON.stringify(body.system).includes("Your role is skeptic.") ? Response.json({ error: { message: "SECRET PROVIDER BODY" } }, { status: 401 }) : providerResponse(); };
  const response = await juryPost(request("/api/jury", { context, personas: ["analyst", "skeptic"] }));
  const stream = await response.text(); assert.match(stream, /event: persona\n/); assert.match(stream, /event: persona-error/); assert.match(stream, /partially_completed/); assert.doesNotMatch(stream, /SECRET/);
  let stored = (await getContext(context.sessionId))!;
  assert.equal(stored.jury?.length, 1); assert.equal(stored.failures?.length, 1); assert.equal(stored.scorecard?.completedCount, 1);
  const firstAttribution = stored.jury![0].attribution;
  const firstVersion = stored.resultHistory?.find(r => r.kind === "review"); assert.ok(firstVersion);
  assert.equal(stored.jury![0].groundingRunId, firstVersion.groundingRunId);
  failed = false;
  await (await juryPost(request("/api/jury", { context: stored, personas: ["skeptic"] }))).text();
  stored = (await getContext(context.sessionId))!;
  assert.equal(calls, 3); assert.equal(stored.jury?.length, 2); assert.equal(stored.failures?.length, 0); assert.deepEqual(stored.jury![0].attribution, firstAttribution);
  assert.ok(stored.resultHistory?.some(r => r.id === firstVersion.id)); assert.equal(stored.resultHistory?.filter(r => r.kind === "review").length, 2);
  assert.ok(stored.resultHistory?.some(r => r.kind === "panel" && r.scorecard.completedCount === 2));
});
test("all provider failures are durable and never become reviews or scores", async () => {
  const context = await project(); globalThis.fetch = async () => Response.json({}, { status: 503 });
  const stream = await (await juryPost(request("/api/jury", { context, personas: ["analyst", "skeptic"] }))).text();
  assert.match(stream, /"status":"failed"/);
  const stored = (await getContext(context.sessionId))!; assert.equal(stored.jury?.length ?? 0, 0); assert.equal(stored.failures?.length, 2); assert.equal(stored.scorecard?.rows[0].average, null);
  assert.equal(stored.resultHistory?.filter(r => r.kind === "review").length ?? 0, 0);
});
test("cancellation preserves a durably completed reviewer", async () => {
  const context = await project(); const abort = new AbortController();
  globalThis.fetch = async (_url, options) => { const body = JSON.parse(String(options?.body)); if (JSON.stringify(body.system).includes("Your role is analyst.")) return providerResponse(); return new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new TypeError("aborted")), { once: true })); };
  const response = await juryPost(request("/api/jury", { context, personas: ["analyst", "skeptic"] }, abort.signal));
  for (let i = 0; i < 40; i++) { if ((await getContext(context.sessionId))?.jury?.length) break; await new Promise(r => setTimeout(r, 10)); }
  abort.abort(); await response.text();
  assert.equal((await getContext(context.sessionId))?.jury?.[0].persona, "analyst");
});
test("public experiment publication, consent capture, ledger handoff and closure use real stored records", async () => {
  const context = await project(); const publicationKey = crypto.randomUUID();
  const response = await livePost(request("/api/live", { context, operation: "publish", publicationKey, hypothesisId: context.hypotheses![0].id, title: "TEST ONLY", objective: "interview", disclosure: "Test owner: research follow-up only.", confirmPublic: true }));
  assert.equal(response.status, 200); const published = await response.json(); let stored = published.context; const publicId = published.publicId;
  const params = { params: Promise.resolve({ publicId }) };
  const visit = await contactPost(request(`/api/live/${publicId}`, { operation: "visit", measurementConsent: true, visitorId: crypto.randomUUID(), source: "integration" }), params);
  const visitId = (await visit.json()).visitId;
  assert.equal((await contactPost(request(`/api/live/${publicId}`, { operation: "contact", email: "test@example.org", consent: true, startedAt: Date.now() - 5000, visitId }), params)).status, 200);
  assert.equal((await getLiveDocument(publicId))?.leads.length, 1);
  const ledger = await livePost(request("/api/live", { context: stored, operation: "evidence", publicId }));
  stored = (await ledger.json()).context; assert.equal(stored.evidence[0].provenance, "public_experiment"); assert.equal(stored.evidence[0].kind, "observed_behavior");
  await livePost(request("/api/live", { context: stored, operation: "close", publicId }));
  assert.equal((await contactPost(request(`/api/live/${publicId}`, { operation: "contact", email: "other@example.org", consent: true, startedAt: Date.now() - 5000 }), params)).status, 400);
});
test("project credentials and immutable experiment criteria are enforced at API boundaries", async () => {
  const context = await project();
  assert.equal((await projectPost(request("/api/project", { context: { ...context, accessToken: crypto.randomUUID() }, operation: "decision", id: crypto.randomUUID() }))).status, 400);
  const record = { id: crypto.randomUUID(), hypothesisId: context.hypotheses![0].id, name: "Test criterion", method: "Manual outreach", metric: "Signed pilot", minimumSample: 5, target: 2 };
  assert.equal((await projectPost(request("/api/project", { context, operation: "experiment", record }))).status, 200);
  assert.equal((await projectPost(request("/api/project", { context, operation: "experiment", record: { ...record, target: 1 } }))).status, 400);
});
test("new evidence retains earlier reviews while excluding them from current scoring", async () => {
  const context = await project();
  globalThis.fetch = async () => providerResponse();
  await (await juryPost(request("/api/jury", { context, personas: ["analyst"] }))).text();
  const previous = (await getContext(context.sessionId))!;
  const result = await projectPost(request("/api/project", { context, operation: "evidence", record: { id: crypto.randomUUID(), hypothesisId: context.hypotheses![0].id, kind: "customer_statement", direction: "contradicts", summary: "Internal test-only reported objection", source: "Internal test", collectedAt: new Date().toISOString(), limitations: "Synthetic automated test input" } }));
  const updated = (await result.json()).context;
  assert.equal(updated.jury.length, 1); assert.equal(updated.scorecard.completedCount, 0); assert.equal(updated.failures[0].category, "context_changed");
  assert.ok(updated.evaluationRevision > previous.evaluationRevision!);
});
test("grounded discovery selection carries sources and assumptions into real generation contracts", async () => {
  const context = await hydrateContext({ sessionId: crypto.randomUUID(), accessToken: crypto.randomUUID() });
  const quote = "Clinic managers report spending hours copying appointments from paper notes.";
  const opportunity = { title: "Test clinic scheduling", problem: "Reported re-entry work", customer: "Clinic managers", observations: [{ statement: "This source reports administrative re-entry", sourceId: "source-1", excerpt: "spending hours copying appointments" }], inference: "This may affect similar workflows", alternatives: ["Paper notes as described"], approach: "Test a clinic appointment import service", mvp: "Manual import pilot", complexity: "low", capabilities: ["CSV import"], assumptions: ["Clinic managers commit to a pilot"], firstExperiment: "Observe one workflow", limitations: "Unverified supplied source; prevalence and demand unknown", whyNow: "Small scope; incumbent alternatives may suffice" };
  let generating = false;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    assert.ok(body.messages.at(-1).content.includes("copying appointments"));
    return claude(generating ? { title: "INTERNAL TEST artifact", headline: "Test clinic workflow", keyClaims: ["Proposed import help"], html: "<html><body><h1>INTERNAL TEST ONLY</h1></body></html>" } : { opportunities: [opportunity] });
  };
  const discovered = await discoverPost(request("/api/discover", { context, mode: "supplied", constraints: { domain: "Clinic scheduling" }, sources: [{ title: "INTERNAL TEST excerpt", url: "https://example.org/test", excerpt: quote }] }));
  assert.equal(discovered.status, 200);
  const research = (await discovered.json()).context;
  const selected = await discoverPost(request("/api/discover", { context: research, operation: "select", opportunityId: "opportunity-1" }));
  const chosen = (await selected.json()).context;
  assert.equal(chosen.discovery.selectedOpportunityId, "opportunity-1"); assert.equal(chosen.hypotheses.length, 1); assert.equal(chosen.assumptions.targetAudience, "Clinic managers");
  generating = true;
  const generated = await generatePost(request("/api/generate", { context: chosen, idea: chosen.idea }));
  assert.match(await generated.text(), /event: complete/);
  const stored = (await getContext(context.sessionId))!;
  assert.equal(stored.discovery?.sources[0].excerpt, quote); assert.ok(stored.artifact); assert.equal(stored.hypotheses?.length, 1);
});
test("interview route validates quotes at the provider boundary and preserves an earlier synthesis on invalid retry", async () => {
  const context = await project(); const id = crypto.randomUUID();
  const transcript = "INTERNAL TEST NOTES: I spent three hours copying appointments last week.";
  await projectPost(request("/api/project", { context, operation: "interview", record: { id, hypothesisId: context.hypotheses![0].id, participant: "INTERNAL TEST ONLY", transcript, consent: true, collectedAt: new Date().toISOString() } }));
  let invalid = false;
  globalThis.fetch = async () => claude({ findings: [{ quote: invalid ? "I would pay a thousand dollars" : "three hours copying appointments", interpretation: "A reported cost; buying intent remains untested." }] });
  assert.equal((await interviewPost(request("/api/interview", { context, id }))).status, 200);
  invalid = true;
  assert.equal((await interviewPost(request("/api/interview", { context, id }))).status, 502);
  assert.equal((await getContext(context.sessionId))?.interviews?.[0].findings?.[0].quote, "three hours copying appointments");
});
