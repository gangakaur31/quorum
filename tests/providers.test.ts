import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { askGeminiJson, askGroqJson, probeProviderJson as askJson, normalizeProviderError, providerDiagnostics } from "@/lib/agents/providers";
import type { ProviderId } from "@/lib/agents/provider-types";

const realFetch = globalThis.fetch;
const savedEnvironment = { ...process.env };
const providerEnvironment = /^(AI_|GEMINI_|GROQ_|ANTHROPIC_)/;

beforeEach(() => {
  for (const key of Object.keys(process.env)) if (providerEnvironment.test(key)) delete process.env[key];
  process.env.AI_PROVIDER = "groq";
  process.env.GROQ_API_KEY = "test-key-for-unit-tests";
  process.env.GROQ_MODEL = "unit-test-model";
  process.env.AI_MAX_RETRIES = "0";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const key of Object.keys(process.env)) if (providerEnvironment.test(key)) delete process.env[key];
  for (const [key, value] of Object.entries(savedEnvironment)) if (providerEnvironment.test(key) && value !== undefined) process.env[key] = value;
});

function success(provider: ProviderId, value: unknown = { ok: true }, overrides: Record<string, unknown> = {}) {
  const text = JSON.stringify(value);
  if (provider === "groq") return Response.json({
    id: "request-groq", model: "groq-returned-model",
    choices: [{ finish_reason: "stop", message: { content: text } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }, ...overrides,
  });
  if (provider === "anthropic") return Response.json({
    id: "request-claude", model: "claude-returned-model", stop_reason: "end_turn",
    content: [{ type: "thinking", thinking: "never expose this" }, { type: "text", text }],
    usage: { input_tokens: 10, output_tokens: 5 }, ...overrides,
  });
  return Response.json({
    responseId: "request-gemini", modelVersion: "gemini-returned-model",
    candidates: [{ finishReason: "STOP", content: { parts: [{ text: "hidden thought", thought: true }, { text }] } }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }, ...overrides,
  });
}

function expectCategory(category: string) {
  return (error: unknown) => {
    assert.equal(normalizeProviderError(error).category, category);
    return true;
  };
}

for (const provider of ["gemini", "groq", "anthropic"] as ProviderId[]) {
  test(`${provider} maps its own request format, response blocks and usage`, async () => {
    process.env.AI_PROVIDER = provider;
    process.env[`${provider.toUpperCase()}_API_KEY`] = "unit-test-secret";
    process.env.AI_MODEL = "chosen-model";
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      const body = JSON.parse(String(options?.body));
      const headers = new Headers(options?.headers);
      assert.equal(options?.signal instanceof AbortSignal, true);
      assert.equal(String(url).includes("unit-test-secret"), false);
      if (provider === "gemini") {
        assert.match(String(url), /models\/chosen-model:generateContent$/);
        assert.equal(headers.get("x-goog-api-key"), "unit-test-secret");
        assert.match(body.systemInstruction.parts[0].text, /system rules/);
        assert.equal(body.contents[0].parts[0].text, "user input");
        assert.equal(body.generationConfig.responseMimeType, "application/json");
      } else if (provider === "groq") {
        assert.equal(String(url), "https://api.groq.com/openai/v1/chat/completions");
        assert.equal(headers.get("authorization"), "Bearer unit-test-secret");
        assert.equal(body.model, "chosen-model");
        assert.equal(body.messages[1].content, "user input");
        assert.equal(body.response_format.type, "json_object");
        assert.equal(body.max_completion_tokens, 96);
      } else {
        assert.equal(String(url), "https://api.anthropic.com/v1/messages");
        assert.equal(headers.get("x-api-key"), "unit-test-secret");
        assert.equal(headers.get("anthropic-version"), "2023-06-01");
        assert.equal(body.model, "chosen-model");
        assert.match(body.system, /system rules/);
        assert.equal(body.messages[0].role, "user");
        assert.equal(body.max_tokens, 96);
        assert.equal("temperature" in body, false);
      }
      return success(provider);
    };
    const { data, metadata } = await askJson("system rules", "user input", { maxTokens: 96 });
    assert.deepEqual(data, { ok: true });
    assert.equal(metadata.provider, provider);
    assert.equal(metadata.model, `${provider === "anthropic" ? "claude" : provider}-returned-model`);
    assert.deepEqual(metadata.usage, { inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    assert.equal(metadata.fallbackUsed, false);
    assert.equal(calls, 1);
  });
}

test("legacy wrapper names honor explicitly configured Claude for every agent", async () => {
  process.env.AI_PROVIDER = "anthropic";
  process.env.ANTHROPIC_API_KEY = "unit-key";
  let calls = 0;
  globalThis.fetch = async (url) => { assert.match(String(url), /anthropic/); calls++; return success("anthropic"); };
  assert.deepEqual(await askGeminiJson("", ""), { ok: true });
  assert.deepEqual(await askGroqJson([{ role: "user", content: "JSON please" }]), { ok: true });
  assert.equal(calls, 2);
});

test("per-task provider/model overrides do not inherit the global provider's model", async () => {
  process.env.AI_MODEL = "global-groq-model";
  process.env.AI_JURY_PROVIDER = "anthropic";
  process.env.AI_JURY_MODEL = "task-claude-model";
  process.env.ANTHROPIC_API_KEY = "unit-key";
  globalThis.fetch = async (_, options) => {
    assert.equal(JSON.parse(String(options?.body)).model, "task-claude-model");
    return success("anthropic");
  };
  assert.equal((await askJson("", "", { task: "jury" })).metadata.provider, "anthropic");
  delete process.env.AI_JURY_MODEL;
  globalThis.fetch = async (_, options) => {
    assert.notEqual(JSON.parse(String(options?.body)).model, "global-groq-model");
    return success("anthropic");
  };
  await askJson("", "", { task: "jury" });
});

test("one configured provider is sufficient when AI_PROVIDER is unset", async () => {
  delete process.env.AI_PROVIDER;
  globalThis.fetch = async (url) => { assert.match(String(url), /groq/); return success("groq"); };
  assert.equal((await askJson("", "")).metadata.provider, "groq");
});

test("missing selected credentials fails without inference or implicit fallback", async () => {
  process.env.AI_PROVIDER = "anthropic";
  process.env.AI_FALLBACK_PROVIDERS = "groq";
  let calls = 0;
  globalThis.fetch = async () => { calls++; return success("groq"); };
  await assert.rejects(askJson("", ""), expectCategory("configuration"));
  assert.equal(calls, 0);
});

test("unknown provider and unsafe model configuration are rejected", async () => {
  process.env.AI_PROVIDER = "made-up-provider";
  await assert.rejects(askJson("", ""), expectCategory("configuration"));
  process.env.AI_PROVIDER = "groq";
  process.env.AI_MODEL = "https://attacker.example/?key=private";
  await assert.rejects(askJson("", ""), expectCategory("configuration"));
});

for (const [status, body, category] of [
  [401, { error: { message: "SECRET-KEY and private idea" } }, "authentication"],
  [429, { error: { code: "insufficient_quota" } }, "billing"],
  [402, {}, "billing"],
  [413, {}, "context_limit"],
  [404, {}, "unsupported_model"],
  [400, { error: { message: "API key not valid" } }, "authentication"],
  [400, { error: { code: "json_validate_failed", message: "Failed to generate JSON. SECRET-KEY", failed_generation: "private output" } }, "invalid_output"],
] as const) {
  test(`permanent ${category} (${status}) never retries or falls back and never leaks upstream text`, async () => {
    process.env.GEMINI_API_KEY = "unit-key";
    process.env.AI_MAX_RETRIES = "2";
    process.env.AI_FALLBACK_PROVIDERS = "gemini";
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json(body, { status }); };
    await assert.rejects(askJson("", ""), (error: unknown) => {
      const safe = normalizeProviderError(error);
      assert.equal(safe.category, category);
      assert.equal(safe.retryable, false);
      assert.equal(JSON.stringify(safe).includes("SECRET-KEY"), false);
      return true;
    });
    assert.equal(calls, 1);
  });
}

test("diagnostic transient retries remain bounded", async () => {
  let calls = 0;
  process.env.AI_MAX_RETRIES = "1";
  globalThis.fetch = async () => { calls++; return Response.json({}, { status: 503 }); };
  await assert.rejects(askJson("", "", { maxRetries: Number(process.env.AI_MAX_RETRIES) }), expectCategory("provider_unavailable"));
  assert.equal(calls, 2);
});

test("successful retry is attributed with history", async () => {
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? Response.json({}, { status: 429 }) : success("groq");
  const result = await askJson("", "", { maxRetries: 1 });
  assert.equal(result.metadata.attempts, 2);
  assert.equal(result.metadata.history[0].category, "rate_limit");
  assert.equal(result.metadata.history[1].outcome, "completed");
});

test("Retry-After beyond the deadline is not ignored or slept through", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}, { status: 429, headers: { "Retry-After": "60" } }); };
  await assert.rejects(askJson("", "", { maxRetries: 2, deadlineMs: 100 }), expectCategory("rate_limit"));
  assert.equal(calls, 1);
});

