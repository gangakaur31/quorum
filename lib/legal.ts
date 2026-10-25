import { textField } from "./evidence";
import { LEGAL_ACTIVITIES, LEGAL_JURISDICTIONS, LEGAL_SECTORS, LEGAL_TASK_STATUSES, type LegalActivity, type LegalJurisdiction, type LegalPreparation, type LegalProfile, type LegalReference, type LegalTask } from "./legal-types";

export const LEGAL_GUIDE_VERSION = "2026-10-21.1";
export const LEGAL_REFERENCE_DATE = "2026-10-21";
export const LEGAL_NOTICE = "Preparation guidance, not legal advice or a compliance certificate. Applicability depends on your facts and location. Verify current rules with the relevant authority and a qualified local adviser before relying on this checklist.";
export const JURISDICTION_LABELS: Record<LegalJurisdiction, string> = { india: "India", us: "United States", eu: "European Union / EEA", uk: "United Kingdom", other: "Other / not sure" };
export const ACTIVITY_LABELS: Record<LegalActivity, string> = { personal_data: "Collect personal data (including emails or account details)", sensitive_data: "Handle health, financial, biometric or other sensitive data", children: "Serve children or allow them to use the product", payments: "Accept payments, deposits or paid pilots", subscriptions: "Offer recurring subscriptions or free trials", consumer_sales: "Sell to individual consumers", tracking: "Use cookies, analytics, advertising or marketing messages", ai: "Use AI models, generated content or automated decisions", user_content: "Host user posts, uploads or a marketplace" };
export const SECTOR_LABELS: Record<LegalProfile["sector"], string> = { general: "General software / services", health: "Health / medical", finance: "Finance / insurance / payments", education: "Education / employment decisions", hardware: "Physical products / hardware", legal_services: "Legal or other professional advice", other: "Another potentially regulated activity" };
export const LEGAL_STATUS_LABELS = { to_review: "To review", preparing: "Preparing", discussed: "Discussed with an adviser" };

// Curated authority links. These are reference resources, not runtime legal verification.
const ref = (id: string, title: string, authority: string, url: string, scope: string): LegalReference => ({ id, title, authority, url, scope, checkedAt: LEGAL_REFERENCE_DATE });
export const LEGAL_REFERENCES = {
  ip: ref("ip", "Intellectual property for businesses", "WIPO", "https://www.wipo.int/en/web/business", "International IP education; national rights and procedures differ"),
  indiaPrivacy: ref("india-privacy", "DPDP Rules and enforcement timeline", "MeitY, Government of India", "https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025", "India; check the Act, Rules, corrigenda and phased commencement dates"),
  indiaApprovals: ref("india-approvals", "Know Your Approvals", "National Single Window System, Government of India", "https://www.nsws.gov.in/", "India; central/state approvals depend on the activity and location"),
  indiaConsumer: ref("india-consumer", "Consumer protection acts and e-commerce rules", "Department of Consumer Affairs, Government of India", "https://consumeraffairs.gov.in/pages/consumer-protection-acts", "India; identify the current rules relevant to your offer and business role"),
  usPrivacy: ref("us-privacy", "Protecting personal information: business guide", "US Federal Trade Commission", "https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business", "US federal guidance; state and sector privacy laws also need checking"),
  usChildren: ref("us-children", "Children's privacy / COPPA FAQs", "US Federal Trade Commission", "https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions", "US; check scope and the revised Rule, not only older FAQ examples"),
  usConsumer: ref("us-consumer", "Advertising and marketing guidance", "US Federal Trade Commission", "https://www.ftc.gov/business-guidance/advertising-marketing", "US; consumer claims, endorsements and applicable industry rules"),
  usBusiness: ref("us-business", "Launch your business", "US Small Business Administration", "https://www.sba.gov/counseling/launch-your-business/", "US; federal, state and local registration, tax and permit questions"),
  euPrivacy: ref("eu-privacy", "Data protection under GDPR", "European Union, Your Europe", "https://europa.eu/youreurope/business/governance-and-sustainability/digital-and-data-compliance/data-protection-gdpr/index_en.htm", "EU guidance; EEA and member-state details require local verification"),
  euConsumer: ref("eu-consumer", "Contracts with consumers", "European Union, Your Europe", "https://europa.eu/youreurope/business/selling-in-eu/consumer-contracts-guarantees/consumer-contracts/index_en.htm", "EU consumer contracts; exceptions and national rules depend on the transaction"),
  euAi: ref("eu-ai", "AI Act framework and implementation", "European Commission", "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai", "EU; verify roles, use cases, risk classification and current application dates"),
  ukPrivacy: ref("uk-privacy", "Data protection for small organisations", "UK Information Commissioner's Office", "https://ico.org.uk/for-organisations/advice-for-small-organisations/", "UK; check current UK data protection and electronic marketing guidance"),
  ukConsumer: ref("uk-consumer", "Online and distance selling", "UK Government", "https://www.gov.uk/online-and-distance-selling-for-businesses", "UK; selling rules depend on the goods/services, customer and location"),
} satisfies Record<string, LegalReference>;

