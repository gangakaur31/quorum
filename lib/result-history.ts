import type { ConfidenceGate, LandingArtifact, MarketingAngle, PersonaId, PersonaResponse, Scorecard, SessionContext } from "./types";

type ResultBase = { id: string; createdAt: string; contextRevision: number; groundingRunId?: string };
export type SavedResult = ResultBase & (
  | { kind: "offer"; artifact: LandingArtifact }
  | { kind: "review"; response: PersonaResponse; angle?: MarketingAngle }
  | { kind: "panel"; scorecard: Scorecard; personas: PersonaId[]; angle?: MarketingAngle }
  | { kind: "angles"; angles: MarketingAngle[] }
  | { kind: "kit"; gate: ConfidenceGate }
);
type ResultInput = SavedResult extends infer R ? R extends SavedResult ? Omit<R, keyof ResultBase> : never : never;
export function saveResult(context: SessionContext, input: ResultInput, groundingRunId?: string, revision = context.evaluationRevision ?? 0): SavedResult[] {
  const record = { ...structuredClone(input), id: crypto.randomUUID(), createdAt: new Date().toISOString(), contextRevision: revision, groundingRunId } as SavedResult;
  const results = [...(context.resultHistory ?? []), record].slice(-16);
  // Recent versions are bounded separately from the current authoritative outputs.
  while (results.length > 1 && new TextEncoder().encode(JSON.stringify(results)).byteLength > 500000) results.shift();
  return results;
}
export function resultLabel(record: SavedResult): string {
  if (record.kind === "offer") return "Landing offer";
  if (record.kind === "angles") return "Marketing angles";
  if (record.kind === "kit") return "Interview kit";
  if (record.kind === "panel") return record.angle ? `Scorecard · ${record.angle.headline}` : "Panel scorecard";
  return `${record.response.profileName || record.response.persona.replaceAll("-", " ")} review${record.angle ? ` · ${record.angle.headline}` : ""}`;
}
export function resultCommand(record: SavedResult): string {
  return record.kind === "offer" ? "/artifact" : record.kind === "angles" ? "/angles" : record.kind === "kit" ? "/kit" : record.kind === "panel" ? "/scorecard" : `/${record.response.persona}`;
}
