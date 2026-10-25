# Legal preparation workspace

21 October 2026. Open `/legal` through the terminal or workspace navigation. No runtime dependency, provider credential, public deployment or model call was added for this feature. Existing API keys were preserved.

## What founders can do

Describe the actual product, identify the business base and customer markets, record local location details, choose a sector and select planned activities. A curated checklist selects preparation topics from those explicit answers. Each topic explains why it was included, questions to resolve, information/documents to gather and relevant official reference resources. Higher-sensitivity topics are marked for specialist discussion.

Foundation topics cover jurisdiction/scope, business setup, IP/licences and customer agreements/claims. Selected activities add privacy/security, sensitive information, children's access, payments, recurring billing, tracking/marketing, AI, user content/marketplaces, regulated sectors and cross-border questions.

Users can save private task notes and mark a topic To review, Preparing or Discussed with an adviser. These are founder-reported progress labels, with no compliance percentage or verified legal approval. The private Markdown download includes the saved scope, questions, preparation items, reference links, dates, notes and limitations. Users can delete this legal record independently of other project work.

## Legal boundaries

- This is preparation guidance, not legal advice, a legal opinion, a comprehensive obligations assessment, a contract generator or a compliance certificate.
- Country/region and activity selections flag questions to investigate. They do not establish that a particular law applies or that the product has been legally classified.
- India, US, EU/EEA and UK have an initial curated reference set. Other jurisdictions retain research questions without receiving another country's laws as substitutes. Local/state/member-state, sector and cross-border details need separate current research and qualified local advice.
- Official resources were reviewed on 21 October 2026. The review date identifies the reference edition; saving a project does not perform a live law check. Some government pages use JavaScript; authority search metadata was used to locate the MeitY DPDP resources and NSWS approvals portal.
- The feature states no fixed legal deadlines, registration thresholds, age cutoffs, universally required documents or fines. It asks users to verify current applicability, commencement dates, exceptions and transaction-specific requirements with the relevant authority/adviser.
- Legal preparation does not alter or authorise Quorum's evidence decision, publication, launch or BUILD milestone. Task notes are not independently verified advice. The app does not establish an attorney-client relationship or privilege.

## Official reference set

| Scope | Reference |
| --- | --- |
| International IP education | [WIPO: intellectual property for business](https://www.wipo.int/en/web/business) |
| India privacy framework and phased commencement | [MeitY: DPDP Rules, corrigenda and enforcement timeline](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025) |
| India activity/location approvals | [National Single Window System: Know Your Approvals](https://www.nsws.gov.in/) |
| India consumer rules | [Department of Consumer Affairs: consumer protection acts/rules](https://consumeraffairs.gov.in/pages/consumer-protection-acts) |
| US information security | [FTC: protecting personal information](https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business) |
| US children's privacy | [FTC: COPPA FAQs and revised-rule references](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions) |
| US product claims/marketing | [FTC: advertising and marketing](https://www.ftc.gov/business-guidance/advertising-marketing) |
| US business setup | [SBA: launch your business](https://www.sba.gov/counseling/launch-your-business/) |
| EU data protection | [Your Europe: GDPR](https://europa.eu/youreurope/business/governance-and-sustainability/digital-and-data-compliance/data-protection-gdpr/index_en.htm) |
| EU consumer transactions | [Your Europe: contracts with consumers](https://europa.eu/youreurope/business/selling-in-eu/consumer-contracts-guarantees/consumer-contracts/index_en.htm) |
| EU AI roles and uses | [European Commission: AI Act framework](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) |
| UK privacy | [ICO: advice for small organisations](https://ico.org.uk/for-organisations/advice-for-small-organisations/) |
| UK consumer transactions | [GOV.UK: online and distance selling](https://www.gov.uk/online-and-distance-selling-for-businesses) |

The scope of each resource appears alongside its link. A topic without a curated local reference explicitly asks the user to identify the relevant authority with an adviser. Reference links do not imply all documents at a destination apply to the product.

## Implementation and privacy

`lib/legal.ts` supplies explicit input validation, question-selection rules, a versioned reference list and Markdown export. `components/legal-workspace.tsx` implements the responsive workspace. The existing owner-authorised `/api/project` endpoint handles `legal-profile`, `legal-progress` and `delete-legal` operations, with functional updates using the existing persistence/serialization safeguards.

Stored legal data is private and included in the owner's project export. It is excluded from shared Decision Briefs, public offer documents and AI prompts. The user interface recommends keeping privileged legal advice and sensitive documents in their own secure files. Existing capability-key access, storage, export and expiry limits still apply; this feature does not add encryption or accounts.

An unchanged canonical profile retains progress. A changed profile or guide version creates a new scope and resets prior progress. Task writes include the scope identifier, so a stale browser cannot attach notes or statuses to a different profile. Public sharing remains an explicit allowlist; legal records are never added to it.

## Verification

TypeScript and production build passed. The automated suite has 95 passing tests, including ten legal tests for explicit scope validation, selected-activity triggers, jurisdiction-specific references, unsupported jurisdictions, progress reset/versioning, stale-task rejection, private export, owner enforcement, sharing/prompt exclusions and separate deletion.

The production Chrome audit passes 75 layout scenarios and ten interaction checks, with no out-of-bounds components or browser exceptions. It covers all ten workspaces at 1440, 1024, 768, 390 and 320 px. Legal checks exercise populated specialist/reference cards, private note saves, reload recovery, unsaved-scope write protection and progress reset after updating markets. Isolated QA fixtures are marked INTERNAL TEST, with temporary records removed after checking. No real legal consultation or compliance determination was performed.