test("fallback is off by default even with another configured key", async () => {
  process.env.GEMINI_API_KEY = "unit-key";
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}, { status: 503 }); };
  await assert.rejects(askJson("", ""), expectCategory("provider_unavailable"));
  assert.equal(calls, 1);
});

test("explicit diagnostic probes never switch to a different configured provider", async () => {
  process.env.GEMINI_API_KEY = "unit-key";
  process.env.AI_FALLBACK_PROVIDERS = "gemini";
  let calls = 0;
  globalThis.fetch = async (url) => { calls++; assert.match(String(url), /groq/); return Response.json({}, { status: 503 }); };
  await assert.rejects(askJson("", ""), expectCategory("provider_unavailable"));
  assert.equal(calls, 1);
});

test("per-operation fallback prohibition overrides environment opt-in", async () => {
  process.env.GEMINI_API_KEY = "unit-key";
  process.env.AI_FALLBACK_PROVIDERS = "gemini";
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}, { status: 503 }); };
  await assert.rejects(askJson("", "", { fallback: false }), expectCategory("provider_unavailable"));
  assert.equal(calls, 1);
});

test("invalid JSON and primitive output cannot become successful responses", async () => {
  for (const content of ["{broken", "null", "true", "42", "\"text\""]) {
    globalThis.fetch = async () => success("groq", {}, { choices: [{ finish_reason: "stop", message: { content } }] });
    await assert.rejects(askJson("", ""), expectCategory("invalid_output"));
  }
});

