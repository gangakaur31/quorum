# Unified retrieval in Quorum

Implemented and verified 21 October 2026. No new runtime dependency, embedding subscription, database, commit or deployment was introduced. Existing provider selection and `.env.local` credentials were preserved.

## Use it

1. Open **/knowledge** in the navigation or terminal.
2. Import a TXT/Markdown file, paste authorised source text, or choose website extraction. Supply a title, publisher/origin, relevant features, jurisdiction and limitations; leave an unknown publication date blank.
3. Website imports use the existing `TAVILY_API_KEY`. Text imports need no retrieval API key. Relevant passages go to the existing configured AI provider, with the same explicit fallback policy. `AI_KNOWLEDGE_PROVIDER` / `AI_KNOWLEDGE_MODEL` optionally override the question-answering task.
4. Preview retrieval without an AI call. Ask a question to generate an answer with cited excerpts. No matches produces an abstention without inference.
5. Inspect the original stored text, dates, source, passage offsets, version, matched terms and BM25 scores. Pause, edit, refresh or delete sources. Updating a website requires another explicit extraction, not a scheduled crawl.
6. Generate or rerun Quorum's other AI features to use the new material. Adding sources does not rewrite an existing offer automatically. Successful request history is inspectable in Knowledge; source panels distinguish saved AI inputs from current previews.

## Source collections and retrieval

The shared read-only catalog contains **17 entries**: four original Quorum methodology summaries and thirteen summaries pointing to official legal/business authorities. These are explicitly labelled editorial/preparation summaries, not purported extractions or quotations from the linked pages. Links and review dates are visible. The catalog can be paused per project.

Each project additionally retrieves only its own imported documents, Discover source excerpts, evidence records, consented original interview notes, experiment plans/results and a bounded set of decision-history summaries. Other projects, access keys, public-form contacts, private legal notes and other jurors' responses never enter this corpus. Import consent covers storing the document and sending relevant passages to the configured provider. Interview consent already covers model processing.

Documents are split into exact contiguous passages of at most 1,100 characters with 120-character overlap and source offsets. Source versions change with content/metadata. A Unicode-aware tokenizer removes common English stop words; BM25 ranks eligible passages with title weighting. Feature and jurisdiction filters run before ranking. Up to eight passages are returned, with at most two from one document and exact-content deduplication. The default is six passages. An explicit question controls search; normal feature requests combine the task vocabulary with the founder's idea and assumptions.

**This release uses lexical BM25, not embeddings or a vector database.** It is a real retrieve-then-generate path; semantic synonym matching, multilingual relevance quality and calibrated ranking have not been established. Small regression queries verify expected retrieval, including a match late in a long document and abstention for irrelevant questions. This is not a general relevance benchmark or evidence that the system makes the best possible decision.

## Integration boundaries

| Feature | How retrieval is used |
| --- | --- |
| Discover | Methodology/private context supplements the actual search or supplied source ledger; opportunity observations still require valid IDs and exact quotes from that ledger. |
| Offer / marketing | Relevant passages reach generation. Source availability does not authorise fabricated metrics, customer claims or endorsements. |
| AI jury / custom perspective | Reviewers receive the same retrieved snapshot independently; other reviewers' answers remain excluded. Rubric and null/price semantics remain fixed. |
| Interviews | Retrieval guides synthesis; findings still require exact quotes from that interview's original consented notes. |
| Experiment planning | The optional AI kit receives retrieved context. Actual counts, locked criteria, public captures and comparisons remain deterministic. |
| Evidence / decisions / brief | The view shows current relevant passages, and Knowledge can answer source questions for that feature. The evidence rule and dated decision snapshots remain independent of AI text. |
| Legal preparation | Location-filtered curated authority-reference summaries are inspectable. Imported documents cannot override legal retrieval. Private legal task notes remain excluded from AI. Answers are preparation assistance, not advice, live verification of legislation, applicability determinations or launch clearance. |

All retrieved content is explicitly treated as untrusted data. This mitigates prompt injection through instructions and a fixed output contract; it does not establish immunity to a malicious document or guarantee faithful interpretation.

## Cited answers and durable provenance

For Knowledge answers, the model selects **excerpt IDs** from server-created quote options instead of retyping Markdown or JSON. The server maps each citation to its original source passage and quotation. Unknown IDs, uncited claims and invalid answers are rejected. The backward-compatible exact-quote validator can restore original whitespace after formatting changes; it never accepts changed words, case or punctuation.

An exact quotation establishes provenance, not that the AI's statement follows logically from it. Claims are labelled AI answers; founders must inspect the associated support and unresolved gaps. Contradictory evidence is retained, not resolved by a citation count.

