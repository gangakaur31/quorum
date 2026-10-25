import test from "node:test";
import assert from "node:assert/strict";
import { hasSavedProjectWork, readSavedProjects, rememberProject } from "../lib/project";
import { demoOffer } from "../lib/demo-scenario";
import type { SessionContext } from "../lib/types";

const saved: SessionContext = { sessionId: crypto.randomUUID(), accessToken: crypto.randomUUID(), idea: "Previously saved founder work", updatedAt: new Date().toISOString() };

test("cached projects remain available without becoming the active workspace", () => {
  const raw = JSON.stringify([saved]), projects = readSavedProjects(raw);
  assert.deepEqual(projects, [saved]); assert.equal(raw, JSON.stringify([saved]));
  assert.deepEqual(readSavedProjects("broken JSON"), []);
  assert.deepEqual(readSavedProjects(JSON.stringify([null, { sessionId: "missing-key" }, saved])), [saved]);
  assert.deepEqual(readSavedProjects(JSON.stringify([{ ...saved, updatedAt: "2000-01-01T00:00:00Z" }])), []);
});
test("fresh entry and autofill do not consume saved-project slots or evict old work", () => {
  const projects = Array.from({ length: 20 }, (_, index) => ({ ...saved, sessionId: `saved-project-${index}` }));
  const before = structuredClone(projects);
  for (let index = 0; index < 100; index++) {
    const draft: SessionContext = { sessionId: crypto.randomUUID(), accessToken: crypto.randomUUID() };
    assert.equal(hasSavedProjectWork(draft), false); assert.strictEqual(rememberProject(projects, draft), projects);
    // Autofill supplies separate controlled input state, without altering project context.
    demoOffer(); assert.strictEqual(rememberProject(projects, draft), projects);
  }
  assert.deepEqual(projects, before);
});
test("a deliberate saved action updates the matching project and retains the rest", () => {
  const other = { ...saved, sessionId: crypto.randomUUID() };
  const updated = { ...saved, idea: "User explicitly submitted a new idea" };
  assert.deepEqual(rememberProject([saved, other], updated), [other, updated]);
  assert.equal(hasSavedProjectWork({ sessionId: "test", hypotheses: [{ id: crypto.randomUUID(), claim: "A saved assumption", createdAt: new Date().toISOString() }] }), true);
});
