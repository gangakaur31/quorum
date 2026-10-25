import type { Opportunity, ResearchSource } from "./discovery-types";

export type EvidenceKind = "research" | "customer_statement" | "observed_behavior" | "commitment";
export type Hypothesis = { id: string; claim: string; createdAt: string };
export type Evidence = {
  demo?: boolean;
  id: string;
  hypothesisId: string;
  kind: EvidenceKind;
  direction: "supports" | "contradicts" | "mixed";
  summary: string;
  source: string;
  excerpt?: string;
  collectedAt: string;
  sampleSize?: number;
  limitations: string;
  provenance: "founder_reported" | "imported_interview" | "public_experiment";
};
export type Interview = { demo?: boolean; id: string; hypothesisId: string; participant: string; transcript: string; collectedAt: string; consent: boolean; findings?: Array<{ quote: string; interpretation: string }>; synthesisAt?: string };
export type Experiment = {
  demo?: boolean;
  id: string; hypothesisId: string; name: string; method: string; metric: string;
  target: number; minimumSample: number; createdAt: string; status: "planned" | "recorded";
  successes?: number; sampleSize?: number; observedAt?: string; limitations?: string;
};
export type EvidenceDecision = {
  status: "INSUFFICIENT EVIDENCE" | "TEST" | "ITERATE" | "BUILD" | "PIVOT";
  rationale: string; nextStep: string; evidenceIds: string[]; limitations: string[];
  coverage: { research: number; customer_statement: number; observed_behavior: number; commitment: number };
};
export type DecisionRecord = EvidenceDecision & { id: string; createdAt: string; evidenceSnapshot?: Evidence[]; hypothesesSnapshot?: Hypothesis[]; experimentsSnapshot?: Experiment[] };
export type CustomReviewer = { id: string; name: string; role: string; profile: string; kind: "customer"; createdAt: string };
export type ProjectData = {
  resultHistory?: import("./result-history").SavedResult[];
  knowledgeDocuments?: import("./knowledge-types").KnowledgeDocument[];
  disabledKnowledgeIds?: string[];
  groundingRuns?: import("./knowledge-types").GroundingRun[];
  legalPreparation?: import("./legal-types").LegalPreparation;
  evidenceDecision?: EvidenceDecision;
  evaluationRevision?: number;
  liveExperiments?: import("./live-types").LiveReference[];
  accessToken?: string; updatedAt?: string; createdAt?: string;
  hypotheses?: Hypothesis[]; evidence?: Evidence[]; interviews?: Interview[]; experiments?: Experiment[];
  decisionHistory?: DecisionRecord[]; customReviewers?: CustomReviewer[];
  discovery?: { opportunities: Opportunity[]; sources: ResearchSource[]; selectedOpportunityId?: string };
  shareId?: string;
};
