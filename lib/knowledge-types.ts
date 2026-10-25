export const KNOWLEDGE_TASKS = ["generate", "jury", "marketing", "discover", "interview", "experiment", "decision", "brief", "legal", "knowledge"] as const;
export type KnowledgeTask = typeof KNOWLEDGE_TASKS[number];
export type KnowledgeRegion = "global" | "india" | "us" | "eu" | "uk" | "other";
export type KnowledgeDocument = {
  id: string; title: string; content: string; source: string;
  layer: "framework" | "domain" | "project";
  provenance: "curated_summary" | "manual_import" | "tavily_extract" | "project_record";
  publisher: string; tasks: KnowledgeTask[]; regions: KnowledgeRegion[];
  publishedAt: string | null; reviewedAt: string; limitations: string;
  version: string; enabled: boolean;
};
export type KnowledgeEntry = {
  id: string; passageId: string; version: string; layer: KnowledgeDocument["layer"];
  title: string; content: string; source: string; reviewedAt: string; publishedAt: string | null;
  provenance: KnowledgeDocument["provenance"]; publisher: string; limitations: string;
  start: number; end: number; score: number; matchedTerms: string[];
};
export type RetrievalSnapshot = {
  id: string; task: KnowledgeTask; query: string; createdAt: string; contextRevision: number;
  legalScopeId?: string;
  method: "bm25-v1"; passages: KnowledgeEntry[]; gaps: string[];
};
export type KnowledgeAnswer = {
  claims: Array<{ text: string; citations: Array<{ passageId: string; quote: string }> }>;
  gaps: string[];
};
export type GroundingRun = RetrievalSnapshot & { attribution?: import("./types").InferenceAttribution; answer?: KnowledgeAnswer };
