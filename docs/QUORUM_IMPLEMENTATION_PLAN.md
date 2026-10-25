# Implementation plan and acceptance contract

Decision: preserve Next.js, terminal on the left, safe generated artifact, six-role independent panel and marketing comparison. Build a repeatable assumption → challenge → test → evidence → decision workflow. Product strategy and baseline findings are in the companion documents.

1. Provider engine: one configured inference provider, real Anthropic/Groq/Gemini adapters, typed error categories, bounded retry and deadlines, cancellation, opt-in transient fallback, attribution, contract validation and deterministic adapter tests.
2. Evaluation: preserve raw price resistance (higher is worse), reverse only favorable aggregates, anchored/null scores, panel coverage, partial completion, typed risks, persist each result before emitting it, targeted retry.
3. Project foundation: local atomic JSON persistence; Redis REST for ephemeral deployments; private capability tokens, server-authoritative records, explicit redacted/revocable share snapshots, 14-day retention, export/deletion.
4. Evidence: typed assumptions, sourced observations, consented interview import and quote-checked synthesis, prespecified experiments, manual result capture, rule-based decision and dated history. AI opinions never count as observed demand.
5. Discover: optional Tavily search, exact source identifiers and excerpts; user-supplied material labelled separately; schema-validated opportunity research; selected idea preserves sources. Knowledge retrieval is small, inspectable lexical retrieval over curated frameworks and only the current project's data.
6. UI: terminal command history, workspace navigation, source inspection, persistent project resume, cancellation and honest partial errors; subtle CSS transitions, reduced motion and mobile layout.
7. Verification: Node tests for provider adapters/failures, scoring/validation, evidence decisions, storage/access/sharing, research provenance; TypeScript and production build; browser checks and controlled configured-provider smoke.

## Boundaries and risks

- No deployment, commit, push or modifications outside Quorum.
- No account system: browser-held project capability is required for private access. Losing browser data loses access unless the founder exports it.
- Local disk requires one Node process and persistent storage. Redis updates use a bounded project lease across instances; release checks ownership. Local storage and mocked Redis concurrency are tested separately from any live Redis integration.
- Live publishing and contact capture must remain optional until durable storage, a public host and privacy policy are configured. Prefer an honest functional experiment tracking slice over unverified analytics.
- Public-figure imitation is deferred unless source-grounded reviewer research can meet attribution requirements. Custom customer constraints are a separate simulation feature.
- Importing documents does not train models; retrieval includes provenance and an untrusted-data instruction boundary.
- External provider/search verification depends on configured credentials/network; report tests separately from mocks.
