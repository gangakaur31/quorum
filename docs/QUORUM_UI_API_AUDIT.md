# Quorum UI and API follow-up audit

20 October 2026. Local changes only; no commit, push or deployment. `.env.local` and its credentials were preserved.

## UI review

Reviewed the production build in local headless Chrome at 1440, 1024, 768, 390 and 320 pixels. The review covers the landing page and expanded explanation, terminal and assumptions, artifact preview, every reviewer, scorecard and unknown scores, confidence gate and validation kit, inspection and final summary, marketing cards/comparison, all nine workspace views, private/public briefs, public interest form and unavailable/404 pages. Additional checks cover supplied-source fields, evidence editing, original interview notes, decision snapshots, loading/cancellation, short desktop height, keyboard tabs, dialog focus and reduced motion.

Fixed the observed issues:

- Grid content could widen inside the canvas and clip research, provenance, evidence and briefs. Grid tracks now shrink, and long labels/URLs wrap.
- Scorecard verdict copy used oversized bold monospace text in a cramped horizontal row. It now separates the status from readable explanatory text.
- Artifact title/status bars and section headings could collide at narrow widths. They wrap cleanly.
- Validation-kit and marketing cards now size to their available space; narrow forms and brief grids stack inside the desktop split pane as well as on phones.
- The generation meter could clip its decorations. Its middle column now shrinks with the card.
- Public experiment pages, including unavailable states, now have readable internal spacing and heading styles.
- Reviewer tabs now support arrows, Home/End and a single keyboard entry point with an associated panel.
- Returning to a different project/workspace resets local form/edit state so stale fields do not carry into another project.
- Reduced motion applies to the landing explanation's scrolling; short desktop terminals can scroll to their command input.
- Mobile generation brings the loading canvas into view with a visible cancel action; terminal messages scroll to the latest update.

`scripts/ui-audit.mjs` is a repeatable local Chrome DevTools audit, with clearly labelled static fixtures in `scripts/ui-audit-fixture.cjs`. It restricts fixtures to `artifacts/ui-test-data`, verifies layout bounds and keyboard behavior, and writes ignored screenshots plus a JSON report under `artifacts/ui-audit`. Browser-only interception pauses a generation request to inspect loading/cancellation; it does not supply a mock AI response to production code. Sandboxed previews are inspected through Chrome's separate iframe renderer. `scripts/ui-smoke.mjs` separately exercises real evidence saves, reload recovery and consented public form capture against isolated storage.

These are local Chrome checks, not a guarantee for every browser/device or arbitrary generated HTML. Fixture reviews and offers are explicitly synthetic internal QA data, never successful inference or customer evidence. Actual generated artifacts remain constrained by the existing sandbox.

Final browser result: **69 layout scenarios, zero out-of-bounds components, seven passing interaction checks, zero browser exceptions**. The separate production smoke passed assumption/evidence saving, deterministic decisions and history, reload recovery, reduced motion and mobile collapse, plus actual public visit/contact capture, private counts, closure and deletion. All temporary fixture/contact/project files were removed from the isolated test directory after verification. Screenshots of previews below the viewport can be blank in Chrome's full-page capture because they run in a separate sandboxed renderer; the audit also scrolls the preview into view and saves viewport screenshots after verifying its actual rendered text.

## Groq

A direct POST to Groq's completion endpoint with no model returned HTTP 400. The official [API reference](https://console.groq.com/docs/api-reference) marks `model` required. Sending no model cannot implement a working completion request.

Quorum now calls `/openai/v1/models` with the configured key, selects an active general text entry, and supplies that discovered value to `/openai/v1/chat/completions`. There is no pinned Groq model in the runtime defaults. Missing configuration or `GROQ_MODEL=auto` uses discovery. Explicit global/per-task model overrides remain intentional overrides. Catalog caching is isolated by credential; concurrent reviewers share discovery while keeping independent cancellation. Discovery/authentication failures remain errors.

Real Groq inference succeeded with strict `{connected:true}` validation and no fallback. This supersedes the earlier pinned-model HTTP 404 recorded in the implementation report. Gemini timed out after 15 seconds in both follow-up readiness runs. Claude, Tavily and hosted Redis were skipped because they are not configured. The current default selection remains Gemini when both Gemini and Groq keys exist with no `AI_PROVIDER` setting; set `AI_PROVIDER=groq` and restart to demo using Groq.

## Pre-demo checker

```powershell
npm.cmd run check:apis
npm.cmd run check:apis -- --base-url http://localhost:3000
npm.cmd run check:apis -- --require groq,tavily --output artifacts/preflight.json
```

The CLI performs real, bounded provider inference and validates responses without fallback or retries; checks configured search; tests an expiring temporary Redis key or local storage; and optionally checks all local API route guards. The optional route probes deliberately submit invalid inputs and never claim full agent workflows succeeded. Missing optional APIs produce SKIP; missing required APIs and every failed configured service produce FAIL. Exit codes are 0 for no failures, 1 for failed checks, and 2 for invalid options/unexpected CLI setup failure. `--json`, `--timeout` and `--help` are available. Reports omit credentials and upstream response bodies.

The real app-inclusive preflight produced **14 PASS, 1 FAIL (Gemini timeout), 3 SKIP**. Groq, local disk, the page, health, all nine POST guards and the missing-session route responded as expected. The skipped services were Anthropic, Tavily and Redis. This is an honest partial readiness result; selecting a working primary provider does not turn a failing optional configured provider into a passing service.

Automated tests cover auto discovery/coalescing/credential isolation/cancellation, readiness success/failure and contract checks, missing required services, temporary Redis cleanup, local cleanup, route guard contracts and running-app configuration mismatch. See the final verification entries in the implementation report for the full test/build results.
