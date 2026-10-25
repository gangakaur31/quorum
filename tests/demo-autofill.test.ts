import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEMO_SCENARIO, demoCommandForms, demoOffer, demoSourceText } from "../lib/demo-scenario";
import { ensureEvidence, ensureExperiment, ensureHypothesis, ensureInterview, evaluateEvidence, evaluateDemoRehearsal, recordExperiment } from "../lib/evidence";
import { ensureLegalProfile } from "../lib/legal";
import { importDocument } from "../lib/knowledge-ingest";
import { validateConstraints } from "../lib/research";
import { DiscoverWorkspace } from "../components/discover-workspace";
import { EvidenceWorkspace } from "../components/evidence-workspace";
import { KnowledgeWorkspace } from "../components/knowledge-workspace";
import { LegalWorkspace } from "../components/legal-workspace";
import { Dashboard } from "../components/dashboard";
import type { SessionContext } from "../lib/types";

const empty: SessionContext = { sessionId: "internal-demo-test-project", accessToken: "internal-demo-test-key" };
const hypothesis = ensureHypothesis({ id: crypto.randomUUID(), claim: DEMO_SCENARIO.assumption });
const context: SessionContext = { ...empty, hypotheses: [hypothesis] };

test("the central founder scenario maps to the actual idea, constraint, profile and experiment schemas", () => {
  const offer = demoOffer(); assert.match(offer.input, /ScopeSignal/); assert.match(offer.assumptions.targetAudience!, /5-30/); assert.match(offer.assumptions.price!, /unvalidated pricing/);
  const discover = demoCommandForms("discover", context).discover!;
  assert.doesNotThrow(() => validateConstraints(discover)); assert.equal(discover.sourceMode, "live"); assert.match(String(discover.url), /atlassian.com/); assert.ok(String(discover.excerpt).length >= 30);
  const profile = demoCommandForms("perspectives", context).perspective!; assert.equal(profile.role, "budget-conscious"); assert.match(String(profile.profile), /Fictional/);
  const plan = demoCommandForms("experiments", context).experiment!;
  const experiment = ensureExperiment({ ...plan, id: crypto.randomUUID(), target: Number(plan.target), minimumSample: Number(plan.minimumSample) }, context);
  assert.equal(experiment.minimumSample, 8); assert.equal(experiment.target, 4); assert.equal(experiment.successes, undefined); assert.equal(experiment.observedAt, undefined); assert.equal(experiment.status, "planned");
  assert.match(experiment.metric, /previous 30 days/); assert.equal(experiment.demo, true);
});

test("complete scripted records validate, remain marked demo and cannot influence real decisions", () => {
  const evidence = demoCommandForms("evidence", context).observation!, notes = demoCommandForms("interviews", context).interview!;
  for (const key of ["summary", "source", "excerpt", "collectedAt", "sampleSize", "limitations"]) assert.ok(evidence[key]);
  const saved = ensureEvidence({ ...evidence, id: crypto.randomUUID(), sampleSize: Number(evidence.sampleSize) }, context);
  const interview = ensureInterview({ ...notes, id: crypto.randomUUID() }, context);
  assert.equal(saved.demo, true); assert.equal(interview.demo, true); assert.equal(interview.consent, true);
  assert.ok(interview.transcript.includes(saved.excerpt!)); assert.match(interview.participant, /DEMO/);
  const populated = { ...context, evidence: [saved], interviews: [interview] };
  assert.equal(evaluateEvidence(populated).status, "TEST"); assert.equal(evaluateEvidence(populated).coverage.customer_statement, 0);
  assert.equal(evaluateDemoRehearsal(populated).status, "ITERATE");
  const plan = demoCommandForms("experiments", context).experiment!;
  const experiment = ensureExperiment({ ...plan, id: crypto.randomUUID(), target: Number(plan.target), minimumSample: Number(plan.minimumSample) }, context);
  const results = demoCommandForms("experiments", { ...context, experiments: [experiment] })[`experiment-result-${experiment.id}`]!;
  const recorded = recordExperiment(experiment, { ...results, successes: Number(results.successes), sampleSize: Number(results.sampleSize) });
  assert.equal(recorded.demo, true); assert.equal(recorded.successes, 3); assert.equal(recorded.sampleSize, 8);
  assert.equal(evaluateEvidence({ ...context, experiments: [recorded] }).status, "TEST");
  assert.equal(evaluateDemoRehearsal({ ...context, experiments: [recorded] }).status, "ITERATE");
  assert.equal(evaluateDemoRehearsal({ ...populated, experiments: [recorded] }).status, "PIVOT");
  assert.equal(demoCommandForms("experiments", context).live?.confirmPublic, true);
});