Successful AI writes save their supplied retrieval snapshot atomically with the output. At most eight recent request snapshots are retained. A jury run shares one input snapshot; provider attribution remains on each individual reviewer. Failed requests do not become successful history. Stale context writes are rejected; legal answers additionally check the saved legal scope. Earlier reviews remain inspectable and source changes require fresh evaluation.

Source/evidence/interview/experiment/history changes clear retained input traces unless that same validated AI commit supplies its own snapshot. Removing an original private source therefore clears copies in retrieval history. Generated text, separately promoted evidence, published snapshots, browser cache copies and downloaded exports can still contain earlier material and require their own review/deletion.

## Ingestion, privacy and limits

- Twelve imported documents per project, each 30–60,000 characters. The existing 200 KB request and 2 MB server archive limits still apply; an oversized operation fails explicitly. No silent truncation of an imported document.
- TXT/Markdown only for file upload. PDF/DOCX needs text export or a pasted relevant excerpt. HTML is not executed; stored text and quotations render through React escaping.
- URL extraction contacts only Tavily's fixed `/extract` endpoint, with a 20-second deadline, public-looking HTTPS URL validation and a bounded upstream body. Quorum never directly fetches the arbitrary supplied host. Tavily receives the URL and handles extraction. HTTP 200 with a failed/empty extraction remains a failure. A failed refresh preserves the previous source.
- Metadata, permission and document IDs are validated server-side. Private writes require the project capability key and use existing atomic local storage / Redis lease handling. Stale editors and simultaneous refreshes cannot silently overwrite a changed document; a concurrent pause is retained.
- General source mutations use the write limit; questions and URL extraction also consume the inference limit. Existing limits are process-local, not a distributed abuse-control system.
- Shared public briefs exclude imported documents, retrieval questions, quotations/history, private evidence and legal notes. Generated offers/reviews can reflect private sources, so inspect the explicit sharing preview before publishing.
- Existing 14-day project inactivity expiry and private export/access rules continue to apply. No account, recovery, permanent learning, shared customer corpus, automatic crawling or document licensing service is added.

## Verification

The full automated suite passes **119 tests**. New coverage includes ingestion/metadata/permission contracts, exact source offsets and late-document retrieval, feature/location filters, irrelevant-query abstention, project isolation, legal-note/juror exclusion, quote IDs and exact quotations, malformed extraction, failed refresh preservation, ownership, privacy in shared snapshots, stale context/legal-scope writes, trace deletion, and actual passage handoff through all six existing AI routes. Groq's `json_validate_failed` HTTP 400 is now correctly classified as invalid output, not a missing model.

Production TypeScript and build checks passed. Chrome checked all ten workspaces and existing surfaces in **75 layout scenarios / 10 interaction checks**, plus **five expanded Knowledge layouts / nine RAG interaction checks** at 320, 390, 768, 1024 and 1440 pixels. Final checks found no horizontal overflow or browser exceptions. Upload/edit/pause/enable/delete/reload used actual local project writes. UI content was an explicitly labelled internal fixture, not customer research or asserted inference.

The real smoke test extracted the public Tavily endpoint documentation, retrieved its passages, received **three source-cited claims from the configured Groq provider using automatic model discovery**, and recovered the saved result with a server read. All temporary smoke projects were deleted. Earlier live attempts failed on quotation formatting or provider JSON output and were rejected; no fabricated success was substituted. The excerpt-ID contract subsequently passed. This verifies one real path, not every provider or question.

The app-inclusive preflight returned **17 PASS, 0 FAIL, 2 SKIP**: actual Groq/Gemini JSON inference, Tavily search, local storage, application/health and route guards passed; unconfigured Claude and Redis were skipped. Hosted Redis and deployment remain unverified.

```powershell
# Existing configured service readiness, including the Knowledge route:
npm.cmd run check:apis -- --base-url http://localhost:3000
# Actual URL extraction → retrieval → cited AI answer → storage → cleanup:
npm.cmd run check:rag
```

The latter uses a temporary isolated local project, contacts the configured Tavily and AI services, may incur small charges, and deletes its records in `finally`. It leaves `.env.local` unchanged. Browser reports/screenshots live under ignored `artifacts/ui-audit` and `artifacts/ui-rag`; readiness details are in `artifacts/preflight-rag.json`.

Implementation references: [Tavily Extract API](https://docs.tavily.com/documentation/api-reference/endpoint/extract), [Strategyzer's experiment methodology overview](https://www.strategyzer.com/library/testing-business-ideas-book), and the authority links catalogued in [legal preparation](QUORUM_LEGAL_PREPARATION.md). Source summaries and retrieval quality need ongoing review as the library grows.
