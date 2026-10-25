import test from "node:test";
import assert from "node:assert/strict";
import { parseSearchSources, publicSourceUrl, searchSources, validateOpportunities, validateSuppliedSources } from "../lib/research";
import { knowledgeContext, retrieveKnowledge } from "../lib/knowledge";
const sources = validateSuppliedSources([{ title: "Clinic workflow report", url: "https://example.org/report", excerpt: "The clinic manager reports spending three hours each week re-entering appointments from paper notes." }]);
const opportunity = { title: "Test scheduling", problem: "A reported administrative cost", customer: "Clinic manager", observations: [{ statement: "This manager describes re-entry work", sourceId: "source-1", excerpt: "spending three hours each week" }], inference: "Some similar clinics may have this issue", alternatives: ["Paper notes, as reported"], approach: "Test import workflow", mvp: "Manual concierge import", complexity: "low", capabilities: ["CSV import"], assumptions: ["Clinics will commit to a trial"], firstExperiment: "Observe one real workflow", limitations: "One unverified excerpt; prevalence and payment unknown", whyNow: "Small scope but incumbent alternatives may be sufficient" };
test("source identifiers and quotations cannot be invented by synthesis", () => {
  assert.equal(validateOpportunities({ opportunities: [opportunity] }, sources).length, 1);
  assert.throws(() => validateOpportunities({ opportunities: [{ ...opportunity, observations: [{ ...opportunity.observations[0], sourceId: "fake" }] }] }, sources));
  assert.throws(() => validateOpportunities({ opportunities: [{ ...opportunity, observations: [{ ...opportunity.observations[0], excerpt: "Every clinic will buy this product" }] }] }, sources));
});
test("supplied excerpts stay explicitly unverified and reject executable/private-looking URLs", () => {
  assert.equal(sources[0].provenance, "user_supplied"); assert.match(sources[0].limitations, /not fetched/);
  for (const url of ["javascript:alert(1)", "http://example.com", "https://127.0.0.1", "https://local.internal", "https://user:password@example.org"]) assert.throws(() => publicSourceUrl(url));
});
test("search parser deduplicates sources and excludes unusable snippets", () => {
  const raw = { title: "Report", url: "https://example.org/report", content: sources[0].excerpt };
  assert.equal(parseSearchSources({ results: [raw, raw, { ...raw, url: "https://127.0.0.1" }] }).length, 1);
});
test("missing retrieval configuration yields an honest error with no generated substitute", async () => {
  const saved = process.env.TAVILY_API_KEY; delete process.env.TAVILY_API_KEY;
  try { await assert.rejects(searchSources({ domain: "clinic workflow" }), /not configured/); }
  finally { if (saved) process.env.TAVILY_API_KEY = saved; }
});
test("retrieval changes with project sources and never reads another project's private material", () => {
  const project = { sessionId: "project-123456789", idea: "clinic appointments", discovery: { sources, opportunities: [] } };
  assert.ok(retrieveKnowledge(project, "jury").some(e => e.id === "source-1"));
  assert.doesNotMatch(knowledgeContext({ sessionId: "other-project-12345", idea: "coffee" }, "jury"), /three hours/);
  assert.match(knowledgeContext(project, "jury"), /untrusted_retrieved_context/);
});