test("schema validation failure preserves no fabricated value and does not retry", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return success("groq", { scores: { trust: 99 } }); };
  await assert.rejects(askJson("", "", {
    maxRetries: 2,
    validate: () => { throw new Error("private generated content"); },
  }), expectCategory("schema_validation"));
  assert.equal(calls, 1);
});

for (const provider of ["gemini", "groq", "anthropic"] as ProviderId[]) {
  test(`${provider} rejects token-truncated responses even when text parses`, async () => {
    process.env.AI_PROVIDER = provider;
    process.env[`${provider.toUpperCase()}_API_KEY`] = "unit-key";
    const override = provider === "groq" ? { choices: [{ finish_reason: "length", message: { content: "{}" } }] }
      : provider === "anthropic" ? { stop_reason: "max_tokens" }
      : { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{}" }] } }] };
    globalThis.fetch = async () => success(provider, {}, override);
    await assert.rejects(askJson("", ""), expectCategory("truncated_output"));
  });
}

test("deadline bounds even a transport that never resolves and ignores abort", async () => {
  let calls = 0;
  let requestSignal: AbortSignal | undefined;
  globalThis.fetch = async (_, options) => { calls++; requestSignal = options?.signal ?? undefined; return new Promise<Response>(() => {}); };
  const start = Date.now();
  await assert.rejects(askJson("", "", { timeoutMs: 20, deadlineMs: 30, maxRetries: 2 }), expectCategory("timeout"));
  assert.ok(Date.now() - start < 1000);
  assert.equal(requestSignal?.aborted, true);
  assert.equal(calls, 1);
});

test("cancellation interrupts inference and prevents retries/fallback", async () => {
  process.env.GEMINI_API_KEY = "unit-key";
  process.env.AI_FALLBACK_PROVIDERS = "gemini";
  const controller = new AbortController();
  let calls = 0;
  let requestSignal: AbortSignal | undefined;
  globalThis.fetch = async (_, options) => {
    calls++;
    requestSignal = options?.signal ?? undefined;
    setTimeout(() => controller.abort(), 5);
    return new Promise<Response>(() => {});
  };
  await assert.rejects(askJson("", "", { signal: controller.signal, maxRetries: 2 }), expectCategory("cancelled"));
  assert.equal(requestSignal?.aborted, true);
  assert.equal(calls, 1);
});

test("already cancelled operation performs no request", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return success("groq"); };
  await assert.rejects(askJson("", "", { signal: controller.signal }), expectCategory("cancelled"));
  assert.equal(calls, 0);
});

test("cancellation during backoff prevents the next retry", async () => {
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    setTimeout(() => controller.abort(), 10);
    return Response.json({}, { status: 429 });
  };
  await assert.rejects(askJson("", "", { signal: controller.signal, maxRetries: 2 }), expectCategory("cancelled"));
  assert.equal(calls, 1);
});

test("a response-body disconnect is a network failure", async () => {
  globalThis.fetch = async () => ({
    ok: true, status: 200, headers: new Headers(),
    json: async () => { throw new TypeError("connection terminated with SECRET"); },
  }) as unknown as Response;
  await assert.rejects(askJson("", ""), expectCategory("network"));
});

test("observer failures cannot cause duplicate inference or discard a valid response", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return success("groq"); };
  const result = await askJson("", "", {
    onMetadata: () => { throw new Error("listener failed"); },
    onStatus: () => { throw new Error("listener failed"); },
  });
  assert.deepEqual(result.data, { ok: true });
  assert.equal(calls, 1);
});

test("diagnostics contain configuration status, never keys or prompts", () => {
  const diagnostics = providerDiagnostics();
  assert.equal(diagnostics.ready, false);
  assert.equal(diagnostics.selected?.provider, "anthropic");
  assert.equal(JSON.stringify(diagnostics).includes("test-key-for-unit-tests"), false);
  assert.equal(normalizeProviderError(new Error("SECRET")).message.includes("SECRET"), false);
});
