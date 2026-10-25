import { askJson, ProviderError, normalizeProviderError } from "@/lib/agents/providers";
import { hydrateContext, updateContext } from "@/lib/context-store";
import { marketingSystemPrompt } from "@/lib/prompts";
import { saveResult } from "@/lib/result-history";
import { readBody, apiError } from "@/lib/api";
import { textField } from "@/lib/evidence";
import { knowledgeContext, retrieveSnapshot, withGrounding, assertKnowledgeUnchanged } from "@/lib/knowledge";
import type { MarketingAngle, SessionContext } from "@/lib/types";
export const maxDuration = 60;
export const runtime = "nodejs";
function validateAngles(value: unknown): MarketingAngle[] {
  const angles = (value as { angles?: unknown[] })?.angles;
  if (!Array.isArray(angles) || angles.length < 2 || angles.length > 3) throw new Error("Expected two or three marketing angles.");
  const result = angles.map(raw => {
    const a = raw as MarketingAngle;
    const id = textField(a?.id, "Angle id", 60);
    if (!/^[a-z0-9-]+$/.test(id) || ["constructor", "prototype", "__proto__"].includes(id)) throw new Error("Angle ids must be safe lowercase words and hyphens.");
    return { id, headline: textField(a.headline, "Headline", 500), angle: textField(a.angle, "Angle", 1500), cta: textField(a.cta, "CTA", 200) };
  });
  if (new Set(result.map(a => a.id)).size !== result.length) throw new Error("Angle ids must be unique.");
  return result;
}
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const session = await hydrateContext(body.context as SessionContext);
    if (!session.idea || !session.artifact) throw new Error("Generate a landing artifact before testing ad angles.");
    const snapshot = retrieveSnapshot(session, "marketing");
    const result = await askJson(marketingSystemPrompt, JSON.stringify({ idea: session.idea, artifact: { headline: session.artifact.headline, claims: session.artifact.keyClaims }, retrieved: knowledgeContext(session, "marketing", snapshot) }), { task: "marketing", signal: request.signal, validate: validateAngles });
    const context = await updateContext(session.sessionId, current => { assertKnowledgeUnchanged(current, snapshot); return { marketingAngles: result.data, resultHistory: saveResult(current, { kind: "angles", angles: result.data }, snapshot.id), marketingRuns: {}, groundingRuns: withGrounding(current, snapshot, result.metadata) }; });
    return Response.json({ angles: result.data, context, attribution: result.metadata });
  } catch (error) {
    return error instanceof ProviderError ? Response.json({ error: normalizeProviderError(error).message }, { status: 502 }) : apiError(error);
  }
}
