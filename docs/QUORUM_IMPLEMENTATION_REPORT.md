# Quorum implementation and verification report

Latest 25 October startup correction: [Quorum now opens a fresh workspace](QUORUM_FRESH_START.md). Prior sessions are available only through explicit project selection; Autofill fills drafts and normal primary actions initiate work. Verification passes 173 tests, 12 targeted startup browser checks and the existing 88-check demo suite.

25 October India-time follow-up: the [hackathon polish report](QUORUM_HACKATHON_POLISH.md) covers complete scripted autofill inputs, persistent Demo labels and separate rehearsal decisions, removal of em dashes from application copy, and a responsive foundation for actual AI-generated websites. It supersedes the earlier blank-note/result sample behavior; existing real project data and provider precedence are preserved.

24 October follow-up: [Claude-first inference and command-local Demo Autofill](QUORUM_CLAUDE_AUTOFILL_REPORT.md) supersedes earlier provider-routing and verification statements below. All product inference now starts with Claude and uses Groq only after genuine unusable Claude output, with bounded retry/repair and measured usage diagnostics. Eight actual input commands have one local reversible ScopeSignal fill control each. The initial Claude HTTP 401 recovered with Groq; after an external environment update, current direct Claude/Groq and production-policy Claude probes all passed. Verification includes 162 tests and 63 autofill interactions. Historical results below retain their original dates and configuration.

20 October 2026. No commit, push or deployment was performed. Existing `.env.local`, the original `context.md`, Python utilities and unrelated projects were preserved.

Follow-up: the [UI and API audit](QUORUM_UI_API_AUDIT.md) records the full responsive review, UI fixes, automatic Groq selection and the new `npm run check:apis` pre-demo checker. Real Groq connectivity now succeeds; the earlier pinned-model failure below is retained as the original verification history. The follow-up automated suite has 85 passing tests and TypeScript/production build pass. Browser verification passes 69 layout scenarios and seven interaction checks, plus real isolated public-form capture and closure. Gemini still times out in the current live preflight.

21 October addition: [Legal preparation](QUORUM_LEGAL_PREPARATION.md) adds a private `/legal` workspace with explicit product/market scope, curated preparation questions, official references, task notes and private Markdown export. It provides no legal advice or compliance/launch clearance and makes no model calls. Verification now covers 95 passing automated tests, 75 browser layout scenarios and ten passing interaction checks. Earlier dated provider results above are historical; the later configuration check verified Gemini, Groq and Tavily successfully after provider selection and an account-accessible Gemini model were configured.

## 21 October follow-up: unified RAG

The original 20 October audit below is historical. The current implementation adds a unified BM25 retrieval service, 17 curated methodology/authority-reference summaries, private TXT/Markdown/pasted-text and Tavily URL imports, task/location filters, exact source excerpts, cited question answering and durable request provenance. All six AI workflows receive retrieved passages; deterministic decisions/counts and private legal-note exclusion remain intact. Source controls include edit, pause, refresh and deletion. No new dependencies, embedding service or deployment were added.

Current verification: **119 automated tests**, TypeScript and production build pass. Chrome checks pass across **75 existing layout scenarios / 10 interactions**, plus **five expanded Knowledge layouts / nine source-workflow interactions**. Real Tavily extraction ? retrieval ? a three-claim cited Groq answer ? persisted recovery ? cleanup passed. The app-inclusive preflight now reports **17 PASS, 0 FAIL, 2 SKIP**, including successful Groq/Gemini inference and Tavily search. This supersedes the earlier provider/access blockers below. Claude and hosted Redis remain unconfigured/unverified. `.env.local` was preserved.

See [unified RAG implementation and limits](QUORUM_RAG.md) for the source model, privacy boundaries, tests and `npm.cmd run check:rag` demo smoke command.

## 21 October follow-up: terminal experience and current landing page

