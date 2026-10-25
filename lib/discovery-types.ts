export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  publishedAt: string | null;
  retrievedAt: string;
  provenance: "web_search" | "user_supplied";
  limitations: string;
};

export type Opportunity = {
  id: string;
  title: string;
  problem: string;
  customer: string;
  observations: Array<{ statement: string; sourceId: string; excerpt: string }>;
  inference: string;
  alternatives: string[];
  approach: string;
  mvp: string;
  complexity: "low" | "medium" | "high";
  capabilities: string[];
  assumptions: string[];
  firstExperiment: string;
  limitations: string;
  whyNow: string;
};

export type DiscoverConstraints = {
  domain: string;
  customer?: string;
  geography?: string;
  resources?: string;
  complexity?: string;
};

export type SuppliedSource = { title: string; url: string; excerpt: string; publishedAt?: string };

export type Discovery = {
  opportunities: Opportunity[];
  sources: ResearchSource[];
  selectedOpportunityId?: string;
  searchedAt?: string;
  query?: string;
};
