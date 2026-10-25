# Fresh workspace entry

25 October 2026, India time.

Entering Quorum from the landing page now creates a fresh workspace with empty draft fields, even when a previous project is cached and marked active. Refreshing the page or exiting and entering again follows the same flow. The five-second intro and landing page remain unchanged.

The previous initialization selected the cached active/latest project and immediately requested its server snapshot. Initialization now loads only the saved-project menu. It ignores the old active selection, creates a new draft identity and makes no recovery or agent request. Saved projects and their private keys remain available in the dropdown; choosing one explicitly restores its server-owned snapshot. No saved server record is deleted by starting fresh.

Demo Autofill still updates only editable draft state. RUN or the feature's normal primary action is required to submit work. Empty entry/autofill drafts are not added to the saved-project archive, so repeated visits cannot push meaningful work out of its 20-project browser limit. The first saved action adds the current project normally. `/reload` remains an explicit recovery action for the current project.

Changed files: `components/dashboard.tsx`, `lib/project.ts`, the startup comment in `app/page.tsx`, and README. Existing browser recovery checks now explicitly select their fixture project after entering rather than relying on automatic restoration.

Verification: TypeScript, all **173 automated tests**, and the production build passed. `scripts/ui-fresh-start-check.mjs` passed **12 browser checks** with a genuinely stored internal QA project and a cached active-session key. It verified empty entry/refresh/re-entry, no automatic recovery/API request, zero requests on fill, generation only after RUN, explicit saved-project selection, preserved old work, fresh landing-feature inputs and zero browser exceptions. Generation was intercepted with an honest controlled error; no live model call was needed for this state-management change.

The dedicated browser and local QA server use `artifacts/ui-test-data`, never real project storage. Existing environment and saved-data files are checked against their initial hashes. No dependency, commit, push or deployment was added.

The existing complete demo regression also passed **88 browser checks and 16 layouts** after its recovery steps were updated to explicitly select the saved project. All protected files matched their baseline hashes, and the isolated test directory was empty after cleanup.
