import { NextResponse } from "next/server";
import { readBody, apiError } from "@/lib/api";
import { hydrateContext, updateContext, createShare, revokeShare, storageMode } from "@/lib/context-store";
import { ensureEvidence, ensureExperiment, ensureHypothesis, ensureInterview, evaluateEvidence, idField, recordExperiment, textField } from "@/lib/evidence";
import type { SessionContext } from "@/lib/types";
import type { DecisionRecord } from "@/lib/evidence-types";
import { saveLegalProfile, saveLegalProgress } from "@/lib/legal";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const session = await hydrateContext(body.context as SessionContext);
    const operation = body.operation;
    if (operation === "share") return NextResponse.json({ shareId: await createShare(session), storage: storageMode() });
    if (operation === "revoke-share") return NextResponse.json({ context: await revokeShare(session) });
    const next = await updateContext(session.sessionId, current => {
      if (operation === "clear-result-history") return { resultHistory: [] };
      if (operation === "legal-profile") return { legalPreparation: saveLegalProfile(body.profile, current.legalPreparation) };
      if (operation === "legal-progress") return { legalPreparation: saveLegalProgress(current.legalPreparation, body.record) };
      if (operation === "delete-legal") return { legalPreparation: undefined };
      const upsert = <T extends { id: string }>(items: T[] | undefined, item: T) => { const next = [...(items ?? []).filter(i => i.id !== item.id), item]; if (next.length > 200) throw new Error("This project has reached its 200-record limit. Export an archive or remove old records before adding more."); return next; };
      if (operation === "save") {
        if (current.artifact) return {};
        return { idea: textField(body.idea, "Idea", 6000) };
      }
      if (operation === "hypothesis") return { hypotheses: upsert(current.hypotheses, ensureHypothesis(body.record)), confidenceGate: undefined };
      if (operation === "evidence") return { evidence: upsert(current.evidence, ensureEvidence(body.record, current)), confidenceGate: undefined };
      if (operation === "delete-evidence") return { evidence: current.evidence?.filter(e => e.id !== idField(body.id)), confidenceGate: undefined };
      if (operation === "interview") return { interviews: upsert(current.interviews, ensureInterview(body.record, current)) };
      if (operation === "delete-interview") return { interviews: current.interviews?.filter(i => i.id !== idField(body.id)) };
      if (operation === "delete-decision") return { decisionHistory: current.decisionHistory?.filter(d => d.id !== idField(body.id)) };
      if (operation === "experiment") {
        const record = ensureExperiment(body.record, current);
        if (current.experiments?.some(e => e.id === record.id)) throw new Error("A planned test's criteria cannot be changed. Create a new experiment.");
        return { experiments: upsert(current.experiments, record), confidenceGate: undefined };
      }
      if (operation === "experiment-result") {
        const record = body.record as { id: string };
        const previous = current.experiments?.find(e => e.id === record?.id);
        if (!previous) throw new Error("Choose a stored experiment.");
        return { experiments: upsert(current.experiments, recordExperiment(previous, record)), confidenceGate: undefined };
      }
      if (operation === "decision") {
        const record: DecisionRecord = { ...evaluateEvidence(current), id: idField(body.id), createdAt: new Date().toISOString(), evidenceSnapshot: structuredClone(current.evidence ?? []), hypothesesSnapshot: structuredClone(current.hypotheses ?? []), experimentsSnapshot: structuredClone(current.experiments ?? []) };
        return { decisionHistory: upsert(current.decisionHistory, record) };
      }
      if (operation === "reviewer") {
        const record = body.record as { id: string; name: string; role: string; profile: string };
        if (!["analyst", "advocate", "skeptic", "first-time-buyer", "competitor-user", "budget-conscious"].includes(record?.role)) throw new Error("Choose a panel role.");
        return { customReviewers: [{ id: idField(record.id), name: textField(record.name, "Profile name", 100), role: record.role, profile: textField(record.profile, "Customer constraints", 3000), kind: "customer" as const, createdAt: new Date().toISOString() }], jury: [], scorecard: undefined, failures: [], confidenceGate: undefined };
      }
      if (operation === "remove-reviewer") return { customReviewers: [], jury: [], scorecard: undefined, failures: [], confidenceGate: undefined };
      throw new Error("Unknown project operation.");
    });
    return NextResponse.json({ context: next, storage: storageMode() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
