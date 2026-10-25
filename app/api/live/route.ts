import { readBody, apiError } from "@/lib/api";
import { getLiveDocument, hydrateContext, updateContext, updateLiveDocument } from "@/lib/context-store";
import { idField, textField } from "@/lib/evidence";
import { liveStats } from "@/lib/live";
import type { SessionContext } from "@/lib/types";
import { createHmac } from "node:crypto";
import type { LiveDocument } from "@/lib/live-types";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const session = await hydrateContext(body.context as SessionContext);
    if (body.operation === "publish") {
      if (!session.artifact) throw new Error("Generate a landing artifact first.");
      const hypothesisId = idField(body.hypothesisId);
      if (!session.hypotheses?.some(h => h.id === hypothesisId)) throw new Error("Choose the assumption this experiment tests.");
      if (body.confirmPublic !== true) throw new Error("Confirm that this generated offer can be published publicly.");
      if (body.objective !== "waitlist" && body.objective !== "interview") throw new Error("Choose a supported call to action.");
      // Bind the public identifier to the owning project. Another project cannot reclaim
      // a known expired URL by submitting its old identifier as a publication key.
      const publicId = createHmac("sha256", session.accessToken!).update(`${session.sessionId}:${idField(body.publicationKey ?? body.publicId)}`).digest("hex");
      const existing = await getLiveDocument(publicId);
      if (existing && existing.projectId !== session.sessionId) throw new Error("Invalid experiment identifier.");
      const title = textField(body.title, "Experiment title", 200);
      const disclosure = textField(body.disclosure, "Contact data-use disclosure", 1500);
      // Reserve the owner reference before exposing the public document. A failed second
      // write can leave a recoverable empty link, never an unowned contact collection.
      const context = await updateContext(session.sessionId, current => {
        const references = (current.liveExperiments ?? []).filter(e => e.publicId !== publicId);
        if (references.length >= 20) throw new Error("This project has reached its 20 public-experiment limit.");
        return { liveExperiments: [...references, { publicId, title: existing?.title ?? title, createdAt: existing?.createdAt ?? new Date().toISOString() }] };
      });
      await updateLiveDocument(publicId, current => {
        if (current) { if (current.projectId !== session.sessionId) throw new Error("Invalid experiment identifier."); return current; }
        return { publicId, projectId: session.sessionId, hypothesisId, title, artifact: session.artifact!, objective: body.objective as "waitlist" | "interview", disclosure, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), visits: [], leads: [] };
      });
      return Response.json({ context, publicId });
    }
    const publicId = idField(body.publicId);
    const document = await getLiveDocument(publicId);
    if (!document || document.projectId !== session.sessionId) throw new Error("Experiment not found for this project.");
    const ownedUpdate = (change: (current: LiveDocument) => LiveDocument) => updateLiveDocument(publicId, current => {
      if (!current || current.projectId !== session.sessionId) throw new Error("Experiment not found for this project.");
      return change(current);
    });
    if (body.operation === "delete-contact") {
      const email = textField(body.email, "Email", 254).toLowerCase();
      const next = await ownedUpdate(current => ({ ...current, leads: current.leads.filter(l => l.email !== email) }));
      return Response.json({ stats: liveStats(next) });
    }
    if (body.operation === "evidence") {
      const stats = liveStats(document);
      if (!stats.contacts && !stats.consentingVisits) throw new Error("There are no observed interactions to add yet.");
      const context = await updateContext(session.sessionId, current => ({ evidence: [...(current.evidence ?? []).filter(e => e.id !== publicId), { id: publicId, hypothesisId: document.hypothesisId, kind: "observed_behavior", direction: "mixed", summary: `${stats.contacts} email submissions; ${stats.consentingVisits} consenting browser visits; ${stats.matchedContacts} matched contacts.`, source: `/live/${publicId}`, collectedAt: new Date().toISOString(), sampleSize: stats.consentingVisits || undefined, limitations: "Uncontrolled, self-selected traffic. Visits counted only after measurement consent and deduplicated per browser per day; email addresses are not verified. Email interest is not payment. Review the hypothesis before changing evidence direction.", provenance: "public_experiment", ...(document.title.includes("[DEMO]") ? { demo: true } : {}) }], confidenceGate: undefined }));
      return Response.json({ context, stats });
    }
    if (body.operation === "close") await ownedUpdate(current => ({ ...current, active: false }));
    else if (body.operation !== "stats") throw new Error("Unsupported experiment operation.");
    return Response.json({ stats: liveStats((await getLiveDocument(publicId))!) });
  } catch (error) { return apiError(error); }
}
