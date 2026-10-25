// Real, bounded source extraction + cited generation through the app's route handler.
// Uses a separate temporary local project and deletes it even when inference fails.
require('@next/env').loadEnvConfig(process.cwd());
require('./test-register.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
async function main() {
  const root = path.resolve('artifacts'); await fs.mkdir(root, { recursive: true });
  const directory = await fs.mkdtemp(path.join(root, 'rag-smoke-'));
  assert.ok(directory.startsWith(root + path.sep));
  process.env.QUORUM_DATA_DIR = directory;
  delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN; delete process.env.VERCEL;
  const store = require('../lib/context-store.ts');
  const { POST } = require('../app/api/knowledge/route.ts');
  let context;
  const call = async body => {
    const response = await POST(new Request('http://localhost/api/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: { sessionId: context.sessionId, accessToken: context.accessToken }, ...body }), signal: AbortSignal.timeout(55000) }));
    const data = await response.json(); if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`); context = data.context; return data;
  };
  try {
    context = await store.hydrateContext({ sessionId: crypto.randomUUID(), accessToken: crypto.randomUUID(), idea: 'INTERNAL RAG SMOKE TEST ONLY. No customer research or product validation.' });
    await call({ operation: 'import', mode: 'url', record: { title: 'Tavily Extract official endpoint documentation — internal smoke source', publisher: 'Tavily documentation', url: 'https://docs.tavily.com/documentation/api-reference/endpoint/extract', tasks: ['knowledge'], region: 'global', limitations: 'Developer documentation extracted for an internal connectivity test; no market evidence.', consent: true } });
    console.log('PASS: Tavily extracted and stored actual website text.');
    const data = await call({ operation: 'ask', task: 'knowledge', query: 'How does Tavily Extract report successfully extracted URLs and URLs that failed? Use the official endpoint documentation.' });
    assert.equal(data.generated, true); assert.ok(data.answer.claims.length); assert.ok(data.snapshot.passages.some(p => p.provenance === 'tavily_extract'));
    const docIds = new Set(context.knowledgeDocuments.map(d => d.id));
    assert.ok(data.answer.claims.some(claim => claim.citations.some(c => docIds.has(data.snapshot.passages.find(p => p.passageId === c.passageId)?.id))), 'Answer must cite the actual extracted document.');
    assert.equal((await store.getContext(context.sessionId)).groundingRuns.length, 1);
    console.log(`PASS: ${data.attribution.provider} returned ${data.answer.claims.length} claims with validated exact source quotes; the grounded answer survived a server read.`);
  } finally {
    if (context) await store.deleteContext(context.sessionId, context.accessToken);
    assert.deepEqual(await fs.readdir(directory), []); await fs.rmdir(directory);
    console.log('PASS: Temporary project and retrieval records deleted.');
  }
}
main().catch(error => { console.error('FAIL:', error.message); process.exitCode = 1; });
