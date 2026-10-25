# Claude-first and command-local demo autofill audit

24 October 2026. Baseline: Next.js 16.3.1, React 19.1, TypeScript 5.8; no runtime SDK for inference. The seven AI routes use the same fetch-based provider engine. The baseline suite passes all 123 tests. No commits, pushes or deployments are authorized. This document records the initial audit; the implementation report will distinguish final changes and verification.

## Existing architecture and findings

- App Router entry `app/page.tsx`: five-second intro, landing page, explicit terminal/workspace entry. `components/dashboard.tsx` owns command input, project identity, offer generation, streaming jury, focused results and history.
- Inference routes: generate, jury, marketing, confidence (interview-kit preparation), discover, interview and knowledge. Score aggregation, evidence decisions, legal checklist, briefs, storage and counts are deterministic. They should remain so.
- `lib/agents/provider-engine.ts` supplies real Anthropic Messages, Groq Chat Completions and Gemini generateContent adapters, schema checks, deadlines, cancellation, attribution and process-local health. Existing environment selection is Groq; an Anthropic key is present. Existing fallback is opt-in and transient-only, which does not meet the new requirement.
- Default Claude model is `claude-haiku-5-5`, confirmed in official Anthropic documentation on the audit date. Documentation lists it as active. Account access still requires a live test. No environment values will be overwritten.
- Jury commits each reviewer before SSE emission; targeted retries replace by persona and retain completed reviews. Context revisions reject obsolete work. Generated output history and private retrieval snapshots already exist.
- Retrieval already bounds passages and excludes other reviewers, private legal notes, contacts and keys. Model serialization currently sends unnecessary lexical-ranking metadata; Knowledge answers send passages and quote options with duplicate quotation text. Every task currently defaults to the same 8,192-token output cap.
- Source project context is server-owned. Local disk and Redis REST persistence use existing capability keys, expiry, serialization and explicit share allowlists. Existing `.quorum-data` must not be touched by tests.
- No current per-command autofill exists. Docs and browser fixtures contain an older fictional 2-10 person scenario; the new runtime fixture must use the requested shared ScopeSignal 5-30 person scenario without treating fictional customer events as evidence.
- Git reports Quorum as an existing untracked directory in a parent repository. No unrelated parent paths will be modified. Existing ignore rules exclude environment secrets, local data, browser profiles and verification artifacts. A protected-file/hash baseline was saved privately under ignored `artifacts/`.

## Actual input mapping

| Existing command/workspace | Actual inputs | Autofill boundary |
| --- | --- | --- |
| Offer entry `/artifact` | Terminal idea; audience, price, problem, current alternative | One control fills the current offer draft and its optional assumptions; no generation or save |
| `/discover` | Domain, customer, geography, resources, complexity, source mode; optional supplied title/URL/date/excerpt | Use live-search mode with sample constraints; never invent supplied public material |
| `/perspectives` | Profile name, role, behavior/budget/alternatives/authority/switching profile | Founder-defined simulation, not an actual participant |
| `/evidence` | Testable assumption; separate observation editor with hypothesis, category, direction, summary, source, excerpt, date, sample, limitations | Fill an unvalidated assumption through its real assumption form. Genuine observations/sources cannot be fabricated to complete an evidence form |
| `/interviews` | Assumption; participant alias, original notes, actual date and consent | Shared research assumption/preparation is safe; actual participant notes/date/consent require user-supplied material |
| `/experiments` | Assumption, name, method, metric, minimum sample, target; separate actual result fields | Eight eligible owners/four recent concrete examples; never autofill observed successes, denominator or result date |
| Quorum Live within `/experiments` | Assumption, title, CTA, operator/follow-up disclosure, public confirmation | Draft only; real owner/contact details and explicit publication confirmation remain user decisions |
| `/knowledge` | Question, task, location filter; import method/title/publisher/text/URL/date/region/task tags/limitations/permission | Authored hypothetical brief and relevant questions; no fabricated external source or legal authority |
| `/legal` | Product, business base, markets, location details, sector, activities; private task status/notes | Preparation scope only; unresolved locations remain explicit; no claim an adviser was consulted |
| Reviewer commands, `/angles`, `/kit` | No independent free-text form; use current project context | Do not invent redundant forms or controls. `/perspectives` supplies editable jury constraints |
| `/reviews`, `/scorecard`, `/inspect`, `/summary`, `/history`, `/decision`, `/brief` | Saved/deterministic output views | No autofill on read-only results or destructive/share/access actions |

Each applicable command needs a single local control, controlled React state, editable inputs and reversible replacement. It must not fetch, submit, create records, navigate or fill another command. Where a workspace has multiple input sections, the command-local mapping must preserve the distinction between hypothetical preparation and externally observed facts. Consent, genuine notes, source quotations, commitments and outcomes are not scenario defaults.

## Reference checks

- [Claude Haiku 5.5 model and capabilities](https://platform.claude.com/docs/en/models/haiku-5-5/overview).
- [Anthropic prompt caching and measured cache usage](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).

No source text, credentials, private prompts or real user records are included in this audit.
