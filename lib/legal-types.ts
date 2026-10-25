export const LEGAL_JURISDICTIONS = ["india", "us", "eu", "uk", "other"] as const;
export type LegalJurisdiction = (typeof LEGAL_JURISDICTIONS)[number];
export const LEGAL_ACTIVITIES = ["personal_data", "sensitive_data", "children", "payments", "subscriptions", "consumer_sales", "tracking", "ai", "user_content"] as const;
export type LegalActivity = (typeof LEGAL_ACTIVITIES)[number];
export const LEGAL_SECTORS = ["general", "health", "finance", "education", "hardware", "legal_services", "other"] as const;
export type LegalSector = (typeof LEGAL_SECTORS)[number];
export type LegalProfile = {
  product: string;
  home: LegalJurisdiction;
  markets: LegalJurisdiction[];
  locationDetails: string;
  sector: LegalSector;
  activities: LegalActivity[];
};
export const LEGAL_TASK_STATUSES = ["to_review", "preparing", "discussed"] as const;
export type LegalTaskStatus = (typeof LEGAL_TASK_STATUSES)[number];
export type LegalPreparation = {
  profile: LegalProfile;
  scopeId: string;
  guideVersion: string;
  savedAt: string;
  progress: Record<string, { status: LegalTaskStatus; notes: string; updatedAt: string }>;
};
export type LegalReference = { id: string; title: string; authority: string; url: string; scope: string; checkedAt: string };
export type LegalTask = {
  id: string;
  title: string;
  why: string;
  specialist: boolean;
  questions: string[];
  prepare: string[];
  references: LegalReference[];
};
