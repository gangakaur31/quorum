# Quorum terminal experience follow-up

25 October startup update: [new visits now open empty drafts](QUORUM_FRESH_START.md). Saved-project recovery requires an explicit dropdown selection. The older arrival-flow verification below is retained as history; the intro and landing-page sequence remain.

21 October 2026. The terminal-led layout, dark command area, green signal color, warm reading canvas and complete underlying results are preserved. This update gives each output its own reading space and makes navigation, source inspection and reuse more explicit. No runtime dependency, credential change, commit, push or deployment was added.

## Reading and navigation

- Offer, Reviews, Scorecard, Angles, Interview kit and Summary have separate views. Review cards keep the strongest case, main objection, what could change the assessment, next test, assumptions, unknown scores and provider details. The kit retains its recorded decision context in an expandable section.
- Reviews arriving in the background do not replace the selected reviewer. New perspectives get an unread notice. Terminal logs follow activity only while the reader is near the bottom; otherwise a count and explicit jump action preserve the reading position.
- Slash-command suggestions show descriptions, prerequisites and whether the command makes an AI request. Prefix matches rank first. Arrow keys navigate, Tab/Enter accepts a partial suggestion without executing it, and Enter runs the accepted command. Ctrl/Cmd+K reveals and focuses the terminal on mobile as well as desktop. `/help` lists commands.
- Source inspection opens a scrollable modal drawer with focus containment, Escape dismissal and focus restoration. Selected reviews and saved versions use their original retrieval identifier. If that snapshot was not retained, the inspector discloses the gap and does not substitute current sources. Other source views distinguish current previews from saved AI inputs.
- Body text, spacing, contrast and touch targets are improved. Mobile navigation, result tabs and reviewer tabs scroll within their own strips. The page itself fits the viewport down to the verified 320 px width. Reduced motion suppresses transitions.

## Saved outputs and privacy

Successful offer, review, angles and kit outputs, plus completed/partial/failed panel scorecards, are saved with timestamps and project-context revisions. `/history` and View result read those records without inference. Run again explicitly creates a new request with the current project context. Existing current results remain available; earlier outputs are not reconstructed for projects that predate this update.

History is server-owned, uses the existing capability key and persistence path, and is excluded from public briefs. It retains at most 16 records within an approximately 500 KB history allowance and the existing 2 MB project allowance. Current results are separate from this rolling history. Original retrieval snapshots have their own bounded retention and may expire from the project before a corresponding output version. Clearing versions preserves current results; deleting a project removes its server record. Private exports contain retained versions and require separate deletion. Existing project expiry and restore limits still apply.

Each streamed review is saved before emission, including its source-snapshot identifier. Targeted retries retain previous versions. History requests cannot overwrite derived results through client-submitted project data. These changes do not alter score semantics, evidence-decision rules or sharing consent.

## First visit and landing page

The intro now builds through three visual beats: six perspective markers arrive, traveling signals converge around a glass-like hexagonal Q, and the Quorum wordmark reveals letter by letter. Rotating orbit arcs, gyroscope contours, soft expanding rings and a perspective grid give the scene depth. It uses SVG and CSS without new dependencies, WebGL or external media. The original rocket/planet exports used during actual offer generation are preserved.

Following the requested arrival-flow update, it plays for five seconds on every page load, including returning projects and repeat visits. It then opens the landing page; entering or resuming Quorum requires a landing-page action. There is no early skip. Reduced-motion preferences show the complete static composition and hide traveling signals/expanding rings. The intro does not claim API readiness or show invented progress. The scene scales with viewport height, uses compact perspective markers on narrow phones and switches to a side-by-side composition in short landscape viewports.

The landing feature copy now maps to implemented workspaces:

| Entry | Implemented coverage |
| --- | --- |
| Discover | Tavily search or supplied excerpts, provenance and separate interpretations |
| Offer | Static sandboxed landing offer and alternative marketing angles |
| Perspectives | Six simulated roles, custom profiles, unknowns and focused reviews |
| Knowledge | Text/Markdown/Tavily imports, unified retrieval and cited questions |
| Evidence | Supporting/contradicting records, inspectable rules and dated decisions |
| Interviews | Preparation kit, consented imported notes and exact-quote synthesis |
| Experiments | Criteria before results and Quorum Live consented interest forms |
| Legal preparation | Product/location checklist, authority references and adviser questions |
| Continuity | Saved outputs, decision history, private export and reviewed revocable sharing |

Feature links enter their actual command workspace. Copy identifies simulations, legal-preparation limits, public-hosting needs, provider processing, private access keys and 14-day server inactivity expiry. No customer validation, legal clearance or successful provider call is implied by opening the page.

## Verification

TypeScript (`npm.cmd run lint`), **123 automated tests** (`npm.cmd test`) and the production build pass. Tests cover immutable version payloads, context/source references, bounded history, server ownership, clearing, public-share exclusion, command matching/prerequisites, partial/all-failed jury runs and targeted retries.

Production Chrome checks used a dedicated profile, local port 3002 and isolated `artifacts/ui-test-data`:

| Script | Verified result |
| --- | --- |
| `scripts/ui-audit.mjs` | 105 screen layouts and 10 interaction checks; no page overflow, escaped content or browser exceptions |
| `scripts/ui-terminal-check.mjs` | 28 interaction checks and 7 layouts, including five-second arrival, explicit entry, saved-project recovery, streaming stability, unread activity, keyboard commands, source focus, history and explicit rerun |
| `scripts/ui-intro-check.mjs` | Three staged animation captures, six portrait/landscape layouts, complete wordmark visibility and static reduced-motion rendering |
| `scripts/ui-rag-check.mjs` | 9 source-workflow interactions and 5 expanded Knowledge layouts |
| `scripts/ui-smoke.mjs` | Evidence saves, decision/history, reload recovery, mobile collapse/reduced motion and actual local public-form consent, counts, closure and deletion |

Screen widths include 1440, 1024, 768, 390 and 320 px. The new layout checks compare the actual layout viewport with the requested width, preventing a widened mobile viewport from hiding overflow. A discovered grid min-content expansion was fixed with bounded columns.

The requested arrival-flow follow-up passed TypeScript and production build checks. The updated terminal browser check measured 5,121 ms for a first visit, 5,080 ms with an existing project and legacy intro flag, and 5,066 ms with reduced motion. Each case reached the landing page and waited for explicit workspace entry. Saved project recovery after clicking Start your Quorum passed; no browser exceptions or page overflow were observed.

The subsequent visual redesign passed TypeScript and production build checks. Intro snapshots were inspected at gather/converge/reveal stages and at 1440x950, 1024x768, 768x1024, 390x844, 320x568 and 844x390. All six final layouts fit without horizontal/vertical page overflow or clipped foreground content. Reduced motion had zero active animations and a fully visible wordmark. The 28-check terminal suite also passed with the redesigned intro. Screenshots and the layout report are under ignored `artifacts/intro-cinematic/`; no live model calls were needed.

All generated content in these browser checks is explicitly labelled internal QA data. The terminal-stream test uses a controlled browser-only SSE transport to check arrival order and cancellation; no mock provider was added to production. The public form uses a static internal offer and an internal test address. These checks establish UI/storage behavior, not successful live inference or customer validation. No paid provider probes were rerun for this UI update; earlier real-service results remain in the RAG report. Temporary project/contact/visit records were removed after verification. Screenshots and reports are under ignored `artifacts/`.
