import "server-only";
import { clearGroqModelCache, discoverGroqModel, GroqCatalogError } from "./groq-models";
import { taskOutputBudget } from "./task-policy";
import { normalizeGeneratedCopy } from "../typography";
import type {
  ProviderAttempt, ProviderErrorCategory, ProviderId, ProviderMetadata, ProviderOptions,
  ProviderUsage, PublicProviderError,
} from "./provider-types";

export type { ProviderMetadata, ProviderOptions, PublicProviderError } from "./provider-types";
export type ChatMessage = { role: "system" | "user"; content: string };

const PROVIDERS: ProviderId[] = ["gemini", "groq", "anthropic"];
const DEFAULT_MODELS: Record<ProviderId, string> = {
  gemini: "gemini-3.8-flash",
  groq: "auto",
  anthropic: "claude-haiku-5-5",
};
const LABELS: Record<ProviderId, string> = { gemini: "Gemini", groq: "Groq", anthropic: "Claude" };
const TRANSIENT = new Set<ProviderErrorCategory>(["rate_limit", "network", "timeout", "provider_unavailable"]);
const MESSAGES: Record<ProviderErrorCategory, string> = {
  configuration: "AI configuration required. Configure the selected provider and its server-side API key, then retry.",
  authentication: "The AI provider rejected its credentials. Check the server-side API key and account permissions.",
  billing: "The AI provider has no available quota or billing access. Check the provider account before retrying.",
  rate_limit: "The AI provider is receiving too many requests. Wait briefly, then retry the unfinished operation.",
  network: "The AI provider could not be reached. Check connectivity, then retry the unfinished operation.",
  timeout: "The AI provider did not respond before the deadline. Your completed work is preserved; retry the unfinished operation.",
  provider_unavailable: "The AI provider is temporarily unavailable. Retry later or select another configured provider.",
  unsupported_model: "The selected AI model or capability is unavailable. Check the configured model and account access.",
  context_limit: "The AI request exceeded the model's size limit. Reduce the supplied context and retry.",
  invalid_output: "The model returned an incomplete or unreadable response. No result was accepted; retry the operation.",
  schema_validation: "The model's response did not meet the required format. No result was accepted; retry the operation.",
  truncated_output: "The model reached its output limit before completing the response. No partial result was accepted.",
  refusal: "The provider declined this request. Review its scope before trying again; another provider was not used to bypass the refusal.",
  cancelled: "This AI operation was cancelled. Completed work has been preserved.",
  unknown: "The AI operation could not finish. Retry the unfinished operation.",
};

function safeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-zA-Z0-9_.:/-]{1,160}$/.test(value) ? value : undefined;
}

export class ProviderError extends Error {
  readonly category: ProviderErrorCategory;
  readonly retryable: boolean;
  readonly provider?: ProviderId;
  readonly model?: string;
  readonly status?: number;
  readonly requestId?: string;
  readonly retryAfterMs?: number;
  usage?: ProviderUsage;

  constructor(category: ProviderErrorCategory, detail: {
    provider?: ProviderId; model?: string; status?: number; requestId?: string; retryAfterMs?: number;
  } = {}) {
    super(`${detail.provider ? `${LABELS[detail.provider]}: ` : ""}${MESSAGES[category]}`);
    this.name = "ProviderError";
    this.category = category;
    this.retryable = TRANSIENT.has(category);
    this.provider = detail.provider;
    this.model = safeIdentifier(detail.model);
    this.status = detail.status;
    this.requestId = safeIdentifier(detail.requestId);
    this.retryAfterMs = detail.retryAfterMs;
  }
}

/** Never forward an arbitrary Error.message, upstream body, stack, or prompt. */
export function normalizeProviderError(error: unknown): PublicProviderError {
  const safe = error instanceof ProviderError ? error : new ProviderError("unknown");
  return {
    category: safe.category, message: safe.message, retryable: safe.retryable,
    provider: safe.provider, model: safe.model, status: safe.status, requestId: safe.requestId,
  };
}

function providerId(value: string | undefined): ProviderId | undefined {
  if (!value?.trim()) return undefined;
  const id = value.trim().toLowerCase();
  if (!PROVIDERS.includes(id as ProviderId)) throw new ProviderError("configuration");
  return id as ProviderId;
}

function keyFor(provider: ProviderId) {
  return process.env[`${provider.toUpperCase()}_API_KEY`]?.trim();
}

