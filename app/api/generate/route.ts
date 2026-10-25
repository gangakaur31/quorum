import { askJson, normalizeProviderError, ProviderError } from "@/lib/agents/providers";
import { ensureLandingArtifact } from "@/lib/agents/validation";
import { hydrateContext, updateContext } from "@/lib/context-store";
import { landingSystemPrompt } from "@/lib/prompts";
import { knowledgeContext, retrieveSnapshot, withGrounding, assertKnowledgeUnchanged } from "@/lib/knowledge";
import { saveResult } from "@/lib/result-history";
import { readBody, apiError } from "@/lib/api";
import { textField } from "@/lib/evidence";
import type { FounderAssumptions, SessionContext } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";
const encoder = new TextEncoder();
const event = (name: string, data: unknown) => encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
export async function POST(request: Request) {
  try {
    const payload = await readBody(request);
    const idea = textField(payload.idea, "Idea", 6000);
    const snapshot = payload.context as SessionContext;
    const existing = await hydrateContext(snapshot);
    if (existing.artifact) throw new Error("This project already has an artifact. Start a new project for a different idea.");
    const assumptions: FounderAssumptions = {};
    for (const key of ["targetAudience", "price", "problem", "currentAlternative"] as const) {
      const value = snapshot?.assumptions?.[key];
      if (value) assumptions[key] = textField(value, key, 1000);
    }
    const session = await updateContext(existing.sessionId, { idea, assumptions });
    let connected = true;
    const abort = new AbortController();
    const cancel = () => abort.abort();
    request.signal.addEventListener("abort", cancel, { once: true });
    if (request.signal.aborted) cancel();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (name: string, data: unknown) => { if (connected && !abort.signal.aborted) { try { controller.enqueue(event(name, data)); } catch { connected = false; cancel(); } } };
        try {
          emit("progress", { step: 1, total: 4, label: "Project saved", detail: "The idea and assumptions are retained before generation." });
          emit("progress", { step: 2, total: 4, label: "Waiting for the AI provider", detail: "Generating a static offer from the supplied project context." });
          const snapshot = retrieveSnapshot(session, "generate");
          const result = await askJson(landingSystemPrompt, JSON.stringify({ idea: session.idea, assumptions, retrieved: knowledgeContext(session, "generate", snapshot) }), { task: "generate", signal: abort.signal, validate: ensureLandingArtifact, onStatus: status => emit("provider-status", status) });
          emit("progress", { step: 3, total: 4, label: "Artifact checked", detail: "The response passed its contract and HTML safety checks." });
          const context = await updateContext(session.sessionId, current => { assertKnowledgeUnchanged(current, snapshot); return { artifact: result.data, resultHistory: saveResult(current, { kind: "offer", artifact: result.data }, snapshot.id, (current.evaluationRevision ?? 0) + 1), jury: [], failures: [], scorecard: undefined, confidenceGate: undefined, marketingAngles: undefined, marketingRuns: undefined, groundingRuns: withGrounding(current, snapshot, result.metadata) }; });
          emit("complete", { step: 4, total: 4, label: "Artifact saved", detail: "The page is ready for a synthetic review.", artifact: result.data, context, attribution: result.metadata });
        } catch (error) {
          emit("error", { error: error instanceof ProviderError ? normalizeProviderError(error).message : "The artifact could not be saved. The idea is preserved; reload and retry." });
        } finally {
          request.signal.removeEventListener("abort", cancel);
          if (connected) { try { controller.close(); } catch {} connected = false; }
        }
      },
      cancel() { connected = false; cancel(); },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
  } catch (error) { return apiError(error); }
}
