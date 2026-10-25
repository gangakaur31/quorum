# Claude-first inference and command-local Demo Autofill

Later follow-up, 25 October India time: the user requested complete scripted demo records and improved generated websites. The [hackathon polish report](QUORUM_HACKATHON_POLISH.md) supersedes this report's blank-note/result autofill boundary. The provider-order policy remains unchanged; this earlier verification is retained as dated history.

24 October 2026. Implementation in the existing API-only Quorum Core application. The terminal/workspace design and existing workflow handlers remain. No dependencies, integrations, commits, pushes or deployments were added. Existing credential files and user records were preserved. The [initial audit](QUORUM_CLAUDE_AUTOFILL_AUDIT.md) records the baseline and actual input mapping.

## Central provider policy

All seven inference routes use `askJson` in `lib/agents/provider-engine.ts`: Discover, offer generation, jury, marketing, interview-kit preparation (`confidence`), interview synthesis and Knowledge answers. Custom customer perspectives use the same jury route; objections and scorecards come from its validated review contract. Research summaries use Discover/Knowledge. Evidence decisions, score arithmetic, legal preparation, decision briefs/history, persistence and metrics remain deterministic and make no new AI calls.

The production order is **Claude, then configured Groq after unusable Claude output**. Legacy `AI_PROVIDER`, foreign per-task provider/model overrides and `AI_FALLBACK_PROVIDERS` cannot send a product request to Groq or Gemini first. Existing compatibility wrappers also use this policy. Explicit adapter probes in developer scripts/preflight are separate and can deliberately test Gemini or Groq without changing production routing.

- A schema-valid Claude response returns immediately. Low scores, skeptical conclusions, negative recommendations and valid application abstentions are successes; they never trigger Groq.
- Each provider gets at most **two inference requests**: the initial request and either one transient retry or one structured-output repair. It never gets both extra requests. Maximum across both providers is four inference requests. Groq automatic model discovery can additionally perform its cached catalog GET; it is not an inference request.
- Network errors, timeouts, rate limits and service failures can receive one bounded retry. `Retry-After` is respected within the available budget. Authentication, billing, unsupported-model and oversized-context errors are not repeated; they can go directly to configured Groq.
- Empty/malformed JSON, schema failure and truncation can receive one repair requesting complete concise JSON against the original contract. Partial output and private validator errors are not copied into a repair prompt. Truncation recovery can increase the task output allowance by 1.5x, bounded by the global cap. Incomplete results are never accepted.
- Explicit provider refusal and user cancellation stop the operation; they do not switch providers. Missing Claude credentials produce a configuration error rather than silently running Groq alone. Healthy Claude does not require a Groq key.
- The default overall deadline is 50 seconds, capped at 55 seconds, with a default 20-second transport timeout. When Groq is configured, Claude gets at most the first 65% of the overall deadline; remaining time is reserved for recovery. Task overrides, such as Discover's 35-second inference deadline, retain this division. All retry delays and calls share that deadline.
- Successful fallback records the actual returned provider/model, failed Claude category, attempt history and validation status. Both-provider failure returns an actionable safe error. No fallback mock or placeholder success exists.

Offer/jury SSE now includes actual retry/provider-switch events. Model JSON remains buffered until validation; Groq output never appends to partial Claude output. Individual jury results are still durably committed before emission. Existing tests cover partial/all-failed panels, targeted retry replacement, disconnect recovery and rejection of stale context revisions.

## Configuration and live access