The [terminal UX report](QUORUM_TERMINAL_UX.md) records focused output views, stable reading during streaming, slash-command suggestions, keyboard navigation, private saved output versions, exact-request source inspection, mobile refinements and the signal intro. The latest requested arrival flow shows that intro for five seconds on every page load, then opens the landing page; entering or resuming Quorum requires an explicit landing-page action. Reduced motion keeps the timed intro static. The landing page covers all implemented feature families, including unified RAG and legal preparation, with their material boundaries.

The current suite has **123 passing tests**, TypeScript and production build pass. Production Chrome checks cover **105 screen layouts / 10 interactions**, **7 intro/review layouts / 20 terminal interactions**, **5 expanded Knowledge layouts / 9 source interactions**, plus the isolated evidence/public-form smoke. No browser exceptions or page overflow were observed. Browser fixtures remain explicitly labelled internal QA; this UI pass did not rerun paid API probes. Existing credentials and unrelated projects were preserved. No deployment was performed.

## Product decision

Quorum should help solo technical founders and small B2B teams make the next bounded development decision: identify a risky assumption, challenge an offer, run a small real test, retain the source material, and revisit the decision. Broad discovery feeds, long AI reports and enterprise customer-research platforms are established alternatives. Discover is an entry point; evidence and decision continuity are the repeat-use hypothesis.

This customer segment, willingness to pay and weekly return behavior have not been validated with customers. The promise is a traceable next test, not predicted startup success or product-market fit. The [strategy document](QUORUM_PRODUCT_STRATEGY.md) contains alternatives, first-party competitor references, risks and prioritization. The [baseline audit](QUORUM_BASELINE_AUDIT.md) records what actually existed before changes; the [plan](QUORUM_IMPLEMENTATION_PLAN.md) records the implementation approach.

## Delivered workflow

| Area | Implemented behavior | Important boundary |
| --- | --- | --- |
| Discover | Constrained Tavily search or explicitly supplied source excerpts; validated source IDs and exact quotations; observations/inference/proposals separated; source ledger with dates and limitations | Tavily was not live-tested. Citation presence does not establish prevalence, causal support or buying intent. |
| Opportunity handoff | A selected stored opportunity becomes the project idea, customer/problem/alternative assumptions and testable hypotheses; sources remain attached through offer generation | Existing generated projects require a new project before selecting a different opportunity. |
| Knowledge Core | Bounded lexical retrieval over curated primary-source methodology, domain sources and only the current project's evidence; inspectable matched terms/provenance | No vector database, permanent learning or cross-customer data aggregation. |
| Offer and jury | Existing static HTML/CSP/empty-sandbox preview preserved; six reviewers run independently and stream after durable commits | These are simulated perspectives. No successful real inference was verified in this environment. |
| Custom customers | Founder-defined behavior, budget, alternatives, responsibility and purchasing constraints applied to a selected role; profile named in result and stored context | One active focused profile; clearly an AI simulation. Public-figure perspectives deferred. |
| Scoring | Explicit versioned anchors, null unknowns, corrected price polarity, panel coverage, ranges/dispersion, typed risks and specific objections | Ordinal/descriptive AI assessments, not calibrated probabilities or independent customer samples. |
| Evidence | Assumptions plus supporting, contradicting or mixed records; research/statements/behavior/commitments distinguished; sources/excerpts/dates/sample sizes/limitations retained; edit/delete | Founder reports are not independently verified. Records are not independent participants. |
| Interviews | Preparation guide/outreach, consented manual notes/transcript import, real-model synthesis with exact-source quote validation, explicit promotion to ledger | No recruiting, recording or transcription service; source notes may not be verbatim recordings. |
| Experiments | Criteria recorded before results and immutable thereafter; numerator/denominator/date/limitations; threshold comparisons remain preliminary | Historical results cannot be presented as prespecified; no statistical superiority claims. |
| Quorum Live | Separate public offer URL, actual consented interest/interview form, optional visit measurement, deduplication, source tags, private contacts/metrics, close/delete controls and ledger handoff | Public reachability needs a public deployment. Email is not verified, sent automatically or treated as payment. |
| Decision and brief | Inspectable deterministic evidence rule; dated evidence/assumption/experiment snapshots; private source inspection; explicit revocable public brief with decision/category counts | Shared briefs omit raw sources and warn readers about that omission. AI text may still reflect supplied material and requires review before sharing. |
| Continuity | Multiple browser projects, server-authoritative snapshots, atomic local files, Redis REST option, export/access restore, deletion and expiry | Capability keys, not accounts. An export does not restore an expired server record. |

