import type { SessionContext } from "./types";
import type { Evidence, EvidenceDecision, Experiment, Hypothesis, Interview } from "./evidence-types";
import { isDemoRecord } from "./demo-records";

export function textField(value: unknown, label: string, max = 2000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label} is required and must be at most ${max} characters.`);
  return value.trim();
}
export function idField(value: unknown): string {
  const id = textField(value, "Record id", 100);
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(id)) throw new Error("Invalid record id.");
  return id;
}
function dateField(value: unknown): string {
  const date = textField(value, "Collection date", 40);
  if (!Number.isFinite(Date.parse(date)) || Date.parse(date) > Date.now() + 86400000) throw new Error("Use a valid collection date that is not in the future.");
  return new Date(date).toISOString();
}
function count(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > 10000000) throw new Error(`${label} must be a whole number of at least ${minimum}.`);
  return value;
}
export function ensureHypothesis(value: unknown): Hypothesis {
  const h = value as Hypothesis;
  return { id: idField(h?.id), claim: textField(h?.claim, "Assumption", 800), createdAt: new Date().toISOString() };
}
export function ensureEvidence(value: unknown, context: SessionContext): Evidence {
  const e = value as Evidence;
  if (!context.hypotheses?.some(h => h.id === e?.hypothesisId)) throw new Error("Choose a stored assumption.");
  if (!["research", "customer_statement", "observed_behavior", "commitment"].includes(e.kind)) throw new Error("Choose an evidence category.");
  if (!["supports", "contradicts", "mixed"].includes(e.direction)) throw new Error("Choose the evidence direction.");
  return { id: idField(e.id), hypothesisId: e.hypothesisId, kind: e.kind, direction: e.direction, summary: textField(e.summary, "Observation"), source: textField(e.source, "Source or collection context", 1000), excerpt: e.excerpt ? textField(e.excerpt, "Excerpt", 4000) : undefined, collectedAt: dateField(e.collectedAt), sampleSize: e.sampleSize === undefined ? undefined : count(e.sampleSize, "Sample size", 1), limitations: textField(e.limitations, "Limitations"), provenance: "founder_reported", ...(isDemoRecord(e) ? { demo: true } : {}) };
}
export function ensureInterview(value: unknown, context: SessionContext): Interview {
  const i = value as Interview;
  if (!context.hypotheses?.some(h => h.id === i?.hypothesisId)) throw new Error("Choose a stored assumption.");
  if (i.consent !== true) throw new Error("Confirm permission to store these notes and send them to the configured AI provider.");
  return { id: idField(i.id), hypothesisId: i.hypothesisId, participant: textField(i.participant, "Participant alias", 100), transcript: textField(i.transcript, "Interview notes", 16000), collectedAt: dateField(i.collectedAt), consent: true, ...(isDemoRecord(i) ? { demo: true } : {}) };
}
export function ensureExperiment(value: unknown, context: SessionContext): Experiment {
  const e = value as Experiment;
  if (!context.hypotheses?.some(h => h.id === e?.hypothesisId)) throw new Error("Choose a stored assumption.");
  const minimumSample = count(e.minimumSample, "Minimum sample", 1);
  const target = count(e.target, "Required commitments", 1);
  if (target > minimumSample) throw new Error("Required commitments cannot exceed the planned sample.");
  return { id: idField(e.id), hypothesisId: e.hypothesisId, name: textField(e.name, "Experiment name", 200), method: textField(e.method, "Method"), metric: textField(e.metric, "What counts as a commitment", 600), target, minimumSample, status: "planned", createdAt: new Date().toISOString(), ...(isDemoRecord(e) ? { demo: true } : {}) };
}
export function recordExperiment(experiment: Experiment, value: unknown): Experiment {
  const v = value as Experiment;
  const sampleSize = count(v.sampleSize, "Observed sample");
  const successes = count(v.successes, "Observed commitments");
  if (successes > sampleSize) throw new Error("Commitments cannot exceed the observed sample.");
  const observedAt = dateField(v.observedAt);
  if (observedAt.slice(0, 10) < experiment.createdAt.slice(0, 10)) throw new Error("The result date predates the saved experiment plan. Record it as historical evidence instead.");
  return { ...experiment, status: "recorded", sampleSize, successes, observedAt, limitations: textField(v.limitations, "Collection method and limitations"), ...(isDemoRecord(experiment) || isDemoRecord(v) ? { demo: true } : {}) };
}

/** A transparent decision rule, never an AI probability or proof of product-market fit. */
function evaluate(context: SessionContext, includeDemo: boolean): EvidenceDecision {
  const evidence = (context.evidence ?? []).filter(e => includeDemo || !isDemoRecord(e));
  const coverage = { research: 0, customer_statement: 0, observed_behavior: 0, commitment: 0 };
  evidence.forEach(e => coverage[e.kind]++);
  const limitations = ["Founder-entered observations are not independently verified.", "Counts describe records, not independent participants or statistical confidence."];
  if (includeDemo) limitations.unshift("Synthetic demo rehearsal only. Fictional observations and outcomes do not establish real validation.");
  else if (context.evidence?.some(isDemoRecord) || context.experiments?.some(isDemoRecord)) limitations.push("Scripted demo observations and experiments are excluded from this real-evidence decision.");
  const base = { evidenceIds: evidence.map(e => e.id), coverage, limitations };
  if (!context.hypotheses?.length) return { ...base, status: "INSUFFICIENT EVIDENCE", rationale: "There is no explicit assumption to evaluate.", nextStep: "Record the customer behavior that must be true for this idea to work." };
  const contradictions = evidence.filter(e => e.direction === "contradicts" && e.kind !== "research");
  const unresolved = context.hypotheses.filter(h => !evidence.some(e => e.hypothesisId === h.id && e.direction === "supports" && (e.kind === "observed_behavior" || e.kind === "commitment")));
  const completed = (context.experiments ?? []).filter(e => (includeDemo || !isDemoRecord(e)) && e.status === "recorded" && (e.sampleSize ?? 0) >= e.minimumSample);
  const failed = completed.filter(e => (e.successes ?? 0) < e.target);
  if (failed.length && contradictions.length) return { ...base, status: "PIVOT", rationale: "A prespecified test missed its threshold and direct evidence contradicts an assumption.", nextStep: "Review the contradictory records. Change the assumption or audience before committing more resources." };
  if (contradictions.length || failed.length) return { ...base, status: "ITERATE", rationale: "Observed objections or a missed test threshold need attention.", nextStep: "Inspect the conflicting evidence and change one part of the offer before repeating the test." };
  if (evidence.some(e => e.kind === "research" && e.direction === "contradicts") || evidence.some(e => e.direction === "mixed" && e.kind !== "research")) return { ...base, status: "TEST", rationale: "Contradicting research or mixed direct observations remain unresolved. Inspect their relevance before committing to a build milestone.", nextStep: "Review the original conflicting sources and design a test that distinguishes the competing explanations." };
  const passed = completed.filter(e => (e.successes ?? 0) >= e.target);
  if (!unresolved.length && passed.length && evidence.some(e => e.kind === "commitment" && e.direction === "supports" && passed.some(p => p.hypothesisId === e.hypothesisId))) return { ...base, status: "BUILD", rationale: "Reported commitments and a prespecified test support a bounded next milestone. This is not market validation.", nextStep: "Define the smallest deliverable for the people who committed; keep measuring whether they use it." };
  return { ...base, status: "TEST", rationale: evidence.length ? "The current records do not yet justify a development milestone. Research and interviews help explain a problem; they do not establish demand." : "AI reviews are hypotheses. No real-world evidence has been recorded.", nextStep: `Test: ${unresolved[0]?.claim ?? context.hypotheses[0].claim}. Record the method and pass/fail threshold before collecting results.` };
}

export function evaluateEvidence(context: SessionContext): EvidenceDecision { return evaluate(context, false); }
/** Display-only replay. Project decision/history/sharing always use evaluateEvidence. */
export function evaluateDemoRehearsal(context: SessionContext): EvidenceDecision { return evaluate(context, true); }
