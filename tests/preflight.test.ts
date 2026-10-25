import test, { beforeEach, afterEach, before, after } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPreflight } from "../lib/preflight";
const originalFetch = globalThis.fetch, environment = { ...process.env };
const managed = /^(AI_|GROQ_|GEMINI_|ANTHROPIC_|TAVILY_|KV_|VERCEL|QUORUM_DATA_DIR)/;
let directory: string;
before(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), "quorum-preflight-")); });
beforeEach(() => {
  for (const key of Object.keys(process.env)) if (managed.test(key)) delete process.env[key];
  process.env.ANTHROPIC_API_KEY = "test-only-claude"; process.env.ANTHROPIC_MODEL = "test-chat"; process.env.AI_PROVIDER = "groq"; process.env.GROQ_API_KEY = "test-only-secret"; process.env.GROQ_MODEL = "test-chat"; process.env.QUORUM_DATA_DIR = directory;
});
afterEach(() => { globalThis.fetch = originalFetch; for (const key of Object.keys(process.env)) if (managed.test(key)) delete process.env[key]; Object.assign(process.env, environment); });
after(async () => { assert.deepEqual(await fs.readdir(directory), []); await fs.rmdir(directory); });
const claude = (content = '{"connected":true}') => Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: content }] });
const groq = (content = '{"connected":true}') => Response.json({ choices: [{ finish_reason: "stop", message: { content } }] });
test("preflight performs validated inference and local storage cleanup; missing optional APIs remain SKIP", async () => {
  let calls = 0;
  globalThis.fetch = async url => { calls++; return String(url).includes("anthropic") ? claude() : groq(); };
  const report = await runPreflight();
  assert.equal(report.passed, true); assert.equal(calls, 2); assert.equal(report.primaryProvider, "anthropic");
  assert.equal(report.checks.find(c => c.name === "tavily")?.status, "SKIP");
  assert.equal(report.checks.find(c => c.name === "local-storage")?.status, "PASS");
  assert.deepEqual(await fs.readdir(directory), []);
});
test("one failing configured provider cannot be hidden by another provider's success or fallback", async () => {
  process.env.GEMINI_API_KEY = "test-only"; process.env.AI_FALLBACK_PROVIDERS = "groq";
  const calls: string[] = [];
  globalThis.fetch = async url => { calls.push(String(url)); return String(url).includes("groq.com") ? groq() : Response.json({ message: "PRIVATE UPSTREAM SECRET" }, { status: 503 }); };
  const report = await runPreflight();
  assert.equal(report.passed, false); assert.equal(calls.length, 3);
  assert.equal(report.checks.find(c => c.name === "gemini")?.status, "FAIL");
  assert.equal(report.checks.find(c => c.name.startsWith("groq"))?.status, "PASS");
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE UPSTREAM|test-only-secret/);
});
test("required missing services and malformed successful responses fail readiness", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  globalThis.fetch = async () => groq('{"connected":false}');
  const report = await runPreflight({ require: ["tavily", "anthropic"] });
  assert.equal(report.passed, false);
  assert.equal(report.checks.find(c => c.name === "tavily")?.status, "FAIL");
  assert.equal(report.checks.find(c => c.name === "anthropic")?.status, "FAIL");
  assert.equal(report.checks.find(c => c.name.startsWith("groq"))?.category, "schema_validation");
});
test("Redis readiness uses a unique expiring test key and deletes it after read failure", async () => {
  process.env.KV_REST_API_URL = "https://test.invalid"; process.env.KV_REST_API_TOKEN = "redis-test-only";
  const commands: unknown[][] = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("groq.com")) return groq();
    if (String(url).includes("anthropic.com")) return claude();
    const command = JSON.parse(String(options?.body)); commands.push(command);
    return Response.json({ result: command[0] === "SET" ? "OK" : command[0] === "GET" ? "wrong value" : 1 });
  };
  const report = await runPreflight();
  assert.equal(report.checks.find(c => c.name === "redis")?.status, "FAIL");
  assert.deepEqual(commands.map(c => c[0]), ["SET", "GET", "DEL"]);
  assert.match(String(commands[0][1]), /^quorum:preflight:/); assert.deepEqual(commands[0].slice(3), ["EX", 60]);
  assert.equal(commands[2][1], commands[0][1]);
});
test("app route probes only exercise input guards and catch a running app configuration mismatch", async () => {
  const routes: string[] = [];
  let selected = { provider: "gemini", model: "test-chat" };
  globalThis.fetch = async (url, options) => {
    const target = new URL(String(url));
    if (target.hostname === "api.groq.com") return groq();
    if (target.hostname === "api.anthropic.com") return claude();
    routes.push(target.pathname);
    if (target.pathname === "/") return new Response("QUORUM");
    if (target.pathname === "/api/health") return Response.json({ ready: true, selected });
    if (target.pathname.startsWith("/api/session/")) return Response.json({}, { status: 404 });
    assert.equal(options?.body, "{}"); return Response.json({}, { status: 400 });
  };
  const report = await runPreflight({ baseUrl: "http://localhost:3000" });
  assert.equal(report.passed, false); assert.equal(routes.length, 13);
  assert.equal(report.checks.find(c => c.name === "/api/health")?.category, "configuration");
  assert.ok(report.checks.filter(c => c.name.startsWith("/api/") && c.name !== "/api/health").every(c => c.status === "PASS"));
  selected = { provider: "groq", model: "wrong-model" };
  assert.equal((await runPreflight({ baseUrl: "http://localhost:3000" })).checks.find(c => c.name === "/api/health")?.status, "FAIL");
  selected = { provider: "anthropic", model: "test-chat" };
  assert.equal((await runPreflight({ baseUrl: "http://localhost:3000" })).passed, true);
});
test("invalid options fail before contacting any service", async () => {
  let contacted = false; globalThis.fetch = async () => { contacted = true; return groq(); };
  await assert.rejects(runPreflight({ baseUrl: "https://secret@example.invalid" }));
  await assert.rejects(runPreflight({ timeoutMs: 999 })); assert.equal(contacted, false);
});