## Reliability and architecture

The Next.js architecture and small dependency footprint remain. No runtime dependencies were added. The legacy provider function names remain compatible, while all operations route through one configurable provider engine. Anthropic Messages, Gemini generateContent and Groq Chat Completions have distinct request/response mapping.

Provider execution now includes explicit selection and per-task overrides, normalized safe errors, bounded transient retries, deadlines, cancellation, strict output contracts, opt-in transient fallback, actual provider/model attribution, token usage when supplied, and process-local diagnostics. Credentials never enter browser bundles or URLs. Invalid outputs, billing/authentication errors and unsupported models cannot turn into placeholder successes.

Jury results and failures are saved individually before SSE emission. Targeted retries preserve other completed reviewers and replace by persona instead of duplicating records. All-failed runs retain their failures. Disconnected clients can reload server-committed results. Context revisions exclude stale results, including reviews that complete after new evidence or a profile change. Existing reviews remain inspectable. Marketing runs are invalidated when their underlying project context changes.

Price resistance keeps its original negative meaning: a high raw score is worse. Only favorable comparison uses `6 - resistance`. Unknown and missing values remain visible. One reviewer cannot establish QUORUM, and unanimous negative assessments can agree without implying desirability. Synthetic agreement never authorizes BUILD.

Evidence decisions are rules, separate from optional AI interview-kit generation. Missing assumptions yield INSUFFICIENT EVIDENCE; absent behavioral support yields TEST; direct contradictions or missed prespecified criteria yield ITERATE/PIVOT. Unresolved mixed direct evidence and contradicting research block BUILD. BUILD requires behavioral support for every stored assumption, a sufficiently sampled prespecified test meeting its own criterion, and an associated supporting commitment. This is a conservative workflow heuristic for a bounded milestone, not validated prediction.

Private project writes require a separate capability key and ignore client-submitted derived results. Requests send identity/creation inputs instead of repeatedly uploading all private records. Local writes are atomic; Redis mutations use bounded owner-checked leases. Persistence failures are reported. Explicit sharing/deletion and public capture use ownership and serialization safeguards. Public offer identifiers are bound to the owner, preventing another project from reclaiming a known expired link.

## Design and animation

The dark terminal, green signal color, mono typography, left/right layout, artifact preview and original inspection/score components remain recognizable. Added workspace navigation and sparkle entry, command history, cancellation, readable errors, honest elapsed-time status, project switching, source details, explicit sharing review and focus handling. Desktop keeps the terminal visible; mobile has a collapsible terminal and no horizontal overflow in the verified 390 px view.

The provided `Animation Components.txt` was evaluated fully. Heavy stars/particle physics/WebGL tunnels/full-screen shaders were rejected for this evidence workflow. Short opacity/translation reveals and the existing lightweight loading vocabulary were adapted. The original audit used a short skippable intro with a returning-project bypass; the 21 October arrival-flow update above replaces that behavior with a five-second intro followed by the landing page. Reduced motion disables animation. Time-based pretend completion/ETA and made-up internal thinking stages were removed.

## Verification actually performed

