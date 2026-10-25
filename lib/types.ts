import type { ProjectData } from "./evidence-types";

export const PERSONAS = [
  "analyst",
  "advocate",
  "skeptic",
  "first-time-buyer",
  "competitor-user",
  "budget-conscious",
] as const;

export type PersonaId = (typeof PERSONAS)[number];

export const PERSONA_META: Record<
  PersonaId,
  { label: string; description: string; glyph: "lens" | "spark" | "shield" | "person" | "switch" | "wallet" }
> = {
  analyst: { label: "Analyst", description: "Tests the evidence and market logic.", glyph: "lens" },
  advocate: { label: "Advocate", description: "Finds compelling early value, without inventing proof.", glyph: "spark" },
  skeptic: { label: "Skeptic", description: "Looks for the reason a buyer would hesitate.", glyph: "shield" },
  "first-time-buyer": { label: "First-time buyer", description: "Approaches it with no category knowledge.", glyph: "person" },
  "competitor-user": { label: "Competitor user", description: "Compares it to an existing workaround.", glyph: "switch" },
  "budget-conscious": { label: "Budget-conscious", description: "Protects a constrained budget.", glyph: "wallet" },
};

export type Scores = {
  willingness_to_try: number | null;
  price_resistance: number | null;
  trust: number | null;
};

export const RISK_CATEGORIES = ["value", "pricing", "trust", "switching", "adoption", "feasibility", "evidence"] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];
export type InferenceAttribution = {
  provider: string;
  model: string;
  completedAt: string;
  latencyMs: number;
  attempts: number;
  fallbackUsed: boolean;
  requestId?: string;
};

export type FounderAssumptions = {
  targetAudience?: string;
  price?: string;
  problem?: string;
  currentAlternative?: string;
};

/** Deliberately concise, user-visible rationale - not private model chain-of-thought. */
export type PersonaResponse = {
  groundingRunId?: string;
  profileName?: string;
  contextRevision?: number;
  persona: PersonaId;
  steelman: string;
  objection: string;
  evidence_needed: string;
  reasoning_trace: string[];
  scores: Scores;
  risk_category: RiskCategory;
  recommendation: "test" | "revise" | "stop" | "insufficient_information";
  next_step: string;
  assumptions: string[];
  attribution?: InferenceAttribution;
  rubricVersion?: string;
};

export type PersonaFailure = { persona: PersonaId; error: string; category?: string; retryable?: boolean };

export type LandingArtifact = {
  title: string;
  headline: string;
  keyClaims: string[];
  html: string;
};

export type Dimension = keyof Scores;

export type Scorecard = {
  rows: Array<{
    dimension: Dimension;
    scores: Record<string, number | null>;
    average: number | null;
    favorableAverage: number | null;
    spread: number | null;
    standardDeviation: number | null;
    scoredCount: number;
    unknownCount: number;
  }>;
  averageSpread: number | null;
  mainObjection: Dimension | null;
  strongestAudience: PersonaId | null;
  biggestRisk: string;
  biggestRiskCategory: RiskCategory | null;
  verdict: "QUORUM" | "NO QUORUM" | "PARTIAL" | "INSUFFICIENT DATA";
  splitDimensions: Dimension[];
  completedCount: number;
  requestedCount: number;
  requestedPersonas: PersonaId[];
  missingPersonas: PersonaId[];
  unknownScoreCount: number;
  rubricVersion: string;
};

export type MarketingAngle = {
  id: string;
  headline: string;
  angle: string;
  cta: string;
};

export type ConfidenceGate = {
  status?: import("./evidence-types").EvidenceDecision["status"];
  significant: boolean;
  rationale: string;
  nextStep: string;
  validationKit: {
    interviewQuestions: string[];
    outreachMessage: string;
    experiment: {
      hypothesis: string;
      method: string;
      successCriterion: string;
    };
  };
};

export type SessionContext = {
  sessionId: string;
  idea?: string;
  assumptions?: FounderAssumptions;
  artifact?: LandingArtifact;
  personas?: PersonaId[];
  jury?: PersonaResponse[];
  failures?: PersonaFailure[];
  scorecard?: Scorecard;
  marketingAngles?: MarketingAngle[];
  marketingRuns?: Record<string, { responses: PersonaResponse[]; scorecard: Scorecard; failures?: PersonaFailure[]; personas?: PersonaId[] }>;
  confidenceGate?: ConfidenceGate;
} & ProjectData;