`ANTHROPIC_API_KEY` is the existing server credential. `ANTHROPIC_MODEL` overrides the documented `claude-haiku-5-5` default. Claude-specific task model overrides remain available; legacy model settings belonging to another provider are ignored. The default was checked against [Anthropic's Haiku 5.5 documentation](https://platform.claude.com/docs/en/models/haiku-5-5/overview). Documentation establishes the model's existence, not access for this account.

Groq recovery uses `GROQ_API_KEY` and the existing automatic model discovery when `GROQ_MODEL` is unset or `auto`. No fixed Groq model was inserted. Restart Quorum after changing its server environment. `.env.example` documents the new policy; existing `.env.local` and `.env` values were not rewritten.

Small real probes were performed without project data. An initial authentication failure was followed by successful verification after `.env.local` changed externally during the final checks:

| Probe | Observed result |
| --- | --- |
| Initial explicit Claude connectivity | Anthropic HTTP **401 authentication**; retained as verification history. |
| Initial central policy smoke | Claude authentication failure followed by a successful, schema-valid Groq response. Actual Groq model: `qwen/qwen3.8-27b`, chosen by discovery. Two attempts, zero retries, 5,467 ms total; Groq returned 53 input / 6 output / 59 total tokens. |
| Current explicit Claude connectivity | **Passed** at `2026-10-24T17:16:36.241Z`; `claude-haiku-5-5`, one attempt, 3,210 ms, 70 input / 9 output / 79 total tokens. |
| Current production-policy smoke | **Passed with Claude**, at `2026-10-24T17:17:05.413Z`; one attempt, no retry/fallback, 2,975 ms, 68 input / 9 output / 77 total tokens. Groq was not called. |
| Current explicit Groq connectivity | **Passed** at `2026-10-24T17:17:42.463Z`; automatically selected `qwen/qwen3.8-27b`, one attempt, 2,385 ms, 54 input / 6 output / 60 total tokens. This explicit diagnostic does not change product routing. |

The initial successful fallback probe completed at `2026-10-24T16:45:32.917Z`; its Claude/Groq attempt durations were 2,475/2,992 ms. During final verification, `.env.local` acquired a different hash and a `17:14:00.823Z` modification time without being written by this implementation. Its new contents were preserved, and the current probes above resolved the earlier authentication blocker. No credential was printed, copied into source or replaced by the agent. No real Claude cache hit or complete seven-feature live Claude journey is claimed; the tiny successful probes did not request caching and returned zero Claude cache-read/write tokens.

## Token and call reductions actually implemented

`lib/agents/task-policy.ts` provides task output ceilings rather than using the same large allowance everywhere:

| Task | Initial output ceiling |
| --- | ---: |
| Offer HTML generation | 8,192 |
| Discover | 4,096 |
| Knowledge / interview synthesis | 2,048 |
| Jury reviewer / interview kit | 1,600 |
| Marketing angles | 1,200 |
| Connectivity / readiness probe | 256 |

`AI_MAX_OUTPUT_TOKENS` remains a global safety cap. These limits are not claimed measured consumption or savings; actual use depends on the provider response. Required evidence references, unknowns, contradictory evidence and limitations remain in the contracts. Reviewer instructions request concise conclusions rather than hidden chain-of-thought.

The existing bounded, task-relevant BM25 retrieval remains shared. Model context no longer repeats lexical scores, matched search terms and text offsets; full snapshots retain them for inspection. Knowledge question answering avoids repeating passage text when its quote options cover every non-whitespace character. If citation choices exclude short lines or reach their item limit, the full original passage remains in context; a short negative answer such as "No." cannot disappear to save tokens. Discover does not duplicate directly supplied research sources in its additional retrieval context. Source IDs, original excerpts, provenance, version/dates and limitations are retained. Independent jurors do not receive one another's responses.

An identical Knowledge question reuses an existing answer only within the same project, task, context revision and legal scope, with identical compact model context, quote options and limitations. The UI labels the saved answer as reused. Changed source content/scope, clearing source history, or `force: true` requires a new request. No cross-customer response cache was added.

The common jury rubric is now a stable system prefix placed before role-specific instructions. On supported Claude 5 models, an explicit sufficiently long prefix requests ephemeral prompt caching using the [documented API format](https://platform.claude.com/docs/en/build-with-claude/prompt-caching). Private project input remains outside that prefix; no padding was added. Prefix length is a conservative request heuristic, not a claim of provider token eligibility or a cache hit. Set `AI_PROMPT_CACHE=off` to disable the request. Actual `cache_read_input_tokens` / `cache_creation_input_tokens` fields are needed to establish cache use. No live jury cache-hit measurement was performed.

Successful attribution and per-attempt records capture actual durations, retries, fallback and schema status, plus token usage only when returned. Reported usage on failed/truncated responses is retained when available. Anthropic uncached input, cache reads/writes and output are distinct; its total includes those components. Groq's returned cached input is included within its input count and is not added twice. Missing fields remain unknown. `/api/health` exposes safe process-local aggregate counts/usage without prompts, keys or project identities. These are neither durable monitoring nor proof of connectivity. No percentage savings, billing savings or fabricated cache metrics are reported.

## One Demo Autofill control per input command

`lib/demo-scenario.ts` holds the typed **ScopeSignal - Agency Change Request Workflow** scenario. It consistently describes agencies of approximately 5-30 employees, scattered scope/estimate/written approval, existing email/WhatsApp/spreadsheet/document/project tools, unknown pricing, and a proposed eight-owner/four-recent-example exploratory test. It contains no purported completed study, real participant, verified commitment, payment or external quotation.

`components/demo-autofill.tsx` supplies one command-scoped controller, controlled React form drafts, an accessible `type="button"` control and reversible replacement. Its callback does not fetch, touch DOM fields, submit, navigate, save or trigger a workflow. The existing normal action validates and executes the original handler afterward. **Undo fill** restores the immediately previous draft; an identical repeated fill preserves the original Undo snapshot. All fields remain editable. Existing launch/navigation/project/refresh defaults are retained; no global demo mode exists.

| Actual command | One top-level control fills |
| --- | --- |
| `/artifact`, before an offer exists | Terminal idea and all four optional founder assumptions. RUN remains the generation action. |
| `/discover` | All five constraints and live-search mode. Supplied-source fields stay blank. |
| `/perspectives` | Profile name, selected reviewer role and complete fictional behavior/budget/alternatives/purchasing profile. |
| `/evidence` | Testable founder assumption and responsible observation-editor defaults/limitations; a matching existing assumption can be selected. |
| `/interviews` | Testable research assumption and matching assumption selection. |
| `/experiments` | Assumption, proposed test name/method/metric/minimum sample/target, and its Live publication draft when that section is available. |
| `/knowledge` | Question, task and location filter, plus the authored hypothetical source-import draft, source metadata and feature tags. |
| `/legal` | Product/location uncertainty, sector/activities, and existing checklist preparation drafts. Task status is `preparing`, never an assertion of adviser discussion. |

Each of these commands renders exactly one Autofill control near the top of its first input form. Multiple sections in a command share that one control. Live and source import do not add extra fill buttons. Reviewer/angle/kit commands without independent inputs retain their existing actions. Read-only review/score/history/decision/brief views and sharing/deletion/access controls receive no autofill button. The actual command names were preserved; no `/offer`, `/jury` or singular aliases were invented.

**Evidence integrity limits take precedence over filling an apparent completed record.** The source scenario contains no genuine observations or interview notes. Evidence summary/source/excerpt/collection date/sample size and interview participant/notes/date therefore stay blank; autofill does not make those records submittable as real evidence. The assumption can be saved through its original action, and a real interview can subsequently be imported. Experiment outcomes are untouched. Consent, source-processing permission and public publication confirmation stay unchecked. Live disclosure includes conspicuous placeholders for the owner's real contact details. Knowledge text is explicitly an authored unvalidated brief, with no invented public URL or publication date. Unrelated stored assumptions are not selected as ScopeSignal assumptions.

Thus the one-click promise applies to responsible scenario/preparation inputs. Completing an actual interview, source-based observation, permission or result still requires genuine material and a deliberate user action. This is an intentional boundary, not a claim that the sample has supplied every missing factual field. Sample founder inputs, AI simulations, retrieved public sources and customer behavior remain separate.

## Main files

- Central inference: `lib/agents/provider-engine.ts`, `provider-types.ts`, new `task-policy.ts`; `lib/prompts.ts`; the generate/jury/Discover/Knowledge/health routes.
- Retrieval and explicit probes: `lib/knowledge.ts`, `lib/preflight.ts`, `scripts/provider-smoke.cjs`, new `scripts/claude-fallback-smoke.cjs`.
- Demo inputs: new `lib/demo-scenario.ts`, `components/demo-autofill.tsx`, `app/demo-autofill.css`; dashboard, Discover, Evidence/Interviews/Experiments/Perspectives, Live, Knowledge and Legal components; stylesheet import in `app/layout.tsx`.
- Verification: new Claude-policy and demo-form tests, provider/route/retrieval/preflight regression updates, TSX support in the existing test loader, new `scripts/ui-autofill-check.mjs`, controlled-input helpers in existing browser scripts.
- Setup/reference: `.env.example`, README, this report, the initial audit and dated notes in the existing implementation report/demo runbook.

## Verification

| Check | Actual result |
| --- | --- |
| Baseline suite | 123 passing tests before edits |
| Final `npm.cmd run lint` | Passed; the existing script runs TypeScript, not ESLint |
| Final `npm.cmd test` | **162 passed**, zero failures/skips |
| Final `npm.cmd run build` | Passed; all existing API/public routes present, no build warnings |
| `npm.cmd ls --depth=0` | Passed; dependency files unchanged, no new dependencies |
| Final production autofill browser pass | **63 interactions / 16 filled layouts**, zero failures, zero runtime/console exceptions |
| Existing broad UI regression | **10 interactions / 105 layouts**, zero failures or browser exceptions |
| Existing Knowledge/source regression | **9 interactions / 5 expanded layouts**, zero failures or browser exceptions |
| Existing terminal/intro/reader regression | **28 interactions / 7 layouts**, zero failures or browser exceptions; five-second intro/landing entry retained |
| Existing evidence/public-form smoke | Passed normal assumption/evidence saves, deterministic decision/history/reload, desktop/mobile, sandboxed public offer, explicit visit/contact consent, real private counts and closure |
| Protected-file hashes | `src/quorum/.env`, `context.md`, `package.json`, `package-lock.json` unchanged. `.env.local` matched initially, then changed externally during final checks; the new contents were preserved and successfully live-tested. No existing credential file was written by the agent; only `.env.example` documentation changed. |
| API credential scan | Zero configured credential values found across 138 browser-bundle/source/document files |
| Verification artifact scan | Zero configured credential values found in text reports/logs |
| Original stored data | Four original files; none modified since the initial audit |

Provider tests cover all seven task routes, legacy-override precedence, valid negative results, healthy Claude with no Groq key, permanent/transient errors, bounded retry/repair, truncation, refusal/cancellation, fallback deadlines, safe both-provider errors, actual attribution and measured/missing/cache token fields. Existing route tests retain quote validation, source handoff, durable individual jury commits, all-failed panels, context invalidation, persistence and sharing. Knowledge tests cover safe text deduplication including short contradictory source lines, identical-input reuse, changed limitations, cleared history and project isolation.

The new browser script opens every actual input command, verifies one top-level control, checks defaults and mapped values, edits filled inputs, uses the original actions, checks Undo (including repeated identical fill), and proves zero API requests/saved-record changes from autofill. It checks project switching/new-project defaults, blank genuine evidence/result fields and deliberate consent. Project changes now clear the terminal's unsent idea and autofill Undo so drafts cannot leak into another project. Filled Discover/Evidence/Knowledge/Legal layouts pass at 1,440, 768, 390 and 320 px. Desktop and mobile screenshots were also visually inspected. Regressions cover stored source editing, checkbox states, sharing, keyboard focus, terminal reading position and history.

Browser execution used a dedicated headless Chrome profile, local port 3002 and `artifacts/ui-test-data`; external API credentials were blanked only in that isolated QA server process. AI execution/error checks used explicitly controlled browser transport failures; they **do not establish a successful live AI journey**. Real provider probes and mocked API-route contract tests establish their separate results above. Public offers and notes in browser fixtures were conspicuously labelled internal static QA, not AI results/customer research. Only tracked QA projects/contacts/visits were deleted; the isolated data directory was checked empty. Reports/screenshots are ignored artifacts, not research evidence.

One terminal regression attempt hit a Chrome DevTools connection timeout. Reopening the dedicated QA tab and rerunning passed all 28 checks; no application exception or product-code change was needed for that automation issue.

## Reproduce and remaining limits

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
# Tiny real Claude-only request; prints safe metadata, never the credential:
node scripts/provider-smoke.cjs anthropic
# Tiny real task through the product routing policy; may use configured Groq after failure:
node scripts/claude-fallback-smoke.cjs
# Optional full service readiness probes; each configured provider is tested explicitly:
npm.cmd run check:apis
```

Real probes can incur small provider charges. They do not log credentials or create project/contact records. Browser scripts require the documented dedicated Chrome debugging port, a separate local production server and `QUORUM_UI_TEST_DATA_DIR` pointing to `artifacts/ui-test-data`; do not run them against real project storage.

There is no remaining provider-connectivity blocker in the latest tiny Claude/Groq probes. A complete live seven-feature journey and actual jury cache hits were not verified; production behavior is also covered by the mocked provider/route contracts and isolated browser tests described above. Hosted Redis and a deployed serverless runtime were not tested; prior durability/expiry/permissions limits remain. In particular, Vercel still requires configured persistent Redis REST storage. No original customer data, environment credential values, unrelated projects or Python utilities were changed by this implementation, and no commit, push or deployment was performed.