function selection<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`Choose a valid ${label}.`);
  return value as T;
}
function selections<T extends string>(value: unknown, allowed: readonly T[], label: string): T[] {
  if (!Array.isArray(value) || value.length > allowed.length) throw new Error(`Choose valid ${label}.`);
  return [...new Set(value.map(v => selection(v, allowed, label)))].sort();
}
export function ensureLegalProfile(value: unknown): LegalProfile {
  const p = value as LegalProfile;
  const home = selection(p?.home, LEGAL_JURISDICTIONS, "business location");
  const markets = selections(p?.markets, LEGAL_JURISDICTIONS, "customer markets");
  if (!markets.length) throw new Error("Choose at least one customer market, or Other / not sure.");
  const locationDetails = p.locationDetails === undefined || p.locationDetails === "" ? "" : textField(p.locationDetails, "Location details", 500);
  if ((home === "other" || markets.includes("other")) && !locationDetails) throw new Error("Describe the other location or what is still unknown.");
  return { product: textField(p.product, "Product description", 2000), home, markets, locationDetails, sector: selection(p.sector, LEGAL_SECTORS, "product sector"), activities: selections(p.activities, LEGAL_ACTIVITIES, "product activities") };
}

/** Questions selected from explicit founder inputs; never an AI legal opinion or finding of applicability. */
export function buildLegalChecklist(profile: LegalProfile): LegalTask[] {
  const regions = new Set([profile.home, ...profile.markets]);
  const has = (...activities: LegalActivity[]) => activities.some(a => profile.activities.includes(a));
  const regionRefs = (mapping: Partial<Record<LegalJurisdiction, LegalReference>>) => [...regions].flatMap(r => mapping[r] ? [mapping[r]!] : []);
  const privacy = regionRefs({ india: LEGAL_REFERENCES.indiaPrivacy, us: LEGAL_REFERENCES.usPrivacy, eu: LEGAL_REFERENCES.euPrivacy, uk: LEGAL_REFERENCES.ukPrivacy });
  const consumer = regionRefs({ india: LEGAL_REFERENCES.indiaConsumer, us: LEGAL_REFERENCES.usConsumer, eu: LEGAL_REFERENCES.euConsumer, uk: LEGAL_REFERENCES.ukConsumer });
  const business = regionRefs({ india: LEGAL_REFERENCES.indiaApprovals, us: LEGAL_REFERENCES.usBusiness });
  const tasks: LegalTask[] = [];
  const add = (id: string, title: string, why: string, specialist: boolean, questions: string[], prepare: string[], references: LegalReference[] = []) => tasks.push({ id, title, why, specialist, questions, prepare, references: references.filter((r, i, all) => all.findIndex(x => x.id === r.id) === i) });
  add("scope", "Confirm which laws and authorities to check", `Business base: ${JURISDICTION_LABELS[profile.home]}. Customer markets: ${profile.markets.map(m => JURISDICTION_LABELS[m]).join(", ")}.`, true,
    ["Which national, state and local rules might apply to this business, its customers and its data?", "Do the selected regions leave out a place where people, infrastructure or sales are located?", "Which rules are already applicable, which start later, and what exceptions need checking?"],
    ["A market/location map and a short description of what the product actually does", "A list of relevant authorities and questions for a qualified local adviser"], business);
  add("business", "Business structure, registration, tax and licences", "Even an early pilot can raise business and sector questions; the answer depends on where and how you operate.", true,
    ["Who is the legal seller/operator, and which business structure is appropriate?", "Which registrations, taxes, invoices, permits or professional licences need checking before the intended activity?"],
    ["Founder/operator details, intended activities, payment flows and operating locations", "Questions for a local business adviser and tax professional"], business);
  add("ownership", "Ownership, brand and third-party licences", "Your offer may use code, a brand, datasets, designs or work created by other people.", false,
    ["Who owns founder, employee and contractor contributions?", "Do open-source, dataset, image, API and AI-provider terms permit the intended commercial use?", "What brand/name clearance or IP protection should be investigated locally?"],
    ["An inventory of assets, contributors, dependencies and licence terms", "Assignment/licence agreements to discuss with an adviser"], [LEGAL_REFERENCES.ip]);
  add("terms", "Customer agreements and truthful product claims", "Customers need a clear explanation of the offer and its limits, including during a pilot.", false,
    ["What exactly is promised, what is still experimental, and what evidence supports the public claims?", "What should the agreement say about access, service scope, liability, termination and complaints?", "Which additional consumer rights apply if you sell to individuals?"],
    ["A plain-language offer, draft customer/pilot terms and a claims-to-evidence list", "A support/complaints contact and a description of cancellation and refund handling"], has("consumer_sales") ? consumer : []);
  if (has("personal_data", "sensitive_data", "children", "tracking")) add("privacy", "Personal data, privacy and security", "You selected an activity involving personal information, children, sensitive data or tracking.", true,
    ["What information is collected, why, on what permitted basis, for how long and by whom?", "Which notices, user rights, vendor agreements, consent mechanisms or transfer safeguards need checking?", "How will deletion requests, access controls, incidents and vendor changes be handled?"],
    ["A data/vendor map, retention and deletion plan, and draft privacy notice", "A security/incident plan and any required assessment to review with an adviser"], privacy);
  if (has("sensitive_data")) add("sensitive", "Sensitive information and impact assessment", "You selected health, financial, biometric or other sensitive information.", true,
    ["How does each relevant law classify this information and the proposed use?", "Are additional permissions, impact assessments, professional duties or security measures needed?"],
    ["A minimal-data design and restricted-access plan", "An assessment of the intended uses, possible harms and alternatives"], privacy);
  if (has("children")) add("children", "Children's access, privacy and safety", "You indicated that children may use the product. Age rules and duties differ by location and activity.", true,
    ["Which age thresholds and child-directed/general-audience rules apply in the target markets?", "What age assurance, parental involvement, safety design or consent process is appropriate?", "Are advertising, tracking, school use or user-generated content subject to additional restrictions?"],
    ["An age/audience assessment and data/feature map for younger users", "Questions about parental notices, consent, retention and safety reporting"], [...privacy, ...(regions.has("us") ? [LEGAL_REFERENCES.usChildren] : [])]);
  if (has("payments", "subscriptions")) add("payments", "Payments, refunds and tax handling", "You selected paid offers, deposits or subscriptions.", true,
    ["Who is the merchant and does the product only sell its own service, or handle money for others?", "What payment-provider, invoicing, tax, refund and dispute requirements should be verified?", "Could the money flow itself require regulated permissions?"],
    ["A diagram of money flows, provider arrangements, prices and invoice handling", "Draft refund/delivery terms and a plan for payment disputes"], [...business, ...(has("consumer_sales") ? consumer : [])]);
  if (has("subscriptions")) add("subscriptions", "Recurring billing and cancellation", "You selected subscriptions or trials; review the exact purchase and cancellation journey.", false,
    ["How are price, trial conversion, billing frequency and renewal disclosed before purchase?", "Which consent, reminder, cancellation and refund rules apply in each market?"],
    ["Screenshots of checkout, trial notices and the cancellation flow", "A record of billing authorisation and the proposed renewal/refund process"], has("consumer_sales") ? consumer : []);
  if (has("tracking")) add("tracking", "Cookies, analytics and marketing", "You selected tracking, advertising or marketing communications.", false,
    ["Which tools collect identifiers or share information, and are they necessary for the service?", "Which consent, opt-out and direct-marketing rules apply to each channel and recipient?"],
    ["A tracker/vendor inventory and cookie/permission flow", "Draft messages, unsubscribe handling and records of the relevant permissions"], privacy);
  if (has("ai")) add("ai", "AI use, disclosures and human oversight", "You selected AI or automated decisions. The use case and business role determine what to investigate.", true,
    ["Are you a provider, deployer or another participant, and what does the system actually decide?", "Which prohibited-use, risk classification, disclosure, human-review or documentation rules need checking?", "What rights and permissions cover model inputs, training material, outputs and provider data use?"],
    ["An AI system/use-case inventory, provider terms and data-flow map", "A limitations/disclosure plan, human escalation process and testing records"], [...(regions.has("eu") ? [LEGAL_REFERENCES.euAi] : []), LEGAL_REFERENCES.ip]);
  if (has("user_content")) add("content", "User content, marketplace roles and complaints", "You selected user uploads, posts or a marketplace.", true,
    ["What permissions cover hosted content, and what is the platform's role in each transaction?", "Which reporting, removal, seller-verification, safety or complaint processes need checking locally?"],
    ["Draft acceptable-use/content rules and a reporting/escalation process", "A clear division of responsibilities between the platform, sellers and users"], [LEGAL_REFERENCES.ip, ...(has("consumer_sales") ? consumer : [])]);
  if (profile.sector !== "general") add("sector", "Product-specific regulation and professional review", `Selected sector: ${SECTOR_LABELS[profile.sector]}. This checklist does not classify or authorise the product.`, true,
    ["Which regulator, professional body or product-safety authority covers this exact activity?", "Does the intended function or marketing claim trigger approval, licensing, testing or specialist duties?", "What can be tested safely before those questions are resolved?"],
    ["A precise intended-use statement, audience, claims and foreseeable harms", "An adviser/regulator question list and any proposed testing or certification plan"], business);
  if (profile.markets.some(m => m !== profile.home)) add("cross-border", "Cross-border sales and data flows", "Your customer markets include a region different from the business base.", true,
    ["Which foreign customer, tax, professional and data-transfer rules may apply?", "Which local/member-state/state rules and contract enforcement questions remain unresolved?"],
    ["A customer, supplier, hosting and payment location map", "A list of unresolved cross-border questions for local advice"], [...privacy, ...(has("consumer_sales") ? consumer : [])]);
  return tasks;
}

