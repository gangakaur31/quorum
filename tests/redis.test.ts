import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { getContext, hydrateContext, updateContext } from "../lib/context-store";
const originalFetch = globalThis.fetch, originalEnv = { ...process.env };
const records = new Map<string, string>(); const commands: unknown[][] = [];
before(() => {
  process.env.KV_REST_API_URL = "https://redis-test.invalid"; process.env.KV_REST_API_TOKEN = "test-only";
  globalThis.fetch = async (_url, options) => {
    const c = JSON.parse(String(options?.body)) as Array<string | number>; commands.push(c);
    let result: unknown = null;
    if (c[0] === "SET") { if (c.includes("NX") && records.has(String(c[1]))) result = null; else { records.set(String(c[1]), String(c[2])); result = "OK"; } }
    if (c[0] === "GET") result = records.get(String(c[1])) ?? null;
    if (c[0] === "DEL") result = records.delete(String(c[1])) ? 1 : 0;
    if (c[0] === "EVAL") { if (records.get(String(c[3])) === c[4]) { records.delete(String(c[3])); result = 1; } else result = 0; }
    return Response.json({ result });
  };
});
after(() => { globalThis.fetch = originalFetch; for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]; Object.assign(process.env, originalEnv); });
test("Redis writes and ownership-checked lease release use the documented REST command mapping", async () => {
  const project = await hydrateContext({ sessionId: crypto.randomUUID(), accessToken: crypto.randomUUID(), idea: "Test-only Redis mapping" });
  await Promise.all([updateContext(project.sessionId, { idea: "Updated" }), updateContext(project.sessionId, current => ({ assumptions: { ...current.assumptions, price: "$10" } }))]);
  const stored = (await getContext(project.sessionId))!;
  assert.equal(stored.idea, "Updated"); assert.equal(stored.assumptions?.price, "$10");
  assert.ok(commands.some(c => c[0] === "SET" && c.includes("NX") && c.includes("PX")));
  assert.ok(commands.some(c => c[0] === "SET" && c.includes("EX") && c.includes(1209600)));
  assert.ok(commands.some(c => c[0] === "EVAL" && String(c[1]).includes("ARGV[1]")));
  assert.equal([...records.keys()].some(key => key.includes(":lock:")), false);
});
test("Redis write outages are surfaced and never become warm-cache success", async () => {
  const temporary = globalThis.fetch; globalThis.fetch = async () => Response.json({}, { status: 503 });
  try { await assert.rejects(hydrateContext({ sessionId: crypto.randomUUID(), accessToken: crypto.randomUUID() }), /storage is unavailable/); }
  finally { globalThis.fetch = temporary; }
});