function configured(provider: ProviderId) {
  const key = keyFor(provider);
  return Boolean(key && !/^(your[-_ ]|replace[-_ ]|<)/i.test(key));
}

function bounded(value: string | number | undefined, fallback: number, min: number, max: number) {
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number) || number < min || number > max) {
    throw new ProviderError("configuration");
  }
  return number;
}

function diagnosticSelection<T>(options: ProviderOptions<T>) {
  const task = options.task?.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  const taskProvider = task ? providerId(process.env[`AI_${task}_PROVIDER`]) : undefined;
  const globalProvider = providerId(process.env.AI_PROVIDER);
  const defaultProvider = globalProvider ?? PROVIDERS.find(configured) ?? "gemini";
  const provider = options.provider ?? taskProvider ?? defaultProvider;
  if (!PROVIDERS.includes(provider)) throw new ProviderError("configuration");
  const taskModel = task ? process.env[`AI_${task}_MODEL`]?.trim() || undefined : undefined;
  // A global model belongs to the global provider, never to a per-task/fallback provider.
  const model = options.model ?? taskModel ??
    (defaultProvider === provider ? process.env.AI_MODEL?.trim() || undefined : undefined) ??
    (process.env[`${provider.toUpperCase()}_MODEL`]?.trim() || DEFAULT_MODELS[provider]);
  if (!safeIdentifier(model)) throw new ProviderError("configuration", { provider });
  return { provider, model };
}

function selected<T>(options: ProviderOptions<T>) {
  const task = options.task?.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  const taskProvider = task ? process.env[`AI_${task}_PROVIDER`]?.trim().toLowerCase() : undefined;
  const legacyModelOwner = taskProvider || process.env.AI_PROVIDER?.trim().toLowerCase() || "anthropic";
  const taskModel = task && legacyModelOwner === "anthropic" ? process.env[`AI_${task}_MODEL`]?.trim() : undefined;
  const globalModel = process.env.AI_PROVIDER?.trim().toLowerCase() === "anthropic" ? process.env.AI_MODEL?.trim() : undefined;
  const model = (options.provider === undefined || options.provider === "anthropic" ? options.model : undefined) || taskModel || process.env.ANTHROPIC_MODEL?.trim() || globalModel || DEFAULT_MODELS.anthropic;
  if (!safeIdentifier(model)) throw new ProviderError("configuration", { provider: "anthropic" });
  return { provider: "anthropic" as const, model };
}
export function providerSelection(task?: string) { return selected({ task }); }

type Health = {
  requests: number; successes: number; failures: number; lastLatencyMs?: number;
  lastSuccessAt?: string; lastFailureAt?: string; lastError?: ProviderErrorCategory;
  usage?: ProviderUsage; measuredUsageResponses?: number; fallbacks?: number;
};
const health: Record<ProviderId, Health> = {
  gemini: { requests: 0, successes: 0, failures: 0 },
  groq: { requests: 0, successes: 0, failures: 0 },
  anthropic: { requests: 0, successes: 0, failures: 0 },
};

/** Process-local observations, not a paid connectivity probe or durable monitoring system. */
export function providerDiagnostics() {
  let selection: ReturnType<typeof selected> | undefined;
  let configurationError: PublicProviderError | undefined;
  try { selection = selected({}); } catch (error) { configurationError = normalizeProviderError(error); }
  if (selection && !configured(selection.provider)) configurationError = normalizeProviderError(new ProviderError("configuration", selection));
  return {
    selected: selection,
    ready: Boolean(selection && configured(selection.provider)),
    configurationError,
    fallbackPolicy: "claude-first-groq-after-unusable-response",
    fallbackConfigured: configured("groq"),
    ignoredProviderOverrides: Object.keys(process.env).filter(k => /^(AI_PROVIDER|AI_[A-Z]+_PROVIDER|AI_FALLBACK_PROVIDERS)$/.test(k)),
    observationScope: "current-server-process",
    providers: PROVIDERS.map((provider) => ({
      provider, model: safeIdentifier(process.env[`${provider.toUpperCase()}_MODEL`]) ?? DEFAULT_MODELS[provider],
      configured: configured(provider),
      status: !configured(provider) ? "not-configured" : !health[provider].requests ? "not-tested" :
        health[provider].lastError ? "last-request-failed" : "last-request-succeeded",
      ...health[provider],
    })),
  };
}

