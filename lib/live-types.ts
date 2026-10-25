import type { LandingArtifact } from "./types";
export type LiveReference = { publicId: string; title: string; createdAt: string };
export type LiveDocument = {
  publicId: string; projectId: string; hypothesisId: string; title: string;
  artifact: LandingArtifact; objective: "waitlist" | "interview"; disclosure: string;
  createdAt: string; updatedAt: string; active: boolean;
  visits: Array<{ id: string; visitorHash: string; createdAt: string; source: string }>;
  leads: Array<{ email: string; emailHash: string; createdAt: string; consent: string; visitId?: string; source: string }>;
};
export type LiveStats = { publicId: string; title: string; active: boolean; createdAt: string; consentingVisits: number; contacts: number; matchedContacts: number; sources: Record<string, number>; leads: Array<{ email: string; createdAt: string; source: string }> };