export function saveLegalProfile(value: unknown, previous?: LegalPreparation): LegalPreparation {
  const profile = ensureLegalProfile(value);
  const unchanged = previous?.guideVersion === LEGAL_GUIDE_VERSION && JSON.stringify(previous.profile) === JSON.stringify(profile);
  return { profile, scopeId: unchanged ? previous.scopeId : crypto.randomUUID(), guideVersion: LEGAL_GUIDE_VERSION, savedAt: new Date().toISOString(), progress: unchanged ? previous.progress : {} };
}
export function saveLegalProgress(current: LegalPreparation | undefined, value: unknown): LegalPreparation {
  if (!current || current.guideVersion !== LEGAL_GUIDE_VERSION) throw new Error("Save the current legal preparation profile first.");
  const body = value as { scopeId?: unknown; taskId?: unknown; status?: unknown; notes?: unknown };
  if (body?.scopeId !== current.scopeId) throw new Error("The legal profile changed. Reload it before saving task notes.");
  const task = buildLegalChecklist(current.profile).find(t => t.id === body.taskId);
  if (!task) throw new Error("Choose a task in this project's current legal checklist.");
  const status = selection(body.status, LEGAL_TASK_STATUSES, "preparation status");
  const notes = body.notes === "" || body.notes === undefined ? "" : textField(body.notes, "Preparation notes", 1500);
  return { ...current, progress: { ...current.progress, [task.id]: { status, notes, updatedAt: new Date().toISOString() } } };
}

