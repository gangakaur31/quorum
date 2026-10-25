import type { SessionContext } from "./types";

/** Read the saved-project menu without selecting or resuming any project. */
export function readSavedProjects(raw: string | null, now = Date.now()): SessionContext[] {
  try {
    const saved: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((project): project is SessionContext => Boolean(project && typeof project === "object" && typeof project.sessionId === "string" && typeof project.accessToken === "string" && (!project.updatedAt || now - Date.parse(project.updatedAt) < 14 * 86400000))).slice(-20);
  } catch { return []; }
}

/** Empty startup/autofill drafts are local state, not entries in the saved archive. */
export function hasSavedProjectWork(project: SessionContext) {
  return Boolean(project.updatedAt || project.idea?.trim() || project.artifact || project.hypotheses?.length || project.evidence?.length || project.interviews?.length || project.experiments?.length || project.knowledgeDocuments?.length || project.legalPreparation || project.customReviewers?.length || project.resultHistory?.length);
}

export function rememberProject(projects: SessionContext[], project: SessionContext) {
  if (!hasSavedProjectWork(project)) return projects;
  return [...projects.filter(saved => saved.sessionId !== project.sessionId), project].slice(-20);
}

/** Only identity and creation inputs cross the write boundary; stored results stay authoritative. */
export function projectRequest(context: SessionContext) {
  return { sessionId: context.sessionId, accessToken: context.accessToken, idea: context.idea, assumptions: context.assumptions };
}
