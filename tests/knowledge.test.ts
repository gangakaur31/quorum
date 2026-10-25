import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { chunkDocument, knowledgeContext, knowledgeDocuments, retrieveSnapshot, withGrounding } from "../lib/knowledge";
import { catalogId, extractDocument, importDocument, knowledgeQuoteOptions, upsertDocument, validateKnowledgeAnswer } from "../lib/knowledge-ingest";
import { saveLegalProfile } from "../lib/legal";
import { KNOWLEDGE_TASKS, type KnowledgeDocument } from "../lib/knowledge-types";
import { POST } from "../app/api/knowledge/route";
import { POST as generatePost } from "../app/api/generate/route";
import { POST as juryPost } from "../app/api/jury/route";
import { POST as marketingPost } from "../app/api/marketing/route";
import { POST as confidencePost } from "../app/api/confidence/route";
import { POST as discoverPost } from "../app/api/discover/route";
import { POST as interviewPost } from "../app/api/interview/route";
import { createShare, getContext, getSharedContext, hydrateContext, updateContext } from "../lib/context-store";
import { juryUserPrompt } from "../lib/prompts";
import { evaluateEvidence } from "../lib/evidence";
import type { SessionContext } from "../lib/types";

const claude = (value: unknown) => Response.json({ model: "test-claude-model", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(value) }] });
const savedEnv = { ...process.env }, originalFetch = globalThis.fetch; let directory: string, ip = 0;
const input = { title: "Private migration study", publisher: "Internal research notes", content: "The clinic's migration requires a CSV export and an afternoon of training. No customer has committed to pay.", tasks: ["knowledge", "generate", "jury", "discover", "marketing", "interview", "experiment", "decision", "brief"], region: "global", limitations: "One founder report; unverified and not representative.", consent: true };
const context = (documents: KnowledgeDocument[] = []): SessionContext => ({ sessionId: "knowledge-test-project", idea: "Clinic workflow", knowledgeDocuments: documents });
const request = (session: SessionContext, body: Record<string, unknown>, origin?: string) => POST(new Request("http://localhost/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `knowledge-${++ip}`, ...(origin ? { origin } : {}) }, body: JSON.stringify({ context: { sessionId: session.sessionId, accessToken: session.accessToken }, ...body }) }));
before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "quorum-knowledge-"));
  for (const key of Object.keys(process.env)) if (/^(AI_|GEMINI_|GROQ_|ANTHROPIC_|KV_|VERCEL)/.test(key)) delete process.env[key];
  process.env.QUORUM_DATA_DIR = directory; process.env.AI_PROVIDER = "groq"; process.env.ANTHROPIC_API_KEY = "test-only"; process.env.GROQ_MODEL = "unit-test-model"; process.env.AI_MAX_RETRIES = "0";
});
after(async () => { globalThis.fetch = originalFetch; for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key]; Object.assign(process.env, savedEnv); for (const file of await fs.readdir(directory)) await fs.unlink(path.join(directory, file)); await fs.rmdir(directory); });
const newProject = () => hydrateContext({ sessionId: crypto.randomUUID(), accessToken: crypto.randomUUID(), idea: "INTERNAL TEST ONLY: clinic workflow" });
const groq = (answer: unknown) => claude(answer);

