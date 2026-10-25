import test from "node:test";
import assert from "node:assert/strict";
import { calculateScorecard, scorePersona } from "../lib/scorecard";
import { ensureLandingArtifact, ensurePersonaResponse } from "../lib/agents/validation";
import { juryPatch } from "../lib/jury-state";
import type { PersonaId, PersonaResponse, SessionContext } from "../lib/types";
const review = (persona: PersonaId, scores = { willingness_to_try: 4, price_resistance: 2, trust: 4 }): PersonaResponse => ({ persona, steelman: "A clear workflow benefit.", objection: "Switching effort needs testing.", evidence_needed: "Observe a real migration.", reasoning_trace: ["The offer addresses a stated problem.", "No migration has been observed."], scores, risk_category: "switching", recommendation: "test", next_step: "Run a migration with one qualifying user.", assumptions: [] });
test("price resistance keeps raw semantics and reverses only favorable aggregation", () => {
  const low = review("analyst", { willingness_to_try: 4, price_resistance: 1, trust: 4 });
  const high = review("skeptic", { willingness_to_try: 4, price_resistance: 5, trust: 4 });
  assert.ok(scorePersona(low)! > scorePersona(high)!);
  const scorecard = calculateScorecard([high]);
  assert.equal(scorecard.rows[1].average, 5); assert.equal(scorecard.rows[1].favorableAverage, 1);
  assert.equal(scorecard.mainObjection, "price_resistance");
});
test("one juror and all failures cannot manufacture agreement or zero scores", () => {
  assert.equal(calculateScorecard([review("analyst")]).verdict, "INSUFFICIENT DATA");
  const empty = calculateScorecard([], ["analyst", "skeptic"]);
  assert.equal(empty.verdict, "PARTIAL"); assert.equal(empty.rows[0].average, null); assert.equal(empty.strongestAudience, null);
});
test("matching negative assessments may agree while remaining negative", () => {
  const negative = { willingness_to_try: 1, price_resistance: 5, trust: 1 };
  const card = calculateScorecard([review("analyst", negative), review("skeptic", negative)]);
  assert.equal(card.verdict, "QUORUM"); assert.equal(card.rows[0].average, 1);
});
test("unknowns, missing panel members and malformed scores remain visible", () => {
  const unknown = { ...review("analyst"), scores: { willingness_to_try: 4, price_resistance: null, trust: 4 } };
  assert.equal(scorePersona(unknown), null);
  assert.equal(calculateScorecard([unknown, review("skeptic")]).verdict, "INSUFFICIENT DATA");
  const partial = calculateScorecard([review("analyst")], ["analyst", "skeptic"]);
  assert.deepEqual(partial.missingPersonas, ["skeptic"]);
  const invalid = { ...review("skeptic"), scores: { willingness_to_try: 99, price_resistance: 2, trust: 4 } };
  assert.equal(calculateScorecard([invalid]).completedCount, 0);
});
test("disagreement and typed risk retain actual categories instead of keyword guesses", () => {
  const card = calculateScorecard([review("analyst"), review("skeptic", { willingness_to_try: 1, price_resistance: 5, trust: 1 })]);
  assert.equal(card.verdict, "NO QUORUM"); assert.equal(card.biggestRiskCategory, "switching"); assert.ok(card.rows[0].standardDeviation! > 0);
});
test("strict review contract rejects blank text, strings, range errors and contradictory unknowns", () => {
  for (const change of [{ steelman: " " }, { scores: { willingness_to_try: "4", price_resistance: 2, trust: 4 } }, { scores: { willingness_to_try: 0, price_resistance: 2, trust: 4 } }, { reasoning_trace: ["only one"] }, { risk_category: "vibes" }, { scores: { willingness_to_try: null, price_resistance: null, trust: null } }]) assert.throws(() => ensurePersonaResponse({ ...review("analyst"), ...change }, "analyst"));
  assert.equal(ensurePersonaResponse({ ...review("analyst"), scores: { willingness_to_try: null, price_resistance: null, trust: null }, recommendation: "insufficient_information" }, "analyst").scores.trust, null);
});
test("targeted retry preserves completed results, removes only resolved failure and never duplicates", () => {
  let context: SessionContext = { sessionId: "test-project-12345", personas: ["analyst", "skeptic"], jury: [review("analyst")], failures: [{ persona: "skeptic", error: "timeout" }] };
  context = { ...context, ...juryPatch(context, ["skeptic"], review("skeptic")) };
  context = { ...context, ...juryPatch(context, ["skeptic"], review("skeptic")) };
  assert.equal(context.jury?.length, 2); assert.equal(context.failures?.length, 0); assert.equal(context.scorecard?.verdict, "QUORUM");
  context = { ...context, ...juryPatch(context, ["skeptic"], { persona: "skeptic", error: "offline" }) };
  assert.equal(context.jury?.length, 2); assert.equal(context.scorecard?.completedCount, 1); assert.equal(context.scorecard?.verdict, "PARTIAL");
});
test("artifact sandbox contract strips active content and forbids network/form execution", () => {
  const artifact = ensureLandingArtifact({ title: "Offer", headline: "Test", keyClaims: ["A proposal"], html: '<html><head></head><body><script>alert(1)</script><iframe src="https://bad.example"></iframe><img src="https://bad.example" onerror="alert(1)"><form action="https://bad.example"><a href="javascript:alert(1)">Join</a></form></body></html>' });
  assert.doesNotMatch(artifact.html, /<script|<iframe|onerror=|src=|javascript:/i);
  assert.match(artifact.html, /default-src 'none'/); assert.match(artifact.html, /form-action 'none'/);
});
