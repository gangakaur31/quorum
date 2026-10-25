import test from "node:test";
import assert from "node:assert/strict";
import { ensureEvidence, ensureExperiment, evaluateEvidence, recordExperiment } from "../lib/evidence";
import { validateInterviewSynthesis } from "../lib/interviews";
import type { SessionContext } from "../lib/types";
import type { Evidence, Experiment } from "../lib/evidence-types";
const now = new Date().toISOString();
const base: SessionContext = { sessionId: "test-project-12345", hypotheses: [{ id: "test-hypothesis-12345", claim: "Qualified buyers commit to a pilot", createdAt: now }] };
const observation = (kind: Evidence["kind"], direction: Evidence["direction"] = "supports"): Evidence => ({ id: crypto.randomUUID(), hypothesisId: base.hypotheses![0].id, kind, direction, summary: "Recorded outcome", source: "Founder source", collectedAt: now, limitations: "Small founder-recruited sample", provenance: "founder_reported" });
const experiment: Experiment = { id: "test-experiment-12345", hypothesisId: base.hypotheses![0].id, name: "Pilot", method: "Direct outreach", metric: "Signed pilot", target: 2, minimumSample: 10, createdAt: now, status: "recorded", successes: 2, sampleSize: 10, observedAt: now, limitations: "Convenience sample" };
test("empty state and synthetic enthusiasm never establish demand", () => {
  assert.equal(evaluateEvidence({ sessionId: base.sessionId }).status, "INSUFFICIENT EVIDENCE");
  assert.equal(evaluateEvidence({ ...base, jury: [] }).status, "TEST");
});
test("research and interviews cannot authorize BUILD, including positive large reported samples", () => {
  for (const kind of ["research", "customer_statement"] as const) assert.equal(evaluateEvidence({ ...base, evidence: [{ ...observation(kind), sampleSize: 10000 }], experiments: [experiment] }).status, "TEST");
});
test("behavior alone and below-sample outcomes require another test", () => {
  assert.equal(evaluateEvidence({ ...base, evidence: [observation("observed_behavior")] }).status, "TEST");
  assert.equal(evaluateEvidence({ ...base, evidence: [observation("commitment")], experiments: [{ ...experiment, sampleSize: 3 }] }).status, "TEST");
});
test("bounded build requires support for every assumption and a passed prespecified test with commitment", () => {
  const evidence = [observation("commitment")];
  assert.equal(evaluateEvidence({ ...base, evidence, experiments: [experiment] }).status, "BUILD");
  assert.equal(evaluateEvidence({ ...base, evidence, experiments: [experiment], hypotheses: [...base.hypotheses!, { id: "another-hypothesis-12345", claim: "They renew", createdAt: now }] }).status, "TEST");
});
test("contradiction and missed threshold yield traceable iterate/pivot states", () => {
  assert.equal(evaluateEvidence({ ...base, evidence: [observation("customer_statement", "contradicts")] }).status, "ITERATE");
  assert.equal(evaluateEvidence({ ...base, experiments: [{ ...experiment, successes: 0 }] }).status, "ITERATE");
  assert.equal(evaluateEvidence({ ...base, experiments: [{ ...experiment, successes: 0 }], evidence: [observation("observed_behavior", "contradicts")] }).status, "PIVOT");
});
test("invalid counts, mismatched hypothesis and fabricated provenance fail input contracts", () => {
  assert.throws(() => ensureEvidence({ ...observation("research"), hypothesisId: "missing" }, base));
  const result = ensureEvidence({ ...observation("research"), provenance: "public_experiment" }, base);
  assert.equal(result.provenance, "founder_reported");
  assert.throws(() => ensureExperiment({ ...experiment, target: 20 }, base));
  assert.throws(() => recordExperiment(experiment, { ...experiment, successes: 11, sampleSize: 10 }));
});
test("interview interpretations must point to exact original text", () => {
  const transcript = "Participant A: Last week I spent three hours copying appointments.";
  assert.equal(validateInterviewSynthesis({ findings: [{ quote: "three hours copying appointments", interpretation: "A reported time cost, not proof of buying intent." }] }, transcript).length, 1);
  assert.throws(() => validateInterviewSynthesis({ findings: [{ quote: "I would pay $100", interpretation: "Demand" }] }, transcript));
});
test("contradicting research and unresolved mixed observations block a build milestone", () => {
  for (const conflict of [observation("research", "contradicts"), observation("customer_statement", "mixed")]) assert.equal(evaluateEvidence({ ...base, evidence: [observation("commitment"), conflict], experiments: [experiment] }).status, "TEST");
});
test("historical results cannot be passed off as prespecified experiments", () => {
  assert.throws(() => recordExperiment(experiment, { ...experiment, observedAt: "2020-01-01" }), /predates/);
});