test("document import requires explicit permission, bounded text, provenance and valid task/date/URL metadata", () => {
  const doc = importDocument(input); assert.equal(doc.provenance, "manual_import"); assert.equal(doc.publishedAt, null); assert.equal(doc.layer, "project");
  for (const patch of [{ consent: false }, { content: "too short" }, { content: "x".repeat(60001) }, { tasks: ["legal"] }, { tasks: [] }, { region: "everywhere" }, { publishedAt: "2026-02-30" }, { publishedAt: "2099-01-01" }, { url: "http://localhost/file" }]) assert.throws(() => importDocument({ ...input, ...patch }));
  assert.equal(importDocument({ ...input, publishedAt: "2026-01-01" }).publishedAt, "2026-01-01");
});
test("chunks retain exact source offsets, bounded overlapping passages and stable content versions", () => {
  const doc = importDocument({ ...input, content: "Original passage with relevant material. ".repeat(100) });
  const chunks = chunkDocument(doc); assert.ok(chunks.length > 2);
  for (const c of chunks) { assert.equal(c.content, doc.content.slice(c.start, c.end)); assert.ok(c.content.length <= 1100); }
  assert.ok(chunks[1].start < chunks[0].end); assert.equal(chunks.at(-1)!.end, doc.content.length);
  assert.equal(importDocument(input).version, importDocument(input).version);
  assert.notEqual(doc.version, importDocument({ ...input, content: doc.content + " Updated." }).version);
});
test("retrieval finds a relevant passage late in a long document and exposes inspectable BM25 matches", () => {
  const doc = importDocument({ ...input, content: "Generic unrelated material. ".repeat(200) + " The distinctive zebrafish export requires a separate migration key." });
  const snapshot = retrieveSnapshot(context([doc]), "jury", { query: "zebrafish migration key", limit: 1 });
  assert.equal(snapshot.passages[0].id, doc.id); assert.match(snapshot.passages[0].content, /zebrafish/); assert.ok(snapshot.passages[0].start > 1000); assert.ok(snapshot.passages[0].score > 0); assert.ok(snapshot.passages[0].matchedTerms.includes("zebrafish"));
});
test("irrelevant and stop-word-only questions abstain rather than returning a pretend matching source", () => {
  for (const query of ["quuxflarb unobtainium", "the and of"]) assert.equal(retrieveSnapshot(context(), "knowledge", { query }).passages.length, 0);
});
test("feature and jurisdiction filters exclude disabled or ineligible documents", () => {
  const doc = importDocument({ ...input, tasks: ["interview"], region: "india" });
  assert.ok(retrieveSnapshot(context([doc]), "interview", { query: "CSV migration" }).passages.some(p => p.id === doc.id));
  assert.ok(!retrieveSnapshot(context([doc]), "jury", { query: "CSV migration" }).passages.some(p => p.id === doc.id));
  assert.ok(!retrieveSnapshot(context([doc]), "interview", { query: "CSV migration", region: "us" }).passages.some(p => p.id === doc.id));
  assert.ok(!knowledgeDocuments(context([{ ...doc, enabled: false }])).some(d => d.id === doc.id));
});
test("legal retrieval is restricted to selected jurisdictions and curated authority-reference summaries", () => {
  const snapshot = retrieveSnapshot(context(), "legal", { query: "privacy personal data", region: "india" });
  assert.ok(snapshot.passages.some(p => p.id === "reference-india-privacy"));
  assert.ok(snapshot.passages.every(p => !/^reference-(us|eu|uk)-/.test(p.id)));
  assert.ok(snapshot.passages.every(p => p.provenance === "curated_summary"));
  assert.ok(retrieveSnapshot(context(), "legal", { query: "privacy personal data" }).passages.every(p => p.id === "reference-ip"));
});
test("private records remain project-local and exclude legal notes, contacts, credentials and other jurors", () => {
  const doc = importDocument({ ...input, content: input.content + " PRIVATE_NEVER_OTHER_PROJECT" });
  const project = { ...context([doc]), accessToken: "SECRET_ACCESS_TOKEN", legalPreparation: { progress: { secret: { notes: "SECRET_LEGAL_NOTE" } } }, jury: [{ objection: "SECRET_OTHER_JUROR" }], interviews: [{ id: "unconsented", consent: false, transcript: "SECRET_UNCONSENTED" }] } as unknown as SessionContext;
  const all = JSON.stringify(knowledgeDocuments(project));
  assert.match(all, /PRIVATE_NEVER_OTHER_PROJECT/); assert.doesNotMatch(all, /SECRET_/);
  assert.doesNotMatch(knowledgeContext(context(), "jury"), /PRIVATE_NEVER_OTHER_PROJECT/);
  assert.doesNotMatch(juryUserPrompt(project), /SECRET_OTHER_JUROR|SECRET_LEGAL_NOTE|SECRET_ACCESS_TOKEN/);
});
test("source duplicates and library overflow are rejected and curated identifiers cannot be forged", () => {
  const doc = importDocument(input); assert.throws(() => upsertDocument(context([doc]), importDocument(input)), /already imported/);
  const docs = Array.from({ length: 12 }, (_, i) => importDocument({ ...input, content: input.content + i })); assert.throws(() => upsertDocument(context(docs), doc), /twelve/);
  assert.throws(() => catalogId("invented-official-reference"));
});
test("cited answers reject invented source IDs, approximate quotes and uncited claims; abstentions explain gaps", () => {
  const snapshot = retrieveSnapshot(context([importDocument(input)]), "knowledge", { query: "migration CSV" }), p = snapshot.passages[0];
  const answer = { claims: [{ text: "Migration is a reported constraint.", citations: [{ passageId: p.passageId, quote: p.content.slice(0, 60) }] }], gaps: ["This does not establish demand."] };
  assert.deepEqual(validateKnowledgeAnswer(answer, snapshot), answer);
  for (const citations of [[], [{ passageId: "invented", quote: p.content.slice(0, 40) }], [{ passageId: p.passageId, quote: "This was never in the source." }]]) assert.throws(() => validateKnowledgeAnswer({ ...answer, claims: [{ ...answer.claims[0], citations }] }, snapshot));
  assert.throws(() => validateKnowledgeAnswer({ claims: [], gaps: [] }, snapshot));
});
test("Tavily URL ingestion uses its fixed endpoint and preserves actual extracted source text", async () => {
  process.env.TAVILY_API_KEY = "test-tavily-only";
  globalThis.fetch = async (url, options) => { assert.equal(url, "https://api.tavily.com/extract"); assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer test-tavily-only"); const body = JSON.parse(String(options?.body)); assert.deepEqual(body.urls, ["https://example.org/source"]); return Response.json({ results: [{ url: body.urls[0], raw_content: input.content }], failed_results: [] }); };
  const extracted = await extractDocument("https://example.org/source"); const doc = importDocument(input, undefined, extracted);
  assert.equal(doc.content, input.content); assert.equal(doc.provenance, "tavily_extract"); assert.equal(doc.source, "https://example.org/source");
  await assert.rejects(extractDocument("https://127.0.0.1/"), /public/);
});
test("citation IDs resolve to original stored excerpts without model-retyped source text", () => {
  const snapshot = retrieveSnapshot(context([importDocument(input)]), "knowledge", { query: "migration CSV" }), option = knowledgeQuoteOptions(snapshot)[0];
  const answer = validateKnowledgeAnswer({ claims: [{ text: "A reported constraint.", citations: [{ quoteId: option.quoteId }] }], gaps: [] }, snapshot);
  assert.equal(answer.claims[0].citations[0].quote, option.quote);
  assert.ok(snapshot.passages.find(p => p.passageId === option.passageId)!.content.includes(option.quote));
  assert.throws(() => validateKnowledgeAnswer({ claims: [{ text: "Invented.", citations: [{ quoteId: "invented-id" }] }], gaps: [] }, snapshot));
});
test("whitespace-only quote formatting is restored to the original source; changed wording remains rejected", () => {
  const doc = importDocument({ ...input, content: "Original source sentence with\n   careful formatting and punctuation." });
  const snapshot = retrieveSnapshot(context([doc]), "knowledge", { query: "careful formatting" }), p = snapshot.passages[0];
  const answer = validateKnowledgeAnswer({ claims: [{ text: "Reported source.", citations: [{ passageId: p.passageId, quote: "sentence with careful formatting" }] }], gaps: [] }, snapshot);
  assert.equal(answer.claims[0].citations[0].quote, "sentence with\n   careful formatting");
  assert.throws(() => validateKnowledgeAnswer({ claims: [{ text: "Changed.", citations: [{ passageId: p.passageId, quote: "sentence WITH careful formatting" }] }], gaps: [] }, snapshot));
});
test("HTTP 200 extraction failures, malformed, oversized and foreign results never become successful source imports", async () => {
  for (const body of [{ results: [], failed_results: [{ url: "https://example.org/source", error: "not readable" }] }, { results: [{ url: "https://different.org/", raw_content: input.content }] }, { results: [{ url: "https://example.org/source", raw_content: "a".repeat(60001) }] }]) { globalThis.fetch = async () => Response.json(body); await assert.rejects(extractDocument("https://example.org/source")); }
  globalThis.fetch = async () => new Response("invalid-json"); await assert.rejects(extractDocument("https://example.org/source"), /invalid response/);
});
test("owned document writes ignore forged derived state, persist across reads and invalidate earlier reviews", async () => {
  let session = await newProject(); session = await updateContext(session.sessionId, { personas: ["analyst"], jury: [{ persona: "analyst" } as never] });
  const response = await request(session, { operation: "import", mode: "text", record: input, groundingRuns: [{ id: "forged" }] }); assert.equal(response.status, 200);
  session = (await response.json()).context; assert.equal(session.knowledgeDocuments?.length, 1); assert.ok(session.failures?.some(f => f.category === "context_changed")); assert.deepEqual(session.groundingRuns, []);
  assert.equal((await getContext(session.sessionId))?.knowledgeDocuments?.[0].content, input.content);
  assert.equal((await request({ ...session, accessToken: crypto.randomUUID() }, { operation: "delete", id: session.knowledgeDocuments![0].id })).status, 400);
  assert.equal((await request(session, { operation: "clear-history" }, "https://different.org")).status, 400);
});
test("a real ask-route contract sends retrieved passages to inference and durably saves only a validated cited answer", async () => {
  const session = await newProject(); await request(session, { operation: "import", mode: "text", record: input });
  let supplied = "";
  globalThis.fetch = async (_url, options) => { const messages = JSON.parse(String(options?.body)).messages; supplied = messages.at(-1).content; const prompt = JSON.parse(supplied); const data = JSON.parse(prompt.context.split("\n")[1]); const p = data.passages[0]; return groq({ claims: [{ text: "A migration constraint was reported; it remains unverified.", citations: [{ quoteId: prompt.quoteOptions[0].quoteId }] }], gaps: ["A real commitment is still missing."] }); };
  const response = await request(session, { operation: "ask", task: "knowledge", query: "What migration CSV constraints are reported?" }); assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.generated, true); assert.match(supplied, /CSV export/); assert.equal(data.context.groundingRuns.length, 1); assert.deepEqual(data.context.groundingRuns[0].passages, data.snapshot.passages);
  assert.equal((await getContext(session.sessionId))?.groundingRuns?.[0].answer?.claims.length, 1);
  globalThis.fetch = async () => groq({ claims: [{ text: "Fabricated.", citations: [{ passageId: "no-source", quote: "not a real quotation" }] }], gaps: [] });
  assert.equal((await request(session, { operation: "ask", task: "knowledge", query: "migration CSV" })).status, 502);
  assert.equal((await getContext(session.sessionId))?.groundingRuns?.length, 1);
});
test("no matches avoid an inference call and changes during inference cannot save an outdated answer", async () => {
  const session = await newProject(); let calls = 0;
  globalThis.fetch = async () => { calls++; return groq({}); };
  const empty = await request(session, { operation: "ask", task: "knowledge", query: "quuxflarb unobtainium" }); assert.equal(empty.status, 200); assert.equal((await empty.json()).generated, false); assert.equal(calls, 0);
  await request(session, { operation: "import", mode: "text", record: input });
  globalThis.fetch = async (_url, options) => { const prompt = JSON.parse(JSON.parse(String(options?.body)).messages.at(-1).content); const data = JSON.parse(prompt.context.split("\n")[1]); const p = data.passages[0]; await updateContext(session.sessionId, { knowledgeDocuments: [] }); return groq({ claims: [{ text: "Outdated.", citations: [{ quoteId: prompt.quoteOptions[0].quoteId }] }], gaps: [] }); };
  const stale = await request(session, { operation: "ask", task: "knowledge", query: "migration CSV" }); assert.equal(stale.status, 400); assert.match((await stale.json()).error, /context changed/); assert.equal((await getContext(session.sessionId))?.groundingRuns?.length ?? 0, 0);
});
test("an exact cited question reuses only the current project's unchanged source snapshot", async () => {
  const session = await newProject(); await request(session, { operation: "import", mode: "text", record: input });
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++; assert.match(String(url), /anthropic/);
    const payload = JSON.parse(JSON.parse(String(options?.body)).messages.at(-1).content);
    const compact = JSON.parse(payload.context.split("\n")[1]);
    assert.equal("content" in compact.passages[0], false); assert.equal("matchedTerms" in compact.passages[0], false);
    assert.ok(payload.quoteOptions.some((q: { quote: string }) => q.quote.includes("CSV")));
    return groq({ claims: [{ text: "A CSV migration constraint was reported.", citations: [{ quoteId: payload.quoteOptions[0].quoteId }] }], gaps: ["Not proof of demand."] });
  };
  const ask = { operation: "ask", task: "knowledge", query: "Which migration CSV constraints were reported?" };
  const first = await (await request(session, ask)).json(); assert.equal(first.generated, true); assert.equal(calls, 1);
  const reused = await (await request(session, ask)).json(); assert.equal(reused.reused, true); assert.equal(reused.generated, false); assert.equal(reused.snapshot.id, first.snapshot.id); assert.equal(calls, 1);
  await request(session, { operation: "clear-history" });
  assert.equal((await (await request(session, ask)).json()).generated, true); assert.equal(calls, 2);
  const other = await newProject(); await request(other, { operation: "import", mode: "text", record: input });
  assert.equal((await (await request(other, ask)).json()).generated, true); assert.equal(calls, 3);
});
test("answer reuse requires unchanged supplied limitations as well as matching source IDs", async () => {
  const session = await newProject(); await request(session, { operation: "import", mode: "text", record: input });
  let calls = 0; globalThis.fetch = async () => { calls++; return groq({ claims: [], gaps: ["More evidence needed."] }); };
  const ask = { operation: "ask", task: "knowledge", query: "migration CSV" };
  assert.equal((await (await request(session, ask)).json()).generated, true);
  await updateContext(session.sessionId, current => ({ groundingRuns: current.groundingRuns?.map(run => ({ ...run, gaps: ["An older request's different scope limitation."] })) }));
  assert.equal((await (await request(session, ask)).json()).generated, true); assert.equal(calls, 2);
});
test("context deduplication never drops short source lines excluded from citation choices", async () => {
  const session = await newProject();
  await request(session, { operation: "import", mode: "text", record: { ...input, content: "An agency was asked whether it paid for migration.\nNo.\nThis is an authored internal QA source, not customer research." } });
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(JSON.parse(String(options?.body)).messages.at(-1).content);
    const context = JSON.parse(payload.context.split("\n")[1]);
    const passage = context.passages.find((p: { content?: string }) => p.content?.includes("\nNo.\n"));
    assert.ok(passage, "The non-citable short negative answer must remain in the model's context");
    return groq({ claims: [], gaps: ["No customer research established."] });
  };
  assert.equal((await (await request(session, { operation: "ask", task: "knowledge", query: "agency paid migration" })).json()).generated, true);
});
test("failed URL refresh retains the earlier document; pausing/deletion clears retained source history", async () => {
  let session = await newProject(); session = (await (await request(session, { operation: "import", mode: "text", record: input })).json()).context;
  const doc = session.knowledgeDocuments![0], snapshot = retrieveSnapshot(session, "knowledge", { query: "migration" }); await updateContext(session.sessionId, { groundingRuns: withGrounding(session, snapshot) });
  globalThis.fetch = async () => Response.json({ results: [], failed_results: [{}] });
  assert.equal((await request(session, { operation: "import", mode: "url", record: { ...input, id: doc.id, version: doc.version, url: "https://example.org/source" } })).status, 502);
  assert.equal((await getContext(session.sessionId))?.knowledgeDocuments?.[0].version, doc.version);
  session = (await (await request(session, { operation: "toggle", id: doc.id })).json()).context; assert.equal(session.knowledgeDocuments![0].enabled, false); assert.deepEqual(session.groundingRuns, []);
  session = (await (await request(session, { operation: "delete", id: doc.id })).json()).context; assert.deepEqual(session.knowledgeDocuments, []);
});
test("public sharing excludes raw documents, source queries and grounding history; retrieval cannot modify the evidence rule", async () => {
  let session = await newProject(); const before = evaluateEvidence(session); const doc = importDocument(input); session = await updateContext(session.sessionId, { knowledgeDocuments: [doc] });
  const snapshot = retrieveSnapshot(session, "knowledge", { query: "PRIVATE_QUERY migration" }); session = await updateContext(session.sessionId, { groundingRuns: withGrounding(session, snapshot) });
  assert.deepEqual(evaluateEvidence(session), before);
  const shared = JSON.stringify(await getSharedContext(await createShare(session))); assert.doesNotMatch(shared, /Private migration study|PRIVATE_QUERY|CSV export|groundingRuns|knowledgeDocuments/);
});
test("retrieval evaluation finds the expected methodology for feature-specific held examples", () => {
  const cases: Array<[string, string, string]> = [["interview", "recent situations workarounds non-leading", "framework-interviews"], ["experiment", "denominator criterion observable action", "framework-experiments"], ["generate", "offer benefit alternative proposition", "framework-offer"], ["decision", "previous snapshot contradicting observations", "framework-continuity"]];
  for (const [task, query, expected] of cases) assert.equal(retrieveSnapshot(context(), task, { query, limit: 1 }).passages[0]?.id, expected, query);
  for (const task of KNOWLEDGE_TASKS.filter(t => t !== "legal")) assert.ok(retrieveSnapshot(context([importDocument(input)]), task, { query: "CSV export" }).passages.some(p => p.provenance === "manual_import"), task);
});
test("a legal location change during inference rejects the earlier jurisdiction's answer", async () => {
  let session = await newProject();
  const profile = { product: "INTERNAL TEST only", home: "india", markets: ["india"], locationDetails: "", sector: "general", activities: ["personal_data"] };
  session = await updateContext(session.sessionId, { legalPreparation: saveLegalProfile(profile) });
  globalThis.fetch = async (_url, options) => {
    const prompt = JSON.parse(JSON.parse(String(options?.body)).messages.at(-1).content);
    await updateContext(session.sessionId, { legalPreparation: saveLegalProfile({ ...profile, home: "us", markets: ["us"] }) });
    return groq({ claims: [{ text: "An earlier scope's preparation reference.", citations: [{ quoteId: prompt.quoteOptions[0].quoteId }] }], gaps: [] });
  };
  const response = await request(session, { operation: "ask", task: "legal", query: "privacy personal data" });
  assert.equal(response.status, 400); assert.match((await response.json()).error, /Legal scope changed/);
});
test("deleting an original private project record clears retained retrieval excerpts", async () => {
  let session = await newProject();
  session = await updateContext(session.sessionId, { interviews: [{ id: crypto.randomUUID(), hypothesisId: "test-assumption", collectedAt: new Date().toISOString(), consent: true, participant: "Alias", transcript: "PRIVATE ORIGINAL INTERVIEW: migration requires afternoon training and export." }] });
  const snapshot = retrieveSnapshot(session, "interview", { query: "migration afternoon training export" });
  session = await updateContext(session.sessionId, { groundingRuns: withGrounding(session, snapshot) }); assert.match(JSON.stringify(session.groundingRuns), /PRIVATE ORIGINAL/);
  session = await updateContext(session.sessionId, { interviews: [] }); assert.deepEqual(session.groundingRuns, []);
});
test("all six AI workflows actually send retrieved project passages and save the supplied source versions", async () => {
  const artifact = { title: "INTERNAL TEST ONLY", headline: "Clinic migration proposal", keyClaims: ["Unverified proposal"], html: "<!doctype html><html><body><h1>Internal fixture only</h1></body></html>" };
  const review = { steelman: "A specific workflow is proposed.", objection: "Migration is untested.", evidence_needed: "Observe one migration.", reasoning_trace: ["The offer describes a workflow.", "Commitment is still untested."], scores: { willingness_to_try: 3, price_resistance: null, trust: 2 }, risk_category: "switching", recommendation: "test", next_step: "Observe a recent workflow.", assumptions: [] };
  const source = "INTERNAL TEST: Clinic administrators report spending time on appointment migration.";
  const discovery = { opportunities: [{ id: "test-opportunity", title: "Internal clinic test", problem: "Repeated migration", customer: "Clinic administrators", observations: [{ statement: "The supplied excerpt reports migration time.", sourceId: "source-1", excerpt: source }], inference: "A bounded workflow test may help.", alternatives: ["Manual entry"], approach: "A small import pilot", mvp: "One import workflow", complexity: "low", capabilities: ["CSV import"], assumptions: ["A buyer commits time"], firstExperiment: "Observe a workflow.", limitations: "Internal test only.", whyNow: "Bounded scope." }] };
  const kit = { validationKit: { interviewQuestions: ["What happened last time?", "What did you do?", "What did that cost?", "Who approved it?", "What have you tried?"], outreachMessage: "Research invitation only.", experiment: { hypothesis: "An administrator commits time.", method: "Invite a workflow observation.", successCriterion: "Proposed only; two agree to attend." } } };
  const cases = [
    { name: "generate", task: "generate", handler: generatePost, reply: artifact, extra: {} },
    { name: "jury", task: "jury", handler: juryPost, reply: review, extra: { personas: ["analyst"] } },
    { name: "marketing", task: "marketing", handler: marketingPost, reply: { angles: [{ id: "angle-a", headline: "Smaller workflow", angle: "A messaging hypothesis.", cta: "Request a session" }, { id: "angle-b", headline: "Keep control", angle: "A second hypothesis.", cta: "Explore the workflow" }] }, extra: {} },
    { name: "confidence", task: "experiment", handler: confidencePost, reply: kit, extra: {} },
    { name: "discover", task: "discover", handler: discoverPost, reply: discovery, extra: { mode: "supplied", constraints: { domain: "Clinic migration" }, sources: [{ title: "Internal source only", url: "https://example.org/route-test", excerpt: source }] } },
    { name: "interview", task: "interview", handler: interviewPost, reply: { findings: [{ quote: "three hours copying appointments", interpretation: "A reported cost, not buying intent." }] }, extra: {} },
  ];
  for (const c of cases) {
    let session = await newProject(); const id = crypto.randomUUID(), hypothesisId = crypto.randomUUID();
    const doc = importDocument({ ...input, content: input.content + " ROUTE_GROUNDING_MARKER" });
    session = await updateContext(session.sessionId, { knowledgeDocuments: [doc], ...(c.name !== "generate" ? { artifact } : {}), hypotheses: [{ id: hypothesisId, claim: "Clinic migration is a relevant problem", createdAt: new Date().toISOString() }], interviews: [{ id, hypothesisId, consent: true, participant: "Internal test alias", transcript: "INTERNAL TEST: three hours copying appointments", collectedAt: new Date().toISOString() }] });
    let supplied = "";
    globalThis.fetch = async (_url, options) => { supplied = JSON.parse(String(options?.body)).messages.at(-1).content; return groq(c.reply); };
    const response = await c.handler(new Request(`http://localhost/api/${c.name}`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `route-integration-${++ip}` }, body: JSON.stringify({ context: { sessionId: session.sessionId, accessToken: session.accessToken }, idea: session.idea, id, ...c.extra }) }));
    assert.equal(response.status, 200, c.name); const body = await response.text(); assert.doesNotMatch(body, /event: error/, c.name);
    assert.match(supplied, /ROUTE_GROUNDING_MARKER/, c.name);
    const stored = (await getContext(session.sessionId))!, run = stored.groundingRuns?.find(r => r.task === c.task);
    assert.ok(run, c.name); assert.ok(run.passages.some(p => p.id === doc.id && p.version === doc.version), c.name);
  }
});
test("concurrent URL refresh preserves a pause and rejects an editor holding the previous source version", async () => {
  let session = await newProject();
  session = (await (await request(session, { operation: "import", mode: "text", record: input })).json()).context;
  const original = session.knowledgeDocuments![0];
  globalThis.fetch = async () => {
    await updateContext(session.sessionId, current => ({ knowledgeDocuments: current.knowledgeDocuments?.map(d => ({ ...d, enabled: false })) }));
    return Response.json({ results: [{ url: "https://example.org/refreshed", raw_content: input.content + " Changed source edition." }], failed_results: [] });
  };
  const response = await request(session, { operation: "import", mode: "url", record: { ...input, id: original.id, version: original.version, url: "https://example.org/refreshed" } });
  assert.equal(response.status, 200); session = (await response.json()).context;
  assert.equal(session.knowledgeDocuments![0].enabled, false); assert.notEqual(session.knowledgeDocuments![0].version, original.version);
  const stale = await request(session, { operation: "import", mode: "text", record: { ...input, id: original.id, version: original.version } });
  assert.equal(stale.status, 400); assert.match((await stale.json()).error, /changed since/);
  assert.match((await getContext(session.sessionId))!.knowledgeDocuments![0].content, /Changed source edition/);
});
