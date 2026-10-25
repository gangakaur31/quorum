import test from "node:test";
import assert from "node:assert/strict";
import { addContact, addVisit, liveStats } from "../lib/live";
import type { LiveDocument } from "../lib/live-types";
const experiment = (): LiveDocument => ({ publicId: crypto.randomUUID(), projectId: crypto.randomUUID(), hypothesisId: crypto.randomUUID(), title: "Test-only offer", artifact: { title: "Test", headline: "Test", keyClaims: ["Proposal"], html: "<p>Test</p>" }, objective: "interview", disclosure: "Test owner will contact you for research only.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), active: true, visits: [], leads: [] });
const contact = { email: "test@example.org", consent: true, startedAt: Date.now() - 5000, source: "research-test" };
test("live experiments begin with actual zero observations", () => { const stats = liveStats(experiment()); assert.equal(stats.consentingVisits, 0); assert.equal(stats.contacts, 0); assert.equal(stats.matchedContacts, 0); });
test("daily browser visit and email deduplication do not create extra conversions", () => {
  const visitor = crypto.randomUUID();
  const first = addVisit(experiment(), visitor, "source-one");
  const second = addVisit(first.document, visitor, "source-one");
  assert.equal(first.visitId, second.visitId); assert.equal(second.document.visits.length, 1);
  let doc = addContact(second.document, { ...contact, visitId: first.visitId });
  doc = addContact(doc, { ...contact, email: "TEST@EXAMPLE.ORG", visitId: first.visitId });
  doc = addContact(doc, { ...contact, email: "another@example.org", visitId: first.visitId });
  const stats = liveStats(doc); assert.equal(stats.contacts, 2); assert.equal(stats.matchedContacts, 1); assert.equal(stats.consentingVisits, 1);
});
test("nonmeasured contacts do not invent a visit denominator or matched conversion", () => {
  const stats = liveStats(addContact(experiment(), { ...contact, visitId: "made-up" }));
  assert.equal(stats.contacts, 1); assert.equal(stats.consentingVisits, 0); assert.equal(stats.matchedContacts, 0);
});
test("consent, honeypot, timing, email validation and closed state protect capture", () => {
  for (const patch of [{ consent: false }, { website: "spam" }, { startedAt: Date.now() }, { email: "bad" }]) assert.throws(() => addContact(experiment(), { ...contact, ...patch }));
  assert.throws(() => addContact({ ...experiment(), active: false }, contact));
  assert.throws(() => addVisit({ ...experiment(), active: false }, crypto.randomUUID(), "direct"));
});
