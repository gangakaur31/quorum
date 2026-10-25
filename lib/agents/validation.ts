import { RISK_CATEGORIES, type LandingArtifact, type PersonaId, type PersonaResponse, type Scores } from "../types";
import { isValidScore, SCORING_RUBRIC_VERSION } from "../scorecard";
import { withoutEmDashes } from "../typography";
import { ARTIFACT_DESIGN_CSS } from "../artifact-design";

const dimensionKeys: Array<keyof Scores> = ["willingness_to_try", "price_resistance", "trust"];

export function ensureLandingArtifact(value: unknown): LandingArtifact {
  const candidate = record(value);
  if (typeof candidate.html !== "string" || !candidate.html.trim() || candidate.html.length > 60000) {
    throw new Error("The landing-page generator returned an invalid artifact.");
  }
  const html = sanitizeArtifactHtml(candidate.html);
  if (!html.includes("<")) throw new Error("The landing-page generator did not return renderable HTML.");
  return {
    title: requiredText(candidate.title, "title", 200),
    headline: requiredText(candidate.headline, "headline", 500),
    keyClaims: textArray(candidate.keyClaims, "keyClaims", 1, 4),
    html,
  };
}

function sanitizeArtifactHtml(html: string) {
  // Some models double-escape layout newlines inside the JSON HTML string.
  // In a CSS grid, those visible text nodes become extra grid children.
  // Preserve explicit code examples, where a literal backslash-n can be intentional.
  const formatted = html.split(/(<(?:pre|code)\b[^>]*>[\s\S]*?<\/(?:pre|code)\s*>)/gi).map((part, index) => index % 2 ? part : part.replace(/\\r\\n|\\n|\\r/g, "\n")).join("");
  const cleaned = withoutEmDashes(formatted)
    // A generated artifact is intentionally static and self-contained. In particular, never
    // allow it to request /_next development bundles from its opaque sandbox origin.
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[\s\S]*$/gi, "")
    .replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)\s*>/gi, "")
    .replace(/<\s*\/?\s*(?:script|iframe|object|embed|link|base)\b[^>]*>/gi, "")
    .replace(/<meta\b[^>]*http-equiv\s*=[^>]*>/gi, "")
    .replace(/<style\b[^>]*\bdata-quorum-design\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/\s(?:on\w+|srcdoc)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\ssrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (_match, quoted, single, bare) => {
      const href = quoted ?? single ?? bare;
      return ` href="${/^#[a-zA-Z][a-zA-Z0-9_.:-]{0,100}$/.test(href) ? href : "#artifact-cta"}"`;
    })
    .replace(/\s(?:target|action|method)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  const safetyPolicy = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'\">";
  const styled = /<\/head\s*>/i.test(cleaned) ? cleaned.replace(/<\/head\s*>/i, `<style data-quorum-design>${ARTIFACT_DESIGN_CSS}</style></head>`) : cleaned;
  return /<head\b[^>]*>/i.test(styled)
    ? styled.replace(/<head\b[^>]*>/i, (head) => `${head}${safetyPolicy}`)
    : `<!doctype html><html><head>${safetyPolicy}<style data-quorum-design>${ARTIFACT_DESIGN_CSS}</style></head><body>${cleaned}</body></html>`;
}

export function ensurePersonaResponse(value: unknown, persona: PersonaId): PersonaResponse {
  const candidate = record(value);
  const scores = record(candidate.scores);
  for (const key of dimensionKeys) {
    const score = scores[key];
    if (score !== null && !isValidScore(score)) {
      throw new Error(`The persona returned an invalid ${key} score.`);
    }
  }
  if (!RISK_CATEGORIES.includes(candidate.risk_category as PersonaResponse["risk_category"])) {
    throw new Error("The persona returned an invalid risk category.");
  }
  const recommendations = ["test", "revise", "stop", "insufficient_information"];
  if (!recommendations.includes(candidate.recommendation as string)) {
    throw new Error("The persona returned an invalid recommendation.");
  }
  const unknownCount = dimensionKeys.filter((key) => scores[key] === null).length;
  if (unknownCount === dimensionKeys.length && candidate.recommendation !== "insufficient_information") {
    throw new Error("A review with no assessable dimensions must acknowledge insufficient information.");
  }
  return {
    persona,
    steelman: requiredText(candidate.steelman, "steelman"),
    objection: requiredText(candidate.objection, "objection"),
    evidence_needed: requiredText(candidate.evidence_needed, "evidence_needed"),
    reasoning_trace: textArray(candidate.reasoning_trace, "reasoning_trace", 2, 4),
    scores: scores as Scores,
    risk_category: candidate.risk_category as PersonaResponse["risk_category"],
    recommendation: candidate.recommendation as PersonaResponse["recommendation"],
    next_step: requiredText(candidate.next_step, "next_step"),
    assumptions: textArray(candidate.assumptions, "assumptions", 0, 6),
    rubricVersion: SCORING_RUBRIC_VERSION,
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The model response must be a JSON object.");
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, field: string, max = 1500): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`The model returned an invalid ${field} field.`);
  }
  return value.trim();
}

function textArray(value: unknown, field: string, min: number, max: number): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new Error(`The model returned an invalid ${field} array.`);
  }
  return value.map((item) => requiredText(item, field));
}
