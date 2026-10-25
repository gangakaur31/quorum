import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
const runtimeState = globalThis as typeof globalThis & { quorumRateWindows?: Map<string, { count: number; expires: number }> };
const windows = runtimeState.quorumRateWindows ??= new Map<string, { count: number; expires: number }>();
export class RateLimitError extends Error {}
function rateLimit(request: Request, inference: boolean) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = createHash("sha256").update(`${inference ? "ai" : "write"}:${ip}`).digest("hex");
  const now = Date.now();
  if (windows.size > 10000) for (const [id, window] of windows) if (window.expires < now) windows.delete(id);
  const window = windows.get(key);
  if (window && window.expires > now) { if (++window.count > (inference ? 15 : 90)) throw new RateLimitError("Too many requests. Wait one minute before trying again."); }
  else windows.set(key, { count: 1, expires: now + 60000 });
}
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("Cross-origin changes are not permitted.");
  const pathname = new URL(request.url).pathname;
  const inference = ["/api/generate", "/api/jury", "/api/discover", "/api/confidence", "/api/interview", "/api/marketing"].includes(pathname);
  rateLimit(request, inference);
  if (Number(request.headers.get("content-length")) > 200000) throw new Error("This request is too large.");
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let text = "", bytes = 0;
  if (reader) try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 200000) { await reader.cancel(); throw new Error("This request is too large."); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  const body: unknown = JSON.parse(text);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected a structured request.");
  const operation = body as Record<string, unknown>;
  if (pathname === "/api/knowledge" && (operation.operation === "ask" || (operation.operation === "import" && operation.mode === "url"))) rateLimit(request, true);
  return body as Record<string, unknown>;
}
export function apiError(error: unknown, status = 400) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "The operation could not complete." }, { status: error instanceof RateLimitError ? 429 : status });
}