export function legalChecklistMarkdown(preparation: LegalPreparation): string {
  const { profile } = preparation;
  const lines = ["# Quorum private legal preparation checklist", "", LEGAL_NOTICE, "", `Product: ${profile.product}`, `Business base: ${JURISDICTION_LABELS[profile.home]}`, `Customer markets: ${profile.markets.map(m => JURISDICTION_LABELS[m]).join(", ")}`, `Location details: ${profile.locationDetails || "Not supplied"}`, `Sector: ${SECTOR_LABELS[profile.sector]}`, `Activities: ${profile.activities.map(a => ACTIVITY_LABELS[a]).join("; ") || "None selected"}`, `Profile saved: ${preparation.savedAt}`, `Guide edition: ${preparation.guideVersion}; reference list reviewed ${LEGAL_REFERENCE_DATE}. No live legal check was performed.`, "", "Scope: selected activities only; local/state/member-state rules and unlisted jurisdictions need separate research. Progress and notes are founder-reported, not verified legal approval."];
  for (const task of buildLegalChecklist(profile)) {
    const progress = preparation.progress[task.id];
    lines.push("", `## ${task.title}`, task.why, `Suggested handling: ${task.specialist ? "Specialist review" : "Prepare and verify"}`, `Status: ${LEGAL_STATUS_LABELS[progress?.status ?? "to_review"]}`, "", "Questions:", ...task.questions.map(q => `- ${q}`), "", "Prepare:", ...task.prepare.map(p => `- ${p}`), "", "Official references:", ...(task.references.length ? task.references.map(r => `- ${r.title}  -  ${r.authority}: ${r.url} (${r.scope}; reference reviewed ${r.checkedAt})`) : ["- No curated jurisdiction-specific source for this topic. Identify the appropriate authority with a local adviser."]));
    if (progress?.notes) lines.push("", "Private preparation notes:", progress.notes);
  }
  return lines.join("\n");
}
