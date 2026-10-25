import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { askJson, providerDiagnostics, providerSelection, normalizeProviderError } from "../lib/agents/providers";
import { JURY_SHARED_PREFIX, jurySystemPrompt } from "../lib/prompts";
import { TASK_OUTPUT_BUDGETS } from "../lib/agents/task-policy";

const environment = { ...process.env }, realFetch = globalThis.fetch;
beforeEach(() => {
  for (const key of Object.keys(process.env)) if (/^(AI_|ANTHROPIC_|GROQ_|GEMINI_)/.test(key)) delete process.env[key];
  process.env.ANTHROPIC_API_KEY = "unit-claude-secret"; process.env.GROQ_API_KEY = "unit-groq-secret";
  process.env.GROQ_MODEL = "test-groq-model"; process.env.AI_MAX_RETRIES = "0";
});
afterEach(() => { globalThis.fetch = realFetch; for (const key of Object.keys(process.env)) if (/^(AI_|ANTHROPIC_|GROQ_|GEMINI_)/.test(key)) delete process.env[key]; Object.assign(process.env, environment); });
const claude = (value: unknown = { ok: true }, extra: Record<string, unknown> = {}) => Response.json({ model: "actual-claude-model", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(value) }], ...extra });
const groq = (value: unknown = { ok: true }) => Response.json({ model: "actual-groq-model", choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }] });
const category = (wanted: string) => (error: unknown) => { assert.equal(normalizeProviderError(error).category, wanted); return true; };

