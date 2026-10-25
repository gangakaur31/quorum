import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { demoCommandForms, demoOffer, DEMO_SCENARIO } from "../lib/demo-scenario";
import { ensureLandingArtifact } from "../lib/agents/validation";
import { normalizeGeneratedCopy, withoutEmDashes } from "../lib/typography";
import { ensureEvidence, evaluateEvidence, evaluateDemoRehearsal } from "../lib/evidence";
import type { Evidence, Experiment } from "../lib/evidence-types";
import { importDocument } from "../lib/knowledge-ingest";
import { retrieveSnapshot } from "../lib/knowledge";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LiveOffer } from "../components/live-offer";

test("website source copy and every mapped demo field contain no em dash", () => {
  const dash = String.fromCharCode(8212);
  const files = (root: string): string[] => readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(root, entry.name)) : [path.join(root, entry.name)]);
  for (const file of ["app", "components", "lib"].flatMap(files).filter(file => /\.(tsx?|css)$/.test(file))) assert.ok(!readFileSync(file, "utf8").includes(dash), file);
  assert.ok(!JSON.stringify(demoOffer()).includes(dash));
  for (const command of ["discover", "evidence", "interviews", "experiments", "perspectives", "knowledge", "legal"] as const) assert.ok(!JSON.stringify(demoCommandForms(command, { sessionId: "test" })).includes(dash));
});
test("generated copy and HTML entities are normalized while exact source quotations remain unchanged", () => {
  const original = `Exact source${String.fromCharCode(8212)}statement`;
  assert.equal(withoutEmDashes("Hello &mdash; world &#8212; test &#x2014; done"), "Hello - world - test - done");
  assert.deepEqual(normalizeGeneratedCopy({ headline: original, quote: original, nested: [{ text: original }], excerpt: original }), { headline: "Exact source - statement", quote: original, nested: [{ text: "Exact source - statement" }], excerpt: original });
});
test("artifact anchors keep useful local navigation while remote links, scripts and handlers stay blocked", () => {
  const artifact = ensureLandingArtifact({ title: "Offer", headline: "Clear sign-off", keyClaims: ["Proposed workflow"], html: '<html><head></head><body><a href="#workflow">Workflow</a><a href="#artifact-cta">Explore</a><a href="https://outside.invalid">Outside</a><a href="javascript:alert(1)" onclick="alert(1)">Bad</a><script>alert(1)</script><section id="workflow">One &mdash; record</section><section id="artifact-cta">Concept preview</section></body></html>' });
  assert.ok(artifact.html.includes('href="#workflow"')); assert.ok(artifact.html.includes('id="artifact-cta"'));
  assert.doesNotMatch(artifact.html, /outside\.invalid|javascript:|onclick|<script|&mdash;/); assert.match(artifact.html, /Content-Security-Policy/);
  assert.ok(demoOffer().input.length < 6000); assert.match(DEMO_SCENARIO.designBrief, /Illustrative workflow/);
});
test("explicit demo markers cannot be laundered into real evidence by dropping the flag", () => {
  const context = { sessionId: "test", hypotheses: [{ id: crypto.randomUUID(), claim: DEMO_SCENARIO.assumption, createdAt: new Date().toISOString() }] };
  const fields = demoCommandForms("evidence", context).observation!;
  const record = ensureEvidence({ ...fields, demo: false, id: crypto.randomUUID(), sampleSize: 1 }, context);
  assert.equal(record.demo, true); assert.equal(evaluateEvidence({ ...context, evidence: [record] }).coverage.customer_statement, 0);
});
test("escaped layout newlines cannot become grid children and the design foundation is idempotent", () => {
  const input = { title: "Concept", headline: "Clear approval", keyClaims: ["Proposed workflow"], html: '<html><head></head><body class="q-page"><section class="q-hero">\\n<div>Copy</div>\\n<div>Mockup</div>\\n</section><pre>Use \\n for a newline</pre></body></html>' };
  const first = ensureLandingArtifact(input), again = ensureLandingArtifact(first);
  assert.ok(first.html.includes('<section class="q-hero">\n<div>'));
  assert.ok(first.html.includes('<pre>Use \\n for a newline</pre>'));
  assert.equal((again.html.match(/<style data-quorum-design>/g) ?? []).length, 1);
  assert.match(again.html, /grid-template-columns:1.1fr 1fr/);
});
test("the demo question's location filter includes its own authored research pack", () => {
  const forms = demoCommandForms("knowledge", { sessionId: "demo-test" });
  const document = importDocument(forms["knowledge-import"]!);
  const question = forms["knowledge-ask"]!;
  const snapshot = retrieveSnapshot({ sessionId: "demo-test", knowledgeDocuments: [document] }, "knowledge", { query: String(question.question), region: question.locationFilter as "india" });
  assert.ok(snapshot.passages.some(passage => passage.id === document.id));
});
test("synthetic successes cannot authorize BUILD and synthetic failures cannot downgrade real evidence", () => {
  const timestamp = new Date().toISOString(), hypothesisId = crypto.randomUUID();
  const context = { sessionId: "test", hypotheses: [{ id: hypothesisId, claim: DEMO_SCENARIO.assumption, createdAt: timestamp }] };
  const records: Evidence[] = (["observed_behavior", "commitment"] as const).map(kind => ({ id: crypto.randomUUID(), hypothesisId, kind, direction: "supports", summary: "Documented bounded action", source: "Owner's source record", collectedAt: timestamp, limitations: "Founder report; inspect original", provenance: "founder_reported" }));
  const experiment: Experiment = { id: crypto.randomUUID(), hypothesisId, name: "Bounded test", method: "Prespecified recruitment", metric: "Concrete commitment", minimumSample: 8, target: 4, successes: 4, sampleSize: 8, status: "recorded", createdAt: timestamp, observedAt: timestamp, limitations: "Small sample" };
  const synthetic = { ...context, evidence: records.map(record => ({ ...record, demo: true })), experiments: [{ ...experiment, demo: true }] };
  assert.equal(evaluateEvidence(synthetic).status, "TEST"); assert.equal(evaluateDemoRehearsal(synthetic).status, "BUILD");
  assert.equal(evaluateEvidence({ ...context, evidence: records, experiments: [experiment, { ...experiment, id: crypto.randomUUID(), demo: true, successes: 0 }] }).status, "BUILD");
});
test("public contact autofill is limited to demo experiments and starts with empty defaults", () => {
  const props = { publicId: "test-id", objective: "interview" as const, disclosure: "Test disclosure" };
  const live = renderToStaticMarkup(createElement(LiveOffer, props));
  const demo = renderToStaticMarkup(createElement(LiveOffer, { ...props, demo: true }));
  assert.equal((demo.match(/aria-label="Fill example data"/g) ?? []).length, 1);
  assert.doesNotMatch(live, /Demo Autofill/); assert.doesNotMatch(demo, /value="scopesignal-demo/);
});
