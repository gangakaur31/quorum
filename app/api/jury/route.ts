import { hydrateContext, updateContext } from "@/lib/context-store";
import { saveResult } from "@/lib/result-history";
import { readBody } from "@/lib/api";
import { askJson, normalizeProviderError } from "@/lib/agents/providers";
import { ensurePersonaResponse } from "@/lib/agents/validation";
import { JURY_SHARED_PREFIX, jurySystemPrompt, juryUserPrompt } from "@/lib/prompts";
import { knowledgeContext, retrieveSnapshot, withGrounding } from "@/lib/knowledge";
import { juryPatch } from "@/lib/jury-state";
import { PERSONAS, type MarketingAngle, type PersonaFailure, type PersonaId, type PersonaResponse, type SessionContext } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

type JuryRequest = { context?: SessionContext; personas?: PersonaId[]; angle?: MarketingAngle };

const encoder = new TextEncoder();
const event = (name: string, data: unknown) => encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);

export async function POST(request: Request) {
  try {
    const body = await readBody(request) as JuryRequest;
    const { context, personas } = body;
    if (!Array.isArray(personas) || !personas.length || personas.length > PERSONAS.length || personas.some((persona) => !PERSONAS.includes(persona))) {
      return new Response("Choose one or more supported jury perspectives.", { status: 400 });
    }
    const session = await hydrateContext(context);
    if (!session.idea || !session.artifact) return new Response("Landing artifact required.", { status: 400 });
    const snapshot = retrieveSnapshot(session, "jury");
    const retrieved = knowledgeContext(session, "jury", snapshot);
    const uniquePersonas = [...new Set(personas)];
    const angle = body.angle ? session.marketingAngles?.find((candidate) => candidate.id === body.angle?.id) : undefined;
    if (body.angle && !angle) return new Response("Choose a saved marketing angle.", { status: 400 });
    const abort = new AbortController();
    const cancel = () => abort.abort();
    request.signal.addEventListener("abort", cancel, { once: true });
    if (request.signal.aborted) cancel();
    let streamOpen = true;
    await updateContext(session.sessionId, (current) => juryPatch(current, uniquePersonas, undefined, angle?.id));

    const stream = new ReadableStream({
      async start(controller) {
        const emit = (name: string, data: unknown) => {
          if (!streamOpen || abort.signal.aborted) return;
          try { controller.enqueue(event(name, data)); }
          catch { streamOpen = false; cancel(); }
        };
        try {
          emit("status", { status: "running", personas: uniquePersonas, angleId: angle?.id });
          await Promise.all(uniquePersonas.map(async (persona) => {
            let outcome: PersonaResponse | PersonaFailure;
            try {
              const result = await askJson(jurySystemPrompt(persona), juryUserPrompt(session, angle, persona, retrieved), {
                task: "jury",
                cachePrefix: JURY_SHARED_PREFIX,
                onStatus: status => emit("provider-status", { persona, ...status }),
                signal: abort.signal,
                validate: (value) => ensurePersonaResponse(value, persona),
              });
              outcome = { ...result.data, attribution: result.metadata, groundingRunId: snapshot.id, contextRevision: session.evaluationRevision ?? 0, profileName: session.customReviewers?.find(r => r.role === persona)?.name };
            } catch (error) {
              const safe = normalizeProviderError(error);
              outcome = { persona, error: safe.message, category: safe.category, retryable: safe.retryable };
            }
            try {
              // Commit each result before notifying the browser. A disconnect cannot undo a
              // completed review, and retries replace by persona instead of duplicating it.
              await updateContext(session.sessionId, (current) => {
                if ((current.evaluationRevision ?? 0) !== (session.evaluationRevision ?? 0)) outcome = { persona, error: "Project context changed during this review. Retry it with the current evidence.", category: "context_changed", retryable: true };
                return { ...juryPatch(current, uniquePersonas, outcome, angle?.id), ...("scores" in outcome ? { groundingRuns: withGrounding(current, snapshot), resultHistory: saveResult(current, { kind: "review", response: outcome, ...(angle ? { angle } : {}) }, snapshot.id) } : {}) };
              });
              emit("scores" in outcome ? "persona" : "persona-error", outcome);
            } catch {
              emit("persistence-error", { persona, error: "This result could not be saved. Reload the project to check which reviews were recorded before retrying." });
            }
          }));
          const latest = await updateContext(session.sessionId, current => {
            const storedRun = angle ? current.marketingRuns?.[angle.id] : undefined;
            const card = angle ? storedRun?.scorecard : current.scorecard;
            if (!card || (current.evaluationRevision ?? 0) !== snapshot.contextRevision) return {};
            return { resultHistory: saveResult(current, { kind: "panel", scorecard: card, personas: angle ? storedRun?.personas ?? uniquePersonas : current.personas ?? uniquePersonas, ...(angle ? { angle } : {}) }, snapshot.id) };
          });
          const run = angle ? latest?.marketingRuns?.[angle.id] : undefined;
          const responses = angle ? run?.responses ?? [] : latest?.jury ?? [];
          const failures = angle ? run?.failures ?? [] : latest?.failures ?? [];
          const scorecard = angle ? run?.scorecard : latest?.scorecard;
          const completedPersonas = angle ? run?.personas ?? uniquePersonas : latest?.personas ?? uniquePersonas;
          const status = abort.signal.aborted ? "cancelled"
            : !scorecard?.completedCount ? "failed"
              : scorecard.missingPersonas.length ? "partially_completed" : "completed";
          emit("complete", {
            context: latest,
            scorecard, responses, failures, personas: completedPersonas, angleId: angle?.id, status,
            ...(status === "failed" ? { error: "No valid review is available. Saved failures can be retried individually." } : {}),
          });
        } catch {
          emit("error", { error: "The jury was interrupted. Reload the project to recover saved reviews, then retry missing perspectives." });
        } finally {
          request.signal.removeEventListener("abort", cancel);
          if (streamOpen) {
            try { controller.close(); } catch { /* The reader may have disconnected. */ }
            streamOpen = false;
          }
        }
      },
      cancel() { streamOpen = false; cancel(); },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
  } catch {
    return new Response("Unable to start this jury. Check that the project is saved and try again.", { status: 400 });
  }
}
