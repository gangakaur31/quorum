import "server-only";
import { createHash } from "node:crypto";

export class GroqCatalogError extends Error {
  constructor(public category: "authentication" | "rate_limit" | "provider_unavailable" | "unsupported_model" | "invalid_output", public status?: number) { super("Groq model discovery could not complete."); }
}
type CatalogModel = { id: string; active?: boolean; context_window?: number; max_completion_tokens?: number };
const caches = new Map<string, { model: string; expires: number }>();
type Discovery = { controller: AbortController; users: number; promise: Promise<string> };
const pending = new Map<string, Discovery>();
const validId = (id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9_.:/-]{1,160}$/.test(id);

/** Select from the account's actual catalog; no particular model name is embedded here. */
export function selectGroqTextModel(value: unknown): string {
  const data = (value as { data?: CatalogModel[] })?.data;
  if (!Array.isArray(data)) throw new GroqCatalogError("invalid_output");
  const models = data.filter(m => m && validId(m.id) && m.active !== false &&
    !/whisper|orpheus|guard|moderation|embedding|speech|audio|transcri|tts|compound|browser|search/i.test(m.id) &&
    (m.context_window === undefined || Number.isFinite(m.context_window) && m.context_window >= 16384) &&
    (m.max_completion_tokens === undefined || Number.isFinite(m.max_completion_tokens) && m.max_completion_tokens >= 8192));
  if (!models.length) throw new GroqCatalogError("unsupported_model");
  // Respect Groq's catalog order. Attribution records the actual model used for each run.
  return models[0].id;
}

export async function discoverGroqModel(apiKey: string, signal: AbortSignal): Promise<string> {
  if (signal.aborted) throw signal.reason ?? new DOMException("Cancelled", "AbortError");
  const fingerprint = createHash("sha256").update(apiKey).digest("hex");
  const cache = caches.get(fingerprint);
  if (cache && cache.expires > Date.now()) return cache.model;
  // Share catalog traffic without letting one cancelled project abort another project.
  let entry = pending.get(fingerprint);
  if (!entry) {
    const controller = new AbortController();
    const operation = (async () => {
    const response = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new GroqCatalogError(response.status === 401 || response.status === 403 ? "authentication" : response.status === 429 ? "rate_limit" : "provider_unavailable", response.status);
    let body: unknown;
    try { body = await response.json(); } catch { throw new GroqCatalogError("invalid_output"); }
    const model = selectGroqTextModel(body);
    if (controller.signal.aborted) throw controller.signal.reason ?? new DOMException("Cancelled", "AbortError");
    if (caches.size >= 16) caches.clear();
    caches.set(fingerprint, { model, expires: Date.now() + 300000 });
    return model;
    })();
    entry = { controller, users: 0, promise: operation };
    pending.set(fingerprint, entry);
    const captured = entry;
    const remove = () => { if (pending.get(fingerprint) === captured) pending.delete(fingerprint); };
    void operation.then(remove, remove);
  }
  const captured = entry;
  captured.users++;
  return new Promise<string>((resolve, reject) => {
    let finished = false;
    const finish = (callback: () => void) => {
      if (finished) return;
      finished = true; signal.removeEventListener("abort", abort);
      if (--captured.users === 0 && pending.get(fingerprint) === captured) { pending.delete(fingerprint); captured.controller.abort(); }
      callback();
    };
    const abort = () => finish(() => reject(signal.reason ?? new DOMException("Cancelled", "AbortError")));
    signal.addEventListener("abort", abort, { once: true });
    captured.promise.then(model => finish(() => resolve(model)), error => finish(() => reject(error)));
    if (signal.aborted) abort();
  });
}

export function clearGroqModelCache() { caches.clear(); }
