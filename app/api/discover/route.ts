import { askJson, ProviderError, normalizeProviderError } from "@/lib/agents/providers";
import { hydrateContext, updateContext } from "@/lib/context-store";
import { apiError, readBody } from "@/lib/api";
import { discoveryQuery, discoverySystemPrompt, ResearchError, searchSources, validateConstraints, validateOpportunities, validateSuppliedSources } from "@/lib/research";
import { knowledgeContext, retrieveSnapshot, withGrounding, assertKnowledgeUnchanged } from "@/lib/knowledge";
import type { SessionContext } from "@/lib/types";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const session = await hydrateContext(body.context as SessionContext);
    if (body.operation === "select") {
      if (session.artifact) throw new Error("Start a new project before selecting another opportunity.");
      const opportunity = session.discovery?.opportunities.find(o => o.id === body.opportunityId);
      if (!opportunity || !session.discovery) throw new Error("Choose a stored opportunity.");
      const context = await updateContext(session.sessionId, { idea: `${opportunity.approach}\nCustomer: ${opportunity.customer}\nProblem: ${opportunity.problem}`, assumptions: { ...session.assumptions, targetAudience: opportunity.customer, problem: opportunity.problem, currentAlternative: opportunity.alternatives.join("; ") }, discovery: { ...session.discovery, selectedOpportunityId: opportunity.id }, hypotheses: opportunity.assumptions.map(claim => ({ id: crypto.randomUUID(), claim, createdAt: new Date().toISOString() })) });
      return Response.json({ context });
    }
    const constraints = validateConstraints(body.constraints);
    const sources = body.mode === "supplied" ? validateSuppliedSources(body.sources) : await searchSources(constraints, request.signal);
    if (!sources.length) throw new ResearchError("Add at least one relevant source excerpt before synthesis.");
    const retrieved = retrieveSnapshot({ ...session, discovery: { sources, opportunities: [] } }, "discover");
    // Direct source excerpts are already sent once below; retain other relevant context.
    const snapshot = { ...retrieved, passages: retrieved.passages.filter(p => !sources.some(s => s.id === p.id)) };
    const result = await askJson(discoverySystemPrompt, JSON.stringify({ constraints, sources, retrieved: knowledgeContext(session, "discover", snapshot) }), { task: "discover", signal: request.signal, deadlineMs: 35000, validate: value => validateOpportunities(value, sources) });
    const context = await updateContext(session.sessionId, current => { assertKnowledgeUnchanged(current, snapshot); return { discovery: { opportunities: result.data, sources }, groundingRuns: withGrounding(current, snapshot, result.metadata) }; });
    return Response.json({ context, attribution: result.metadata, query: discoveryQuery(constraints) });
  } catch (error) {
    if (error instanceof ProviderError) return Response.json({ error: normalizeProviderError(error).message }, { status: 502 });
    return apiError(error, error instanceof ResearchError ? error.status : 400);
  }
}