for (const task of ["generate", "jury", "marketing", "confidence", "discover", "interview", "knowledge"]) {
  test(`${task} is Claude-first despite legacy global/task/provider overrides; a valid result never calls Groq`, async () => {
    process.env.AI_PROVIDER = "groq"; process.env.AI_MODEL = "groq-only-model";
    process.env[`AI_${task.toUpperCase()}_PROVIDER`] = "gemini"; process.env[`AI_${task.toUpperCase()}_MODEL`] = "gemini-only-model";
    let calls = 0;
    globalThis.fetch = async (url, options) => { calls++; assert.match(String(url), /anthropic/); const body = JSON.parse(String(options?.body)); assert.equal(body.model, "claude-haiku-5-5"); assert.equal(body.max_tokens, TASK_OUTPUT_BUDGETS[task]); return claude(); };
    const result = await askJson("rules", "private input", { task, provider: "groq", model: "also-ignored" });
    assert.equal(providerSelection(task).provider, "anthropic"); assert.equal(result.metadata.provider, "anthropic"); assert.equal(result.metadata.fallbackUsed, false); assert.equal(calls, 1);
  });
}
test("a valid skeptical/negative result is successful and does not trigger fallback", async () => {
  let calls = 0; const negative = { recommendation: "stop", scores: { willingness_to_try: 1, price_resistance: 5, trust: 1 } };
  globalThis.fetch = async url => { calls++; assert.match(String(url), /anthropic/); return claude(negative); };
  assert.deepEqual((await askJson("rules", "idea", { validate: value => { assert.equal((value as typeof negative).recommendation, "stop"); return value; } })).data, negative); assert.equal(calls, 1);
});
test("one transient Claude retry precedes Groq and successful fallback records actual attribution", async () => {
  const calls: string[] = [], states: string[] = [];
  globalThis.fetch = async url => { calls.push(String(url)); return String(url).includes("anthropic") ? Response.json({}, { status: 503 }) : groq(); };
  const result = await askJson("rules", "idea", { maxRetries: 1, onStatus: status => states.push(status.state) });
  assert.equal(calls.filter(url => url.includes("anthropic")).length, 2); assert.equal(calls.length, 3);
  assert.deepEqual(states, ["running", "retrying", "fallback"]); assert.equal(result.metadata.provider, "groq"); assert.equal(result.metadata.model, "actual-groq-model"); assert.equal(result.metadata.fallbackReason, "provider_unavailable"); assert.equal(result.metadata.retryCount, 1); assert.equal(result.metadata.validationStatus, "passed");
});
for (const [status, reason] of [[401, "authentication"], [403, "authentication"], [402, "billing"], [404, "unsupported_model"], [413, "context_limit"]] as const) {
  test(`Claude ${reason} falls back without repeating a permanent error`, async () => {
    const calls: string[] = []; globalThis.fetch = async url => { calls.push(String(url)); return String(url).includes("anthropic") ? Response.json({ error: { message: "PRIVATE SECRET BODY" } }, { status }) : groq(); };
    const result = await askJson("rules", "idea", { maxRetries: 2 });
    assert.equal(calls.length, 2); assert.equal(result.metadata.fallbackReason, reason); assert.doesNotMatch(JSON.stringify(result), /PRIVATE SECRET BODY|unit-claude-secret/);
  });
}
test("malformed Claude JSON receives one bounded repair and usable repair prevents Groq", async () => {
  let calls = 0; globalThis.fetch = async (url, options) => { calls++; assert.match(String(url), /anthropic/); if (calls === 1) return claude({}, { content: [{ type: "text", text: "{partial" }] }); assert.match(JSON.parse(String(options?.body)).system, /previous attempt/); return claude(); };
  const result = await askJson("rules", "idea"); assert.equal(calls, 2); assert.equal(result.metadata.fallbackUsed, false); assert.equal(result.metadata.history[0].category, "invalid_output");
});
test("unusable repaired structured output restarts with Groq rather than combining partial text", async () => {
  let calls = 0; globalThis.fetch = async url => { calls++; return String(url).includes("anthropic") ? claude({}, { content: [{ type: "text", text: '{"private_partial":' }] }) : groq({ complete: true }); };
  const result = await askJson("rules", "idea"); assert.equal(calls, 3); assert.deepEqual(result.data, { complete: true }); assert.equal(result.metadata.history.filter(a => a.provider === "anthropic").length, 2);
});
test("truncation is never accepted as success and one recovery has a larger bounded budget", async () => {
  let calls = 0; globalThis.fetch = async (url, options) => { calls++; assert.match(String(url), /anthropic/); assert.equal(JSON.parse(String(options?.body)).max_tokens, calls === 1 ? 100 : 150); return claude({}, calls === 1 ? { stop_reason: "max_tokens", usage: { input_tokens: 10, output_tokens: 100 } } : {}); };
  const result = await askJson("rules", "idea", { maxTokens: 100 }); assert.equal(calls, 2); assert.equal(result.metadata.history[0].category, "truncated_output"); assert.equal(result.metadata.history[0].usage?.outputTokens, 100);
});
test("schema-invalid output gets only one recovery before fallback", async () => {
  let calls = 0; globalThis.fetch = async url => { calls++; return String(url).includes("anthropic") ? claude({ wrong: true }) : groq({ ok: true }); };
  const result = await askJson("rules", "idea", { validate: value => { if (!(value as { ok?: boolean }).ok) throw new Error("PRIVATE validator details"); return value; } });
  assert.equal(calls, 3); assert.equal(result.metadata.fallbackReason, "schema_validation"); assert.doesNotMatch(JSON.stringify(result), /PRIVATE validator/);
});
test("explicit refusal is not bypassed with another provider", async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return claude({}, { stop_reason: "refusal" }); };
  await assert.rejects(askJson("rules", "idea"), category("refusal")); assert.equal(calls, 1);
});
test("missing Claude is explicitly diagnosed; missing Groq does not prevent healthy Claude", async () => {
  delete process.env.ANTHROPIC_API_KEY; let calls = 0; globalThis.fetch = async () => { calls++; return claude(); };
  await assert.rejects(askJson("rules", "idea"), category("configuration")); assert.equal(calls, 0);
  process.env.ANTHROPIC_API_KEY = "unit-claude-secret"; delete process.env.GROQ_API_KEY;
  assert.equal((await askJson("rules", "idea")).metadata.provider, "anthropic"); assert.equal(calls, 1);
});
test("both-provider failure returns a safe actionable error, never a fabricated result", async () => {
  globalThis.fetch = async () => Response.json({ error: { message: "PRIVATE upstream body" } }, { status: 401 });
  await assert.rejects(askJson("rules", "idea"), error => { const safe = normalizeProviderError(error); assert.match(safe.message, /Claude.*Groq.*No result was accepted/); assert.doesNotMatch(JSON.stringify(safe), /PRIVATE|unit-claude-secret|unit-groq-secret/); return true; });
});
test("deadline reserves time for Groq after a timed-out Claude transport", async () => {
  const calls: string[] = []; let aborted: AbortSignal | undefined;
  globalThis.fetch = async (url, options) => { calls.push(String(url)); if (String(url).includes("anthropic")) { aborted = options?.signal ?? undefined; return new Promise<Response>(() => {}); } return groq(); };
  const result = await askJson("rules", "idea", { timeoutMs: 20, deadlineMs: 100, maxRetries: 0 });
  assert.equal(calls.length, 2); assert.equal(aborted?.aborted, true); assert.equal(result.metadata.fallbackReason, "timeout");
});
test("cancellation forbids retry, repair and fallback, even after partial body failure", async () => {
  const controller = new AbortController(); let calls = 0;
  globalThis.fetch = async () => { calls++; controller.abort(); throw new TypeError("PRIVATE disconnect"); };
  await assert.rejects(askJson("rules", "idea", { signal: controller.signal }), category("cancelled")); assert.equal(calls, 1);
});
test("stable jury caching uses only a shared system prefix; real cache usage stays measurable", async () => {
  assert.ok(JURY_SHARED_PREFIX.length >= 3072);
  globalThis.fetch = async (url, options) => { assert.match(String(url), /anthropic/); const body = JSON.parse(String(options?.body)); assert.equal(body.system[0].text, JURY_SHARED_PREFIX); assert.deepEqual(body.system[0].cache_control, { type: "ephemeral" }); assert.doesNotMatch(body.system[0].text, /PRIVATE PROJECT INPUT/); return claude({}, { usage: { input_tokens: 20, output_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 0 } }); };
  const result = await askJson(jurySystemPrompt("skeptic"), "PRIVATE PROJECT INPUT", { cachePrefix: JURY_SHARED_PREFIX });
  assert.equal(result.metadata.cacheRequested, true); assert.deepEqual(result.metadata.usage, { inputTokens: 20, outputTokens: 10, totalTokens: 130, cacheReadInputTokens: 100, cacheCreationInputTokens: 0 });
});
test("unreported usage stays unknown and diagnostics retain no private payload", async () => {
  globalThis.fetch = async () => claude(); const result = await askJson("SECRET SYSTEM", "SECRET CUSTOMER INPUT");
  assert.equal(result.metadata.usage?.inputTokens, undefined); assert.equal(result.metadata.usage?.cacheReadInputTokens, undefined);
  const diagnostic = JSON.stringify(providerDiagnostics()); assert.doesNotMatch(diagnostic, /SECRET SYSTEM|SECRET CUSTOMER INPUT|unit-claude-secret|unit-groq-secret/);
});
test("unqualified legacy task models owned by Groq are not sent to Claude", async () => {
  process.env.AI_PROVIDER = "groq"; process.env.AI_JURY_MODEL = "legacy-groq-model";
  assert.equal(providerSelection("jury").model, "claude-haiku-5-5");
  process.env.AI_JURY_PROVIDER = "anthropic"; process.env.AI_JURY_MODEL = "explicit-claude-model";
  assert.equal(providerSelection("jury").model, "explicit-claude-model");
});
test("Groq's returned cached-input measurement is captured without changing its total", async () => {
  globalThis.fetch = async url => String(url).includes("anthropic") ? Response.json({}, { status: 401 }) : Response.json({ model: "actual-groq-model", choices: [{ finish_reason: "stop", message: { content: "{}" } }], usage: { prompt_tokens: 32, completion_tokens: 4, total_tokens: 36, prompt_tokens_details: { cached_tokens: 16 } } });
  const result = await askJson("rules", "idea"); assert.equal(result.metadata.usage?.cacheReadInputTokens, 16); assert.equal(result.metadata.usage?.totalTokens, 36);
});
test("health reports a missing Claude configuration explicitly", () => {
  delete process.env.ANTHROPIC_API_KEY; const health = providerDiagnostics();
  assert.equal(health.ready, false); assert.equal(health.configurationError?.category, "configuration"); assert.equal(health.configurationError?.provider, "anthropic");
});

test("failed Groq truncation retains reported usage without accepting partial output", async () => {
  globalThis.fetch = async url => String(url).includes("anthropic") ? Response.json({}, { status: 401 }) : Response.json({ choices: [{ finish_reason: "length", message: { content: "{partial" } }], usage: { prompt_tokens: 32, completion_tokens: 16, total_tokens: 48 } });
  await assert.rejects(askJson("rules", "idea", { maxRepairs: 0 }), error => {
    assert.equal(normalizeProviderError(error).category, "truncated_output");
    assert.equal((error as { usage?: { outputTokens: number } }).usage?.outputTokens, 16); return true;
  });
});