| Check | Result |
| --- | --- |
| Unchanged baseline TypeScript and production build | Passed |
| Installed dependency tree: `npm.cmd ls --depth=0` | Passed; no new dependencies |
| Final TypeScript: `npm.cmd run lint` | Passed; this script is TypeScript, not ESLint |
| Automated suite: `npm.cmd test` | 74 passing tests after the final storage restart regression |
| Production build: `npm.cmd run build` | Passed with all new API/public routes, no build warnings |
| Local persistence | Real filesystem reads/writes, concurrency, failure, expiry, access and sharing tests; recovery from a fresh Node process |
| Redis | Deterministic mocked REST command/lease/failure mapping; no live hosted round trip |
| Production browser: 1440 px desktop / 390 px mobile | Passed assumption/evidence saves, evidence decision, history, reload recovery, layout/overflow, mobile terminal collapse, reduced motion, no browser exceptions |
| Public experiment in production browser | Passed local publication, sandboxed offer, measurement consent, contact consent/form save, actual private counts and closure |
| Real selected Gemini smoke | HTTP 503 provider unavailable; no valid inference result accepted |
| Real Groq smoke | HTTP 404 for the selected model/account; no valid inference result accepted |
| Claude / Tavily / public hosting | Not live-tested / not deployed |

The automated suite covers provider contracts, selection, credentials, permanent/transient errors, retries, fallback, malformed/truncated output, deadlines/cancellation, partial/all-failed jury state, source/quote validation, actual Discover-to-offer context handoff, interview invalid-retry preservation, scoring, evidence rules, context invalidation, private storage/sharing, Redis mapping, and real stored experiment capture.

Browser checks used a dedicated headless Chrome profile, a separate local origin and `artifacts/ui-test-data`. The public offer used an explicitly labelled static **internal test fixture**, not an asserted AI response; the email was an internal test address. All temporary project/contact/visit records were deleted afterward and the test data directory was checked empty. Screenshots under ignored `artifacts/` are verification artifacts, not customer research. These checks are not evidence that any customer validated Quorum or a startup idea.

No clean dependency reinstall was needed or claimed. The existing dependency tree was verified. The live service errors above establish honest failure behavior, not successful real generation. Current defaults were checked against official [Gemini](https://ai.google.dev/gemini-api/docs/models), [Claude](https://platform.claude.com/docs/en/models/overview) and [Groq](https://console.groq.com/docs/models) documentation; documented existence does not grant this account model access. [Tavily's HTTP contract](https://docs.tavily.com/documentation/api-reference/endpoint/search) was checked for the retrieval implementation.

## Activation and remaining limits

1. Verify an account-accessible provider/model and successful `node scripts/provider-smoke.cjs` response. Current Gemini/Groq smoke failures remain external blockers to verified successful AI generation. `.env.local` was not changed to hide them or silently select another provider.
2. Add `TAVILY_API_KEY` for live Discover; supplied excerpts remain an explicitly attributed alternative. Configure `KV_REST_API_URL` and `KV_REST_API_TOKEN` for ephemeral hosting and test the deployed integration.
3. Public URLs need an authorized public deployment, durable storage and owner-supplied contact/data-use text. No deployment, email service, payment integration, calibrated A/B allocation or winner inference is included.
4. Local storage assumes one Node process and a persistent disk. Server projects have 14-day inactivity expiry; shared snapshots expire after 14 days; live contacts/experiments expire 14 days from creation. Local physical cleanup is opportunistic. Browser cache/export copies need their own deletion. The store has a 2 MB archive limit and bounded record counts, with explicit errors rather than silent eviction.
5. There are no accounts/team permissions, account recovery, encryption added by this app, distributed rate-limit service or enterprise bot protection. Before broad paid-key public access, add an invite/account boundary and gateway controls. Public contact signals remain uncontrolled, self-selected and unverified.
6. Public-figure simulations, automatic recruiting/recording/transcription, verified payment signals, cross-customer learning and larger reviewer panels were deliberately deferred to protect the working loop.

The most valuable product step after restoring successful provider access is a founder study measuring whether people complete a real test, return with new evidence, and can explain the changed decision. That is the unvalidated value proposition; more agents or visual effects will not establish it.
