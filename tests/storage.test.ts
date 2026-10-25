import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { authorizeContext, createShare, deleteContext, getContext, getSharedContext, hydrateContext, revokeShare, updateContext } from "../lib/context-store";
let directory: string;
const original = { dir: process.env.QUORUM_DATA_DIR, url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN, vercel: process.env.VERCEL };
const project = () => ({ sessionId: crypto.randomUUID(), accessToken: crypto.randomUUID(), idea: "Private test idea" });
before(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), "quorum-storage-test-")); process.env.QUORUM_DATA_DIR = directory; delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN; delete process.env.VERCEL; });
after(async () => {
  assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
  for (const file of await fs.readdir(directory)) await fs.unlink(path.join(directory, file));
  await fs.rmdir(directory);
  for (const [key, value] of Object.entries({ QUORUM_DATA_DIR: original.dir, KV_REST_API_URL: original.url, KV_REST_API_TOKEN: original.token, VERCEL: original.vercel })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
test("projects are read from disk and untrusted client snapshots cannot replace server records", async () => {
  const initial = project(); await hydrateContext(initial);
  const stored = await updateContext(initial.sessionId, { idea: "Server-owned idea" });
  assert.equal((await getContext(initial.sessionId))?.idea, "Server-owned idea");
  assert.equal((await hydrateContext({ ...initial, idea: "Stale client data" })).idea, "Server-owned idea");
  assert.ok((await fs.readFile(path.join(directory, `${initial.sessionId}.json`), "utf8")).includes("Server-owned idea"));
  assert.throws(() => authorizeContext(stored, "wrong"));
  await assert.rejects(hydrateContext({ ...initial, accessToken: crypto.randomUUID() }), /access key/);
  await assert.rejects(getContext("../../secrets"));
});
test("concurrent functional updates preserve every completed review or observation", async () => {
  const initial = project(); await hydrateContext(initial);
  await Promise.all(Array.from({ length: 15 }, (_, n) => updateContext(initial.sessionId, current => ({ hypotheses: [...current.hypotheses ?? [], { id: crypto.randomUUID(), claim: `Assumption ${n}`, createdAt: new Date().toISOString() }] }))));
  assert.equal((await getContext(initial.sessionId))?.hypotheses?.length, 15);
});
test("sharing is explicit, redacted, revocable and a snapshot", async () => {
  const initial = project(); await hydrateContext(initial);
  const context = await updateContext(initial.sessionId, { interviews: [{ id: crypto.randomUUID(), hypothesisId: "h", participant: "private name", transcript: "private customer text", consent: true, collectedAt: new Date().toISOString() }] });
  const share = await createShare(context);
  assert.notEqual(share, context.sessionId);
  const publicContext = await getSharedContext(share);
  assert.equal(publicContext?.accessToken, undefined); assert.equal(publicContext?.interviews, undefined);
  assert.equal(await getSharedContext(context.sessionId), null);
  await updateContext(context.sessionId, { idea: "Later private revision" });
  assert.equal((await getSharedContext(share))?.idea, initial.idea);
  await revokeShare((await getContext(context.sessionId))!);
  assert.equal(await getSharedContext(share), null);
});
test("delete removes project and share; expired records are inaccessible", async () => {
  const initial = project(); const context = await hydrateContext(initial);
  const share = await createShare(context);
  await deleteContext(initial.sessionId, initial.accessToken);
  assert.equal(await getContext(initial.sessionId), null); assert.equal(await getSharedContext(share), null);
  const expired = project(); await fs.writeFile(path.join(directory, `${expired.sessionId}.json`), JSON.stringify({ ...expired, updatedAt: "2020-01-01T00:00:00.000Z" }));
  assert.equal(await getContext(expired.sessionId), null);
});
test("a failed storage write is reported rather than accepted into a warm cache", async () => {
  const previous = process.env.QUORUM_DATA_DIR;
  const bad = path.join(directory, "not-a-directory"); await fs.writeFile(bad, "occupied"); process.env.QUORUM_DATA_DIR = bad;
  try { await assert.rejects(hydrateContext(project())); }
  finally { process.env.QUORUM_DATA_DIR = previous; }
});
test("a fresh Node process recovers a project without warm memory", async () => {
  const initial = project(); await hydrateContext({ ...initial, idea: "Restart survivor" });
  const child = spawnSync(process.execPath, ["--require", "./scripts/test-register.cjs", "-e", "require('./lib/context-store.ts').getContext(process.argv[1]).then(c=>{if(c?.idea!=='Restart survivor')process.exit(1);console.log('recovered from disk')}).catch(()=>process.exit(2))", initial.sessionId], { cwd: process.cwd(), env: process.env, encoding: "utf8", timeout: 10000 });
  assert.equal(child.status, 0, child.stderr); assert.match(child.stdout, /recovered from disk/);
});