type AdapterResult = { value: unknown; model?: string; requestId?: string; usage?: ProviderUsage; cacheRequested?: boolean };
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function parseJson(text: unknown, provider: ProviderId, model: string) {
  if (typeof text !== "string" || text.length > 1_000_000) throw new ProviderError("invalid_output", { provider, model });
  try {
    const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const value: unknown = JSON.parse(clean);
    if (value === null || typeof value !== "object") throw new Error();
    return value;
  } catch { throw new ProviderError("invalid_output", { provider, model }); }
}

function retryAfter(response: Response, body: unknown): number | undefined {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    const milliseconds = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(header) - Date.now();
    if (Number.isFinite(milliseconds) && milliseconds >= 0) return milliseconds;
  }
  const details = record(record(body).error).details;
  if (Array.isArray(details)) {
    for (const item of details) {
      const delay = record(item).retryDelay;
      if (typeof delay === "string" && /^\d+(\.\d+)?s$/.test(delay)) return Number(delay.slice(0, -1)) * 1_000;
    }
  }
  return undefined;
}

function httpError(provider: ProviderId, model: string, response: Response, body: unknown) {
  const error = record(record(body).error);
  // Upstream fields are used only for classification and are never logged or retained.
  const description = [error.type, error.code, error.status, error.message]
    .filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
  let category: ProviderErrorCategory = "unknown";
  if (/insufficient_quota|billing|credit balance|payment|quota.*(?:exceeded.*(?:daily|monthly)|limit:\s*0)|daily.*quota/.test(description) || response.status === 402) category = "billing";
  else if (response.status === 401 || response.status === 403 || /api.key.*(?:invalid|not.valid)|authentication|unauthenticated/.test(description)) category = "authentication";
  else if (response.status === 413 || /context.?length|context.window|too many tokens|request.*too large|input.*too long/.test(description)) category = "context_limit";
  else if (/json_validate_failed|failed to generate json|invalid.json/.test(description)) category = "invalid_output";
  else if (response.status === 404 || /model.*(?:not.found|not.exist|unsupported|decommissioned)|not.supported/.test(description)) category = "unsupported_model";
  else if (response.status === 429) category = "rate_limit";
  else if (response.status === 408 || response.status === 504) category = "timeout";
  else if (response.status >= 500) category = "provider_unavailable";
  else if (response.status === 400 || response.status === 422) category = "unsupported_model";
  return new ProviderError(category, {
    provider, model, status: response.status,
    requestId: response.headers.get("request-id") ?? response.headers.get("x-request-id") ?? undefined,
    retryAfterMs: retryAfter(response, body),
  });
}

