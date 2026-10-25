import { PERSONAS, RISK_CATEGORIES, type Dimension, type PersonaId, type PersonaResponse, type RiskCategory, type Scorecard } from "./types";

export const QUORUM_AVERAGE_SPREAD_THRESHOLD = 1;
export const SCORING_RUBRIC_VERSION = "2.0";

export const DIMENSIONS: Array<{ key: Dimension; label: string; direction: "higher" | "lower" }> = [
  { key: "willingness_to_try", label: "Willingness to try", direction: "higher" },
  { key: "price_resistance", label: "Price resistance", direction: "lower" },
  { key: "trust", label: "Trust", direction: "higher" },
];

export const RISK_LABELS: Record<RiskCategory, string> = {
  value: "Unclear practical value",
  pricing: "Price or budget friction",
  trust: "Insufficient proof or trust",
  switching: "Weak reason to switch",
  adoption: "Adoption or learning friction",
  feasibility: "Unproven delivery feasibility",
  evidence: "Missing evidence",
};

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
export const isValidScore = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
const favorable = (dimension: Dimension, value: number) => dimension === "price_resistance" ? 6 - value : value;

/** A missing dimension never becomes an invented midpoint or a flattering partial average. */
export function scorePersona(response: PersonaResponse): number | null {
  if (!DIMENSIONS.every(({ key }) => isValidScore(response.scores?.[key]))) return null;
  return average(DIMENSIONS.map(({ key }) => favorable(key, response.scores[key] as number)));
}

export function calculateScorecard(responses: PersonaResponse[], requestedPersonas?: PersonaId[]): Scorecard {
  const requested = [...new Set(requestedPersonas ?? responses.map((response) => response.persona))];
  // Exclude malformed records and unrequested jurors. Last valid result for a persona wins.
  const valid = new Map<PersonaId, PersonaResponse>();
  for (const response of responses) {
    if (!response || !PERSONAS.includes(response.persona) || !requested.includes(response.persona)) continue;
    if (!DIMENSIONS.every(({ key }) => response.scores?.[key] === null || isValidScore(response.scores?.[key]))) continue;
    valid.set(response.persona, response);
  }
  const completed = requested.flatMap((persona) => valid.has(persona) ? [valid.get(persona)!] : []);
  const missingPersonas = requested.filter((persona) => !valid.has(persona));
  const rows = DIMENSIONS.map(({ key }) => {
    const values = completed.map((response) => response.scores[key]).filter(isValidScore);
    const mean = values.length ? average(values) : null;
    return {
      dimension: key,
      scores: Object.fromEntries(requested.map((persona) => [persona, valid.get(persona)?.scores[key] ?? null])),
      average: mean,
      favorableAverage: mean === null ? null : favorable(key, mean),
      spread: values.length >= 2 ? Math.max(...values) - Math.min(...values) : null,
      standardDeviation: values.length >= 2 ? Math.sqrt(average(values.map((value) => (value - mean!) ** 2))) : null,
      scoredCount: values.length,
      unknownCount: completed.length - values.length,
    };
  });
  const comparableRows = rows.filter((row) => row.favorableAverage !== null);
  const mainObjection = [...comparableRows].sort((a, b) =>
    a.favorableAverage! - b.favorableAverage! || (b.spread ?? 0) - (a.spread ?? 0),
  )[0]?.dimension ?? null;
  const ranked = completed.flatMap((response) => {
    const score = scorePersona(response);
    return score === null ? [] : [{ response, score }];
  }).sort((a, b) => b.score - a.score);
  const spreads = rows.map((row) => row.spread).filter((value): value is number => value !== null);
  const averageSpread = spreads.length === DIMENSIONS.length ? average(spreads) : null;
  const unknownScoreCount = rows.reduce((sum, row) => sum + row.unknownCount, 0);
  const splitDimensions = rows.filter((row) => row.spread !== null && row.spread >= QUORUM_AVERAGE_SPREAD_THRESHOLD).map((row) => row.dimension);
  const verdict = missingPersonas.length
    ? "PARTIAL"
    : completed.length < 2 || unknownScoreCount || averageSpread === null
      ? "INSUFFICIENT DATA"
      : averageSpread < QUORUM_AVERAGE_SPREAD_THRESHOLD ? "QUORUM" : "NO QUORUM";
  const riskCounts = RISK_CATEGORIES.map((category) => ({
    category, count: completed.filter((response) => response.risk_category === category).length,
  })).sort((a, b) => b.count - a.count);
  const biggestRiskCategory = riskCounts[0]?.count ? riskCounts[0].category : null;

  return {
    rows, averageSpread, mainObjection,
    strongestAudience: ranked[0]?.response.persona ?? null,
    biggestRisk: biggestRiskCategory ? `${RISK_LABELS[biggestRiskCategory]}: ${completed.find(r => r.risk_category === biggestRiskCategory)?.objection ?? "Inspect the related review."}` : "No classified risk assessment available",
    biggestRiskCategory, verdict, splitDimensions,
    completedCount: completed.length,
    requestedCount: requested.length,
    requestedPersonas: requested,
    missingPersonas,
    unknownScoreCount,
    rubricVersion: SCORING_RUBRIC_VERSION,
  };
}
