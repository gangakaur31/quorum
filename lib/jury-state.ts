import { calculateScorecard } from "./scorecard";
import type { PersonaFailure, PersonaId, PersonaResponse, SessionContext } from "./types";

export function mergeByPersona<T extends { persona: PersonaId }>(existing: T[], incoming: T[]): T[] {
  const merged = new Map(existing.map((entry) => [entry.persona, entry]));
  for (const entry of incoming) merged.set(entry.persona, entry);
  return [...merged.values()];
}

/** Pure patch builder used inside the store's atomic update, including targeted retries. */
export function juryPatch(
  current: SessionContext,
  requested: PersonaId[],
  result?: PersonaResponse | PersonaFailure,
  angleId?: string,
): Partial<SessionContext> {
  const previous = angleId ? current.marketingRuns?.[angleId] : undefined;
  const oldResponses = angleId ? previous?.responses ?? [] : current.jury ?? [];
  const oldFailures = angleId ? previous?.failures ?? [] : current.failures ?? [];
  const oldPersonas = angleId ? previous?.personas ?? [] : current.personas ?? [];
  const personas = [...new Set([...oldPersonas, ...oldResponses.map((response) => response.persona), ...requested])];
  const success = result && "scores" in result ? result : undefined;
  const failure = result && "error" in result ? result : undefined;
  const responses = success ? mergeByPersona(oldResponses, [success]) : oldResponses;
  const failures = failure ? mergeByPersona(oldFailures, [failure])
    : success ? oldFailures.filter((item) => item.persona !== success.persona) : oldFailures;
  // A previous valid review survives a failed retry for inspection, but is not passed off as
  // a valid result of the latest evaluation. The failure remains visible until a valid retry.
  const validResponses = responses.filter((response) => (response.contextRevision ?? 0) === (current.evaluationRevision ?? 0) && !failures.some((item) => item.persona === response.persona));
  const scorecard = calculateScorecard(validResponses, personas);
  if (angleId) return {
    marketingRuns: { ...current.marketingRuns, [angleId]: { responses, failures, personas, scorecard } },
  };
  return { personas, jury: responses, failures, scorecard, confidenceGate: undefined };
}
