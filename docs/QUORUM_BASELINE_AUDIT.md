# Quorum baseline audit

Inspected 20 October 2026, before implementation. This records the starting repository, not the completed upgrade. The project overview was read from the DOCX XML and checked against the TypeScript application. The separate Python utilities are not the web backend.

## Verification

- The existing installed dependencies run successfully. `npm.cmd run lint` (TypeScript, not ESLint) and `npm.cmd run build` both passed before modifications.
- PowerShell blocks the `npm.ps1` wrapper; using `npm.cmd` avoids changing execution policy.
- The baseline has no web test runner or product regression suite. Python calculator tests do not validate Quorum.
- `.env.example` was absent from disk despite README instructions and the IDE tab. Credential availability does not establish successful live inference.
- A clean dependency installation, external provider request and deployed Redis round trip were not established by the baseline build.

## Actual architecture and capability inventory

Next.js App Router / React 19 / TypeScript with server-side HTTP model adapters, a client-owned session snapshot, streamed generation/jury routes, deterministic score aggregation, a process cache and optional Redis REST persistence. The existing small dependency footprint is appropriate; preserve this architecture.

| Capability | What source actually implements | Boundary |
| --- | --- | --- |
| Terminal and assumptions | Idea entry, guided/slash commands, target customer/problem/price/alternative | New session on mount; textarea disabled during work; no recallable command history |
| Landing artifact | Real Gemini/Groq call, structured HTML, headline and claims | Requires a working provider; static preview, no publishing or lead capture |
| Six-persona jury | Concurrent independently prompted calls, SSE results, steelman/objection/evidence request | Model simulations, not customers; role prompts are mostly short descriptions |
| Scorecard | Arithmetic means/ranges and agreement threshold | No real evidence input, unknown ratings, missing-data policy or calibration |
| Confidence Gate | Real model call using current jury/scorecard and five-question kit | A synthetic `significant` boolean; no evidence ledger or empirical decision guard |
| Marketing angles | Real generation; evaluate angles with the jury and store runs | Synthetic message review, not traffic experiments or conversion comparisons |
| Decision Brief | Read-only server route from session | Session ID gives access; no explicit publish/revoke boundary |
| Persistence | Global Map; optional REST Redis with 14-day TTL; write-only context.md | Local file is overwritten per session and never hydrated; without Redis restart loses projects |
| Discover/Knowledge Core | Absent | No web search, source records, retrieval or opportunity handoff |
| Interviews/experiments | Generated instructions only | No collected notes, observations, consent, analytics or real experiments |

## Strong work to preserve

The left terminal and right artifact panel are distinctive and already usable. A concrete safe artifact makes criticism less abstract. Independent requests stream promptly, and normal juror failures do not stop other calls. Structured critique includes a steelman and an actionable evidence request. Marketing variants reuse the scoring path. The code correctly avoids private chain-of-thought. Artifact defense combines sanitization, a restrictive CSP and an empty iframe sandbox.

## Correctness and trust gaps

1. `price_resistance` is named as a negative dimension but averaged as positive in strongest-persona selection and main-objection ranking. Neither prompt nor UI establishes behavioral anchors. A lone reviewer always produces zero spread and `QUORUM`; unanimous rejection also becomes `QUORUM`. Agreement must be labeled separately from desirability and demand.
2. Ratings are all required integers. Unknown price or missing evidence forces invented precision. No missing/failed panel coverage appears in aggregation. Keyword risk classification can override a more relevant specific objection.
3. The Confidence Gate prompt asks whether synthetic evaluation is significant enough to guide spending. Its boolean is unrestricted by observed evidence. Schema checking counts five questions before filtering invalid items, so accepted output can contain fewer than five.
4. `hydrateContext` trusts and merges client-derived fields; scorecards and gate state can be stale or forged. Regenerating an artifact does not invalidate dependent reviews and decisions.
5. Jury output is persisted only after all requests finish. A disconnected stream can lose completed results; all-failed runs do not persist their failure state. There is no bounded request timeout, cancellation or explicit interrupted-stream recovery contract in the original routes.
6. Provider selection is hardwired by operation with automatic cross-provider fallback. Claude is absent. Failures lose useful error categories and successful outputs lack actual provider/model attribution.
7. `persistContext` swallows persistence failures through `Promise.allSettled`. Sharing claims durability from configuration presence, not a verified successful write. A single global `context.md` is not a project store and can leak the last private idea into a working tree.
8. The session API/brief expose the stored snapshot to possession of a session identifier. There is no distinction between editing authority and public sharing, no revocation, and no account isolation. Request schemas, lengths and rate limits are largely missing.
9. The browser owns ephemeral state and cannot restore a project after reload. Busy state disables the control surface. The wait meter is time-based and not real completion; rotating text implies internal progress that the server did not report.

## Animation reference assessment

The supplied reference is **Animation Components.txt**, not `animation.txt`; its entire 2,459-line content was read. References include parallax stars, p5 force-field particles, a CSS speeder loader, a duplicated Three.js Hyperspeed implementation, and Plasma / Smoke Ring shader descriptions.

| Reference | Decision and reason |
| --- | --- |
| Stars | Do not add persistent thousands-particle motion behind readable evidence. A static sparse texture is sufficient if needed. |
| Force field | Reject p5 dependency, remote-image requirement and per-frame cursor physics for this workspace. |
| Speeder | Retain/adapt existing lightweight CSS loader vocabulary for actual waiting states; remove fictitious latency/system/progress claims. |
| Hyperspeed | Adopt only short opacity/translation state reveals. Reject continuous WebGL tunnel, page-wide pointer capture and speed interaction. The reference itself describes its geometry as a demonstration. |
| Plasma / Smoke Ring | Reject full-viewport shader takeover. Preserve their useful reduced-motion/static-fallback principle. |

Motion should communicate a panel opening, response arriving or task status changing. It must stop under reduced motion, avoid delaying controls and require no GPU framework.

## Smallest reliable path

Correct provider/score semantics first; make project state durable and sharing explicit; add one common evidence model; ground Discover in retrieved or clearly attributed user-provided sources; preserve the selected opportunity into idea generation; collect interview notes and prespecified experiment outcomes; recompute an evidence-aware decision and brief. Keep the terminal and existing useful artifact/jury/angle work. Defer broad integrations, celebrity simulations and a universal startup operating system until this loop works.