async function callAdapter(
  provider: ProviderId, model: string, system: string, user: string,
  signal: AbortSignal, maxTokens: number, cachePrefix?: string,
): Promise<AdapterResult> {
  const key = keyFor(provider)!;
  if (provider === "groq" && model === "auto") {
    try { model = await discoverGroqModel(key, signal); }
    catch (error) { if (error instanceof GroqCatalogError) throw new ProviderError(error.category, { provider, status: error.status }); throw error; }
  }
  const jsonInstruction = `${system}\n\nReturn only valid JSON matching the requested contract. Do not wrap it in commentary. Do not use em dashes in your own copy; use commas, periods or a colon. Preserve exact source quotations and identifiers verbatim. Material marked [DEMO] is authored fiction for a presentation; never describe its participants, counts, quotes or outcomes as real research, demand or validation.`;
  let url: string;
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: Record<string, unknown>;
  if (provider === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ""))}:generateContent`;
    headers = { ...headers, "x-goog-api-key": key };
    body = {
      systemInstruction: { parts: [{ text: jsonInstruction }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens },
    };
  } else if (provider === "groq") {
    url = "https://api.groq.com/openai/v1/chat/completions";
    headers = { ...headers, Authorization: `Bearer ${key}` };
    body = {
      model, messages: [{ role: "system", content: jsonInstruction }, { role: "user", content: user }],
      max_completion_tokens: maxTokens, response_format: { type: "json_object" },
    };
  } else {
    url = "https://api.anthropic.com/v1/messages";
    headers = { ...headers, "x-api-key": key, "anthropic-version": "2023-06-01" };
    // Messages has a separate system field and content blocks, unlike chat/completions.
    // No sampling parameters: current Claude models reject non-default temperature.
    const cacheRequested = Boolean(cachePrefix && cachePrefix.length >= 3072 && system.startsWith(cachePrefix) && /^claude-(?:haiku|sonnet|opus)-5/.test(model) && process.env.AI_PROMPT_CACHE !== "off");
    body = { model, system: cacheRequested ? [{ type: "text", text: cachePrefix, cache_control: { type: "ephemeral" } }, { type: "text", text: jsonInstruction.slice(cachePrefix!.length) }] : jsonInstruction, messages: [{ role: "user", content: user }], max_tokens: maxTokens };
  }
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal, cache: "no-store" });
  let payload: unknown;
  try { payload = await response.json(); } catch (error) {
    if (signal.aborted || error instanceof TypeError) throw error;
    if (!response.ok) throw httpError(provider, model, response, {});
    throw new ProviderError("invalid_output", { provider, model });
  }
  if (!response.ok) { if (provider === "groq" && response.status === 404) clearGroqModelCache(); throw httpError(provider, model, response, payload); }
  const data = record(payload);
  const requestId = safeIdentifier(response.headers.get("request-id") ?? response.headers.get("x-request-id") ?? data.id ?? data.responseId);
  let text: unknown;
  let usage: ProviderUsage;
  let returnedModel: unknown = data.model;
  if (provider === "gemini") {
    const candidate = record(Array.isArray(data.candidates) ? data.candidates[0] : undefined);
    const parts = record(candidate.content).parts;
    text = Array.isArray(parts) ? parts.filter((part) => record(part).thought !== true).map((part) => record(part).text ?? "").join("") : undefined;
    const tokens = record(data.usageMetadata);
    usage = { inputTokens: number(tokens.promptTokenCount), outputTokens: number(tokens.candidatesTokenCount), totalTokens: number(tokens.totalTokenCount) };
    if (candidate.finishReason !== "STOP") {
      const error = new ProviderError(candidate.finishReason === "MAX_TOKENS" ? "truncated_output" : candidate.finishReason === "SAFETY" ? "refusal" : "invalid_output", { provider, model, requestId }); error.usage = usage; throw error;
    }
    returnedModel = data.modelVersion;
  } else if (provider === "groq") {
    const choice = record(Array.isArray(data.choices) ? data.choices[0] : undefined);
    text = record(choice.message).content;
    const tokens = record(data.usage);
    usage = { inputTokens: number(tokens.prompt_tokens), outputTokens: number(tokens.completion_tokens), totalTokens: number(tokens.total_tokens) };
    const cached = number(record(tokens.prompt_tokens_details).cached_tokens);
    if (cached !== undefined) usage.cacheReadInputTokens = cached;
    if (choice.finish_reason !== "stop") {
      const error = new ProviderError(choice.finish_reason === "length" ? "truncated_output" : choice.finish_reason === "content_filter" ? "refusal" : "invalid_output", { provider, model, requestId }); error.usage = usage; throw error;
    }
  } else {
    text = Array.isArray(data.content) ? data.content.filter((block) => record(block).type === "text").map((block) => record(block).text ?? "").join("") : undefined;
    const tokens = record(data.usage);
    const inputTokens = number(tokens.input_tokens);
    const outputTokens = number(tokens.output_tokens);
    const cacheReadInputTokens = number(tokens.cache_read_input_tokens), cacheCreationInputTokens = number(tokens.cache_creation_input_tokens);
    usage = { inputTokens, outputTokens, totalTokens: inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens + (cacheReadInputTokens ?? 0) + (cacheCreationInputTokens ?? 0) : undefined,
      ...(cacheReadInputTokens !== undefined ? { cacheReadInputTokens } : {}), ...(cacheCreationInputTokens !== undefined ? { cacheCreationInputTokens } : {}) };
    if (data.stop_reason !== "end_turn") {
      const error = new ProviderError(data.stop_reason === "refusal" ? "refusal" : data.stop_reason === "max_tokens" ? "truncated_output" : "invalid_output", { provider, model, requestId }); error.usage = usage; throw error;
    }
  }
  let value: unknown;
  try { value = normalizeGeneratedCopy(parseJson(text, provider, model)); } catch (error) { if (error instanceof ProviderError) error.usage = usage; throw error; }
  return { value, model: safeIdentifier(returnedModel) ?? model, requestId, usage, cacheRequested: provider === "anthropic" && Array.isArray(body.system) };
}

function pause(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); reject(new ProviderError("cancelled")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", cancel); resolve(); }, milliseconds);
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
  });
}

async function boundedCall<T>(
  invoke: (signal: AbortSignal) => Promise<T>, milliseconds: number,
  provider: ProviderId, model: string, signal?: AbortSignal,
) {
  if (signal?.aborted) throw new ProviderError("cancelled", { provider, model });
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  const boundary = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(new ProviderError("cancelled", { provider, model })); };
    signal?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => { controller.abort(); reject(new ProviderError("timeout", { provider, model })); }, milliseconds);
    if (signal?.aborted) cancel();
  });
  try {
    return await Promise.race([invoke(controller.signal), boundary]);
  } finally {
    clearTimeout(timer);
    if (cancel) signal?.removeEventListener("abort", cancel);
  }
}

function observe<T>(callback: ((value: T) => void) | undefined, value: T) {
  // UI/telemetry listeners must never turn accepted inference into a duplicate call.
  try { callback?.(value); } catch { /* No prompt, response, or observer error is logged. */ }
}

function recordUsage(provider: ProviderId, usage?: ProviderUsage) {
  if (!usage || !Object.values(usage).some(value => value !== undefined)) return;
  health[provider].measuredUsageResponses = (health[provider].measuredUsageResponses ?? 0) + 1;
  const totals = health[provider].usage ??= {};
  for (const key of Object.keys(usage) as Array<keyof ProviderUsage>) if (usage[key] !== undefined) totals[key] = (totals[key] ?? 0) + usage[key]!;
}

async function executeJson<T>(system: string, user: string, options: ProviderOptions<T>, candidates: Array<{ provider: ProviderId; model: string }>): Promise<{ data: T; metadata: ProviderMetadata }> {
  const primary = candidates[0];
  // Missing Claude is an explicit setup error, not a hidden Groq-only installation.
  if (!configured(primary.provider)) throw new ProviderError("configuration", primary);
  const started = Date.now(), totalDuration = bounded(options.deadlineMs ?? process.env.AI_DEADLINE_MS, 50_000, 1, 55_000);
  const deadline = started + totalDuration;
  const maxRetries = Math.min(1, bounded(options.maxRetries ?? process.env.AI_MAX_RETRIES, 1, 0, 2));
  const maxRepairs = bounded(options.maxRepairs, 1, 0, 1);
  const ceiling = bounded(process.env.AI_MAX_OUTPUT_TOKENS, 32_768, 32, 32_768);
  const maxTokens = Math.min(ceiling, bounded(options.maxTokens, taskOutputBudget(options.task), 32, 32_768));
  const history: ProviderAttempt[] = [];
  let lastError: ProviderError | undefined;
  for (const [index, candidate] of candidates.entries()) {
    const { provider, model } = candidate;
    if (!safeIdentifier(model)) throw new ProviderError("configuration", { provider });
    const providerDeadline = index === 0 && candidates.length > 1 ? started + Math.ceil(totalDuration * .65) : deadline;
    const timeout = bounded(options.timeoutMs ?? process.env[`${provider.toUpperCase()}_TIMEOUT_MS`] ?? process.env.AI_TIMEOUT_MS, 20_000, 1, 50_000);
    let repair = false;
    // At most one extra request per provider, whether retry or structured recovery.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (options.signal?.aborted) throw new ProviderError("cancelled", candidate);
      const remaining = providerDeadline - Date.now();
      if (remaining <= 0) { lastError ??= new ProviderError("timeout", candidate); break; }
      observe(options.onStatus, { state: index > 0 && attempt === 0 ? "fallback" : attempt ? "retrying" : "running", provider, model, attempt: attempt + 1 });
      const callStarted = Date.now(); health[provider].requests++;
      try {
        const recovery = repair ? "\nThe previous attempt was incomplete or failed its JSON contract. Return a complete, concise JSON object matching the original schema. Do not omit required source references, unknowns or limitations." : "";
        const budget = repair && lastError?.category === "truncated_output" ? Math.min(ceiling, Math.ceil(maxTokens * 1.5)) : maxTokens;
        const result = await boundedCall(signal => callAdapter(provider, model, system + recovery, user, signal, budget, options.cachePrefix), Math.min(timeout, remaining), provider, model, options.signal);
        if (options.signal?.aborted) throw new ProviderError("cancelled", candidate);
        let data: T;
        try { data = options.validate ? options.validate(result.value) : result.value as T; }
        catch { const error = new ProviderError("schema_validation", { ...candidate, requestId: result.requestId }); error.usage = result.usage; throw error; }
        recordUsage(provider, result.usage);
        health[provider].successes++; health[provider].lastSuccessAt = new Date().toISOString(); health[provider].lastError = undefined; health[provider].lastLatencyMs = Date.now() - callStarted;
        if (index > 0) health[provider].fallbacks = (health[provider].fallbacks ?? 0) + 1;
        history.push({ ...candidate, model: result.model ?? model, attempt: attempt + 1, latencyMs: Date.now() - callStarted, outcome: "completed", usage: result.usage, validationStatus: "passed" });
        const metadata: ProviderMetadata = {
          provider, model: result.model ?? model, task: safeIdentifier(options.task), requestId: result.requestId, usage: result.usage,
          latencyMs: Date.now() - started, attempts: history.length, fallbackUsed: index > 0,
          retryCount: history.filter(a => a.attempt > 1).length, validationStatus: "passed", cacheRequested: result.cacheRequested,
          ...(index > 0 ? { fallbackReason: history.findLast(a => a.provider === primary.provider && a.category)?.category } : {}),
          completedAt: new Date().toISOString(), history,
        };
        observe(options.onMetadata, metadata); return { data, metadata };
      } catch (error) {
        const normalized = options.signal?.aborted ? new ProviderError("cancelled", candidate) : error instanceof ProviderError ? error : new ProviderError(error instanceof TypeError ? "network" : "unknown", candidate);
        recordUsage(provider, normalized.usage);
        health[provider].failures++; health[provider].lastFailureAt = new Date().toISOString(); health[provider].lastLatencyMs = Date.now() - callStarted; health[provider].lastError = normalized.category;
        history.push({ ...candidate, attempt: attempt + 1, latencyMs: Date.now() - callStarted, outcome: "failed", category: normalized.category, usage: normalized.usage, validationStatus: ["schema_validation", "invalid_output", "truncated_output"].includes(normalized.category) ? "failed" : "not-run" });
        lastError = normalized;
        if (normalized.category === "cancelled" || normalized.category === "refusal") throw normalized;
        if (attempt > 0) break;
        if (maxRepairs && ["invalid_output", "truncated_output", "schema_validation"].includes(normalized.category)) { repair = true; continue; }
        if (!normalized.retryable || !maxRetries) break;
        const delay = Math.max(normalized.retryAfterMs ?? 0, Math.round(300 + Math.random() * 200));
        if (delay >= providerDeadline - Date.now()) break;
        await pause(delay, options.signal);
      }
    }
  }
  if (lastError && history.some(a => a.provider === "anthropic") && history.some(a => a.provider === "groq")) {
    const claude = history.findLast(a => a.provider === "anthropic")!;
    lastError.message = `Claude could not return a usable response (${claude.category}); Groq recovery also failed (${lastError.category}). Check server credentials, model access and provider availability, then retry. No result was accepted.`;
  }
  throw lastError ?? new ProviderError("unknown", primary);
}

/** Production policy: all application workflows use Claude first, then Groq only. */
export async function askJson<T = unknown>(system: string, user: string, options: ProviderOptions<T> = {}) {
  const primary = selected(options);
  const candidates: Array<{ provider: ProviderId; model: string }> = [primary];
  if (options.fallback !== false && configured("groq")) candidates.push({ provider: "groq", model: process.env.GROQ_MODEL?.trim() || DEFAULT_MODELS.groq });
  return executeJson(system, user, options, candidates);
}

/** Explicit server-side connectivity/adapter probe; never used by a product route. */
export async function probeProviderJson<T = unknown>(system: string, user: string, options: ProviderOptions<T> = {}) {
  return executeJson(system, user, { ...options, maxRetries: options.maxRetries ?? 0, maxRepairs: options.maxRepairs ?? 0, fallback: false }, [diagnosticSelection(options)]);
}

/** Backward compatible names. Both obey the central Claude-first product policy. */
export async function askGeminiJson<T>(system: string, user: string, options: ProviderOptions<T> = {}): Promise<T> {
  return (await askJson(system, user, options)).data;
}

export async function askGroqJson<T>(messages: ChatMessage[], options: ProviderOptions<T> = {}): Promise<T> {
  const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const user = messages.filter((message) => message.role === "user").map((message) => message.content).join("\n\n");
  return (await askJson(system, user, options)).data;
}
