import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { clearGroqModelCache, discoverGroqModel, selectGroqTextModel } from "../lib/agents/groq-models";
import { probeProviderJson as askJson } from "../lib/agents/providers";
const realFetch = globalThis.fetch, environment = { ...process.env };
beforeEach(() => { clearGroqModelCache(); for (const k of Object.keys(process.env)) if (/^(AI_|GROQ_)/.test(k)) delete process.env[k]; process.env.AI_PROVIDER = "groq"; process.env.GROQ_API_KEY = "discovery-test-key"; process.env.AI_MAX_RETRIES = "0"; });
afterEach(() => { globalThis.fetch = realFetch; for (const k of Object.keys(process.env)) if (/^(AI_|GROQ_)/.test(k)) delete process.env[k]; Object.assign(process.env, environment); });
const catalog = { data: [{ id: "test-audio-whisper" }, { id: "test-guard-model" }, { id: "available-chat", context_window: 32768, max_completion_tokens: 8192 }] };
test("automatic Groq choice comes from the live catalog, excluding non-chat and inactive entries", () => {
  assert.equal(selectGroqTextModel(catalog), "available-chat");
  assert.throws(() => selectGroqTextModel({ data: [{ id: "inactive-chat", active: false }, { id: "short-context", context_window: 1024 }] }));
  assert.throws(() => selectGroqTextModel({}));
});
test("normal inference needs no configured Groq model and sends the API-discovered required model", async () => {
  let catalogCalls = 0, chatCalls = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith("/models")) { catalogCalls++; return Response.json(catalog); }
    chatCalls++; assert.equal(JSON.parse(String(options?.body)).model, "available-chat");
    return Response.json({ model: "available-chat", choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }] });
  };
  const results = await Promise.all(Array.from({ length: 6 }, () => askJson("Return JSON.", "Test")));
  assert.equal(catalogCalls, 1); assert.equal(chatCalls, 6); assert.equal(results[0].metadata.model, "available-chat");
});
test("catalog cache is isolated by credential and avoids redundant discovery", async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return Response.json(catalog); };
  const signal = new AbortController().signal;
  await discoverGroqModel("key-a", signal); await discoverGroqModel("key-a", signal); await discoverGroqModel("key-b", signal);
  assert.equal(calls, 2);
});
test("cancelling one subscriber does not cancel another project's catalog lookup", async () => {
  const first = new AbortController(), second = new AbortController();
  let release: (() => void) | undefined;
  globalThis.fetch = async (_url, options) => new Promise(resolve => { release = () => { assert.equal(options?.signal?.aborted, false); resolve(Response.json(catalog)); }; });
  const a = discoverGroqModel("shared-key", first.signal); const b = discoverGroqModel("shared-key", second.signal);
  first.abort(); await assert.rejects(a); release!(); assert.equal(await b, "available-chat");
});
test("catalog failure never becomes a fabricated completion or a guessed fixed model", async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return Response.json({}, { status: 401 }); };
  await assert.rejects(askJson("Return JSON", "Test"), /credentials/); assert.equal(calls, 1);
});
