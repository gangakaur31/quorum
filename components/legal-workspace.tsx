"use client";
import { DemoAutofill, DemoCommand, DemoForm } from "@/components/demo-autofill";


import { useState } from "react";
import { ACTIVITY_LABELS, buildLegalChecklist, JURISDICTION_LABELS, LEGAL_GUIDE_VERSION, LEGAL_NOTICE, LEGAL_REFERENCE_DATE, LEGAL_STATUS_LABELS, legalChecklistMarkdown, SECTOR_LABELS } from "@/lib/legal";
import { LEGAL_ACTIVITIES, LEGAL_JURISDICTIONS, LEGAL_SECTORS, LEGAL_TASK_STATUSES, type LegalActivity, type LegalJurisdiction, type LegalProfile } from "@/lib/legal-types";
import { projectRequest } from "@/lib/project";
import type { SessionContext } from "@/lib/types";

export function LegalWorkspace({ context, onContext }: { context: SessionContext; onContext: (context: SessionContext) => void }) {
  const saved = context.legalPreparation;
  const [product, setProduct] = useState(saved?.profile.product ?? context.idea?.slice(0, 2000) ?? "");
  const [home, setHome] = useState<LegalJurisdiction | "">(saved?.profile.home ?? "");
  const [markets, setMarkets] = useState<LegalJurisdiction[]>(saved?.profile.markets ?? []);
  const [locationDetails, setLocationDetails] = useState(saved?.profile.locationDetails ?? "");
  const [sector, setSector] = useState<LegalProfile["sector"]>(saved?.profile.sector ?? "general");
  const [activities, setActivities] = useState<LegalActivity[]>(saved?.profile.activities ?? []);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const tasks = saved ? buildLegalChecklist(saved.profile) : [];
  const draft = { product: product.trim(), home, markets: [...markets].sort(), locationDetails: locationDetails.trim(), sector, activities: [...activities].sort() };
  const changed = !saved || JSON.stringify(draft) !== JSON.stringify(saved.profile);
  const outdated = saved && saved.guideVersion !== LEGAL_GUIDE_VERSION;

  async function save(operation: string, extra: Record<string, unknown> = {}) {
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: projectRequest(context), operation, ...extra }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Legal preparation could not be saved.");
      onContext(data.context);
      if (operation === "delete-legal") { setProduct(context.idea?.slice(0, 2000) ?? ""); setHome(""); setMarkets([]); setLocationDetails(""); setSector("general"); setActivities([]); }
      setMessage(operation === "delete-legal" ? "Legal profile and preparation notes removed from this project." : "Saved privately to this project.");
    } catch (e) { setError(e instanceof Error ? e.message : "Legal preparation could not be saved."); }
    finally { setPending(false); }
  }

  function download() {
    if (!saved) return;
    const url = URL.createObjectURL(new Blob([legalChecklistMarkdown(saved)], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "quorum-private-legal-preparation.md";
    anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const toggleMarket = (value: LegalJurisdiction) => setMarkets(previous => previous.includes(value) ? previous.filter(v => v !== value) : [...previous, value]);
  const toggleActivity = (value: LegalActivity) => setActivities(previous => previous.includes(value) ? previous.filter(v => v !== value) : [...previous, value]);

  return <DemoCommand command="legal" context={context}><div className="workspace-content legal-workspace">
    <header className="workspace-heading"><p className="section-label">QUORUM / LEGAL PREPARATION</p><h1>Know what to investigate before launch.</h1><p>Build a practical checklist of questions, documents and official references for your product and markets.</p></header>
    <aside className="legal-notice" aria-label="Limits of legal preparation"><strong>Prepare for the conversation.</strong><p>{LEGAL_NOTICE}</p><p>Curated questions selected from your answers. No AI legal opinion or live law check is performed.</p></aside>
    <DemoForm formId="legal-profile" onPopulate={values => { setProduct(String(values.legalProduct)); setHome(values.legalHome as LegalJurisdiction); setSector(values.legalSector as LegalProfile["sector"]); setMarkets(values.legalMarket as LegalJurisdiction[]); setLocationDetails(String(values.legalLocationDetails)); setActivities(values.legalActivity as LegalActivity[]); }} className="workspace-form research-result legal-profile" onSubmit={event => { event.preventDefault(); void save("legal-profile", { profile: draft }); }}>
      <DemoAutofill disabled={pending} />
      <h2>Your product and markets</h2>
      <label>What does the product do?<textarea name="legalProduct" required rows={3} maxLength={2000} value={product} onChange={e => setProduct(e.target.value)} placeholder="Describe the actual service, who uses it and what it handles." /></label>
      <div className="form-columns">
        <label>Where is the business based?<select name="legalHome" required value={home} onChange={e => setHome(e.target.value as LegalJurisdiction)}><option value="" disabled>Choose a location</option>{LEGAL_JURISDICTIONS.map(j => <option key={j} value={j}>{JURISDICTION_LABELS[j]}</option>)}</select></label>
        <label>Product sector<select name="legalSector" value={sector} onChange={e => setSector(e.target.value as LegalProfile["sector"])}>{LEGAL_SECTORS.map(s => <option key={s} value={s}>{SECTOR_LABELS[s]}</option>)}</select></label>
      </div>
      <fieldset><legend>Where will your customers be? Choose at least one.</legend><div className="legal-choice-grid">{LEGAL_JURISDICTIONS.map(j => <label key={j} className="checkbox-label"><input name="legalMarket" type="checkbox" value={j} checked={markets.includes(j)} onChange={() => toggleMarket(j)} />{JURISDICTION_LABELS[j]}</label>)}</div></fieldset>
      <label>State, country or other location details<input name="legalLocationDetails" maxLength={500} required={home === "other" || markets.includes("other")} value={locationDetails} onChange={e => setLocationDetails(e.target.value)} placeholder="e.g. Karnataka, India; California, US; France; or locations still undecided" /></label>
      <fieldset><legend>Which activities are planned? Include pilots and free versions.</legend><div className="legal-choice-grid">{LEGAL_ACTIVITIES.map(a => <label key={a} className="checkbox-label"><input name="legalActivity" type="checkbox" value={a} checked={activities.includes(a)} onChange={() => toggleActivity(a)} />{ACTIVITY_LABELS[a]}</label>)}</div></fieldset>
      <p className="workspace-note">This checklist covers selected activities only. Other jurisdictions and local/state/member-state rules need separate investigation. Changing the saved profile resets task progress so earlier preparation is not carried into a different legal scope.</p>
      <div className="workspace-actions"><button className="workspace-primary" disabled={pending}>{pending ? "Saving…" : saved ? "Update preparation checklist" : "Create preparation checklist"}</button>{saved && <button type="button" disabled={pending || !!outdated} onClick={download}>Download private checklist</button>}</div>
      <p className="workspace-note">The profile and task notes stay private in your project and its private export. They are excluded from shared Decision Briefs and are not sent to an AI provider. Keep privileged advice and sensitive documents in your own secure files.</p>
    </DemoForm>
    <div role="status" className="workspace-feedback">{message}</div>
    {error && <p role="alert" className="workspace-error">{error}</p>}
    {saved ? <>
      <section className="research-result legal-overview" aria-label="Preparation overview"><p className="section-label">YOUR PREPARATION CHECKLIST</p><h2>{tasks.length} topics to investigate</h2><p>{tasks.filter(t => t.specialist).length} topics are flagged for specialist discussion. {tasks.filter(t => saved.progress[t.id]?.status === "preparing").length} marked preparing; {tasks.filter(t => saved.progress[t.id]?.status === "discussed").length} marked discussed with an adviser.</p><p className="workspace-note">These are your task labels, not a compliance score or verified legal approval. This checklist does not change Quorum&apos;s evidence decision or authorise a launch.</p><p className="workspace-note">Saved {new Date(saved.savedAt).toLocaleString()} · Reference list reviewed {LEGAL_REFERENCE_DATE}. Open the authority&apos;s current guidance before relying on it.</p>{changed && <p className="legal-scope-warning" role="status">Unsaved profile changes. The checklist below still reflects your last saved answers. Save the profile to refresh its topics.</p>}{outdated && <p className="legal-scope-warning">This guide has changed since your profile was saved. Update the checklist before saving task progress.</p>}
        <details><summary>Inspect the saved scope</summary><p><b>Product:</b> {saved.profile.product}</p><p><b>Business base:</b> {JURISDICTION_LABELS[saved.profile.home]} · <b>Markets:</b> {saved.profile.markets.map(m => JURISDICTION_LABELS[m]).join(", ")}</p><p>{saved.profile.locationDetails}</p><p><b>Selected activities:</b> {saved.profile.activities.map(a => ACTIVITY_LABELS[a]).join("; ") || "None selected; only foundation questions are included."}</p></details>
      </section>
      {tasks.map(task => {
        const progress = saved.progress[task.id];
        return <article key={task.id} className="research-result legal-task" data-legal-task={task.id}>
          <div className="legal-task-heading"><h2>{task.title}</h2><span className={`legal-priority${task.specialist ? " specialist" : ""}`}>{task.specialist ? "Specialist discussion" : "Prepare & verify"}</span></div>
          <p className="legal-reason">{task.why}</p>
          <h3>Questions to resolve</h3><ul>{task.questions.map(q => <li key={q}>{q}</li>)}</ul>
          <h3>What to prepare</h3><ul>{task.prepare.map(p => <li key={p}>{p}</li>)}</ul>
          <details className="legal-references"><summary>Official references ({task.references.length})</summary>{task.references.length ? task.references.map(r => <div key={r.id}><p><a href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a></p><p className="workspace-note">{r.authority} · {r.scope}</p><p className="workspace-note">Reference list reviewed {r.checkedAt}; this is not a live verification of the current law.</p></div>) : <p className="workspace-note">No curated jurisdiction-specific source is attached to this topic. Identify the relevant registry, regulator or professional body with a local adviser. The preparation questions do not establish a legal requirement.</p>}</details>
          <DemoForm formId={`legal-progress-${task.id}`} key={`${saved.scopeId}:${progress?.updatedAt ?? "new"}`} className="workspace-form legal-progress" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void save("legal-progress", { record: { scopeId: saved.scopeId, taskId: task.id, status: data.get("status"), notes: data.get("notes") } }); }}>
            <label>Preparation status<select name="status" defaultValue={progress?.status ?? "to_review"}>{LEGAL_TASK_STATUSES.map(status => <option key={status} value={status}>{LEGAL_STATUS_LABELS[status]}</option>)}</select></label>
            <label>Private task notes<textarea name="notes" maxLength={1500} rows={2} defaultValue={progress?.notes ?? ""} placeholder="e.g. list the questions and documents to take to an adviser. Avoid sensitive legal advice or personal information." /></label>
            <button disabled={pending || changed || !!outdated}>Save task progress</button>
          </DemoForm>
        </article>;
      })}
      <section className="research-result"><h2>Manage this preparation record</h2><p>Remove the legal profile and its task notes from this project. Other project work stays available. Downloaded copies need separate deletion.</p><button disabled={pending} onClick={() => { if (window.confirm("Delete this project's legal preparation profile and task notes?")) void save("delete-legal"); }}>Delete legal preparation</button></section>
    </> : <section className="research-result"><h2>A practical starting point</h2><p>Save your product and market details to see relevant preparation topics, questions for an adviser, documents to gather and official reference links.</p><p className="workspace-note">Core topics include business setup, intellectual property and customer terms. Your selected activities add privacy, children&apos;s safety, payments, subscriptions, tracking, AI and sector-specific questions.</p></section>}
  </div></DemoCommand>;
}