test("the authored source pack and concrete legal preparation require no invented external authority", () => {
  const record = demoCommandForms("knowledge", context)["knowledge-import"]!;
  assert.equal(record.consent, true); assert.match(String(record.url), /example.com/); assert.ok(record.publishedAt);
  const imported = importDocument(record); assert.equal(imported.content, demoSourceText()); assert.match(imported.limitations, /fictional/);
  assert.equal(imported.tasks.includes("legal"), false);
  const legal = demoCommandForms("legal", context)["legal-profile"]!;
  const profile = ensureLegalProfile({ product: legal.legalProduct, home: legal.legalHome, markets: legal.legalMarket, locationDetails: legal.legalLocationDetails, sector: legal.legalSector, activities: legal.legalActivity });
  assert.equal(profile.home, "india"); assert.deepEqual(profile.markets, ["india"]); assert.match(profile.locationDetails, /Karnataka/);
});

test("autofill mappings are independent mutable drafts and never mutate project records", () => {
  const before = structuredClone(context), first = demoCommandForms("knowledge", context);
  (first["knowledge-import"]!.tasks as string[]).push("invalid"); first["knowledge-import"]!.title = "changed";
  const again = demoCommandForms("knowledge", context);
  assert.notEqual(again["knowledge-import"]!.title, "changed"); assert.ok(!(again["knowledge-import"]!.tasks as string[]).includes("invalid")); assert.deepEqual(context, before);
});

test("example preparation never links an unrelated project's assumption", () => {
  const unrelated = { ...empty, hypotheses: [ensureHypothesis({ id: crypto.randomUUID(), claim: "Cyclists need lighter helmets" })] };
  assert.equal(demoCommandForms("experiments", unrelated).experiment?.hypothesisId, "");
  assert.equal(demoCommandForms("interviews", unrelated).interview?.hypothesisId, "");
});

test("fresh input commands render one top-level type=button autofill control and no scenario values or API calls", () => {
  const realFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Rendering must not call an API"); };
  try {
    const props = { context: empty, onContext: () => {} };
    const screens = [createElement(DiscoverWorkspace, { ...props, onUse: () => {} }), ...(["evidence", "interviews", "experiments", "perspectives"] as const).map(workspace => createElement(EvidenceWorkspace, { ...props, workspace })), createElement(KnowledgeWorkspace, props), createElement(LegalWorkspace, props), createElement(Dashboard, { onExit: () => {} })];
    for (const screen of screens) {
      const html = renderToStaticMarkup(screen);
      assert.equal((html.match(/aria-label="Fill example data"/g) ?? []).length, 1);
      assert.match(html, /type="button"[^>]*class="demo-autofill-button"/);
      assert.doesNotMatch(html, /value="ScopeSignal|value="Agency owners may struggle|ScopeSignal sample drafts filled/);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = realFetch; }
});

test("read-only command views render no autofill control", () => {
  const html = renderToStaticMarkup(createElement(EvidenceWorkspace, { context: empty, onContext: () => {}, workspace: "decision" }));
  assert.doesNotMatch(html, /Demo Autofill|Fill example data/);
});
