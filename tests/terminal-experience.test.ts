import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { saveResult, resultCommand, resultLabel } from "../lib/result-history";
import { COMMANDS, commandReason, matchingCommands } from "../lib/commands";
import { createShare, getContext, getSharedContext, hydrateContext, updateContext } from "../lib/context-store";
import { POST } from "../app/api/project/route";
import type { SessionContext } from "../lib/types";

const savedEnv = { ...process.env }; let directory: string;
before(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), "quorum-terminal-")); process.env.QUORUM_DATA_DIR = directory; delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN; delete process.env.VERCEL; });
after(async () => { for (const file of await fs.readdir(directory)) await fs.unlink(path.join(directory, file)); await fs.rmdir(directory); for (const key of ["QUORUM_DATA_DIR", "KV_REST_API_URL", "KV_REST_API_TOKEN", "VERCEL"]) { if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key]; } });
const artifact = { title: "INTERNAL OUTPUT TEST", headline: "A proposal to examine", html: "<html><body>Internal static test only.</body></html>", keyClaims: ["Unverified proposal"] };

test("saved output versions keep their original content, source reference and revision", () => {
  const context: SessionContext = { sessionId: "internal-history-project", evaluationRevision: 4 };
  const input = structuredClone(artifact);
  const resultHistory = saveResult(context, { kind: "offer", artifact: input }, "input-snapshot-id", 5);
  input.headline = "A changed input";
  assert.equal(resultHistory[0].contextRevision, 5); assert.equal(resultHistory[0].groundingRunId, "input-snapshot-id");
  assert.equal(resultHistory[0].kind === "offer" && resultHistory[0].artifact.headline, artifact.headline);
  assert.equal(resultCommand(resultHistory[0]), "/artifact"); assert.equal(resultLabel(resultHistory[0]), "Landing offer");
});
test("bounded output history retains the newest valid outputs without evicting current project data", () => {
  let context: SessionContext = { sessionId: "internal-history-project", artifact };
  for (let i = 0; i < 25; i++) context = { ...context, resultHistory: saveResult(context, { kind: "offer", artifact: { ...artifact, title: `Version ${i}`, html: "x".repeat(55000) } }) };
  assert.ok(context.resultHistory!.length <= 16); assert.ok(new TextEncoder().encode(JSON.stringify(context.resultHistory)).byteLength <= 500000);
  const last = context.resultHistory!.at(-1)!; assert.equal(last.kind === "offer" && last.artifact.title, "Version 24"); assert.deepEqual(context.artifact, artifact);
});
test("command suggestions expose prerequisites and distinguish navigation from AI requests", () => {
  const empty: SessionContext = { sessionId: "internal-command-project" }, full = { ...empty, idea: "A saved idea", artifact };
  assert.equal(matchingCommands("/kn")[0].command, "/knowledge"); assert.ok(matchingCommands("cited").some(c => c.command === "/knowledge"));
  const skeptic = COMMANDS.find(c => c.command === "/skeptic")!, history = COMMANDS.find(c => c.command === "/history")!, kit = COMMANDS.find(c => c.command === "/kit")!;
  assert.match(commandReason(skeptic, empty, false)!, /offer/); assert.match(commandReason(skeptic, full, true)!, /cancel/);
  assert.equal(commandReason(history, empty, true), undefined); assert.equal(commandReason(kit, full, false), undefined);
  assert.equal(skeptic.kind, "ai"); assert.equal(history.kind, "view");
});
test("output history remains server-owned, private in shares and clearable without changing current results", async () => {
  let context = await hydrateContext({ sessionId: crypto.randomUUID(), accessToken: crypto.randomUUID(), resultHistory: [{ id: "forged" }] } as unknown as SessionContext);
  assert.equal(context.resultHistory, undefined);
  context = await updateContext(context.sessionId, { artifact });
  context = await updateContext(context.sessionId, current => ({ resultHistory: saveResult(current, { kind: "offer", artifact: { ...artifact, headline: "PRIVATE EARLIER OUTPUT ONLY" } }) }));
  assert.match(JSON.stringify((await getContext(context.sessionId))?.resultHistory), /PRIVATE EARLIER OUTPUT/);
  assert.doesNotMatch(JSON.stringify(await getSharedContext(await createShare(context))), /PRIVATE EARLIER OUTPUT|resultHistory/);
  const post = (token: string) => POST(new Request("http://localhost/api/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: { sessionId: context.sessionId, accessToken: token }, operation: "clear-result-history" }) }));
  assert.equal((await post(crypto.randomUUID())).status, 400); assert.equal((await getContext(context.sessionId))!.resultHistory!.length, 1);
  assert.equal((await post(context.accessToken!)).status, 200);
  const stored = (await getContext(context.sessionId))!; assert.deepEqual(stored.resultHistory, []); assert.deepEqual(stored.artifact, artifact); assert.equal(stored.evaluationRevision, context.evaluationRevision);
});
