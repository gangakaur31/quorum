"use client";
import { DemoAutofill, DemoCommand, DemoForm } from "@/components/demo-autofill";

import { projectRequest } from "@/lib/project";
import { useRef, useState } from "react";
import type { SessionContext } from "@/lib/types";
import type { Opportunity } from "@/lib/discovery-types";

export function DiscoverWorkspace({ context, onContext, onUse }: { context: SessionContext; onContext: (context: SessionContext) => void; onUse: (opportunity: Opportunity) => void }) {
  const [mode, setMode] = useState("live");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  async function research(form: FormData) {
    setError(""); setBusy(true); controller.current = new AbortController();
    try {
      const response = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.current.signal, body: JSON.stringify({ context: projectRequest(context), mode, constraints: { domain: form.get("domain"), customer: form.get("customer"), geography: form.get("geography"), resources: form.get("resources"), complexity: form.get("complexity") }, sources: mode === "supplied" ? [{ title: form.get("title"), url: form.get("url"), excerpt: form.get("excerpt"), publishedAt: form.get("publishedAt") || undefined }] : undefined }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onContext(data.context);
    } catch (e) { setError(e instanceof Error && e.name === "AbortError" ? "Research cancelled. Previous sources are preserved." : e instanceof Error ? e.message : "Research did not complete."); }
    finally { setBusy(false); }
  }
  return <DemoCommand command="discover" context={context}><div className="workspace-content"><header className="workspace-heading"><p className="section-label">DISCOVER / SOURCE → HYPOTHESIS</p><h1>A problem worth investigating.</h1><p>Start with a narrow customer and inspect what the sources actually support. Buying intent still needs a real test.</p></header>
    <DemoForm formId="discover" onPopulate={values => setMode(String(values.sourceMode))} className="workspace-form" onSubmit={e => { e.preventDefault(); void research(new FormData(e.currentTarget)); }}>
      <DemoAutofill disabled={busy} />
      <label>Market or recurring problem<input name="domain" required minLength={3} maxLength={250} placeholder="e.g. scheduling for small dental clinics" /></label>
      <div className="form-columns"><label>Target customer<input name="customer" maxLength={300} /></label><label>Geographic market<input name="geography" maxLength={300} /></label></div>
      <div className="form-columns"><label>Your skills and available resources<input name="resources" maxLength={300} /></label><label>Desired complexity<select name="complexity"><option value="small software MVP">Small software MVP</option><option value="manual service first">Manual service first</option><option value="technical product">Technical product</option></select></label></div>
      <label>Source collection<select name="sourceMode" value={mode} onChange={e => setMode(e.target.value)}><option value="live">Live public research (Tavily configuration required)</option><option value="supplied">Analyze a source excerpt I provide</option></select></label>
      {mode === "supplied" && <fieldset><legend>Founder-supplied material · not independently verified</legend><label>Source title<input name="title" required maxLength={200} /></label><label>Public source URL<input name="url" type="url" required placeholder="https://…" /></label><label>Publication date, if known<input name="publishedAt" type="date" /></label><label>Relevant excerpt<textarea name="excerpt" required minLength={30} maxLength={2400} rows={5} /></label></fieldset>}
      <p className="workspace-note">Source excerpts and your constraints are sent to the configured AI provider. Opportunities are unverified proposals. There is no success score or implied ranking.</p>
      <div className="workspace-actions"><button disabled={busy} className="workspace-primary">{busy ? "Collecting sources and checking citations…" : "Research opportunities"}</button>{busy && <button type="button" onClick={() => controller.current?.abort()}>Cancel</button>}</div>
      {error && <p role="alert" className="workspace-error">{error}</p>}
    </DemoForm>
    {context.discovery?.opportunities.map(opportunity => <article className="research-result" key={opportunity.id}><p className="section-label">UNVERIFIED OPPORTUNITY · {opportunity.complexity.toUpperCase()} COMPLEXITY</p><h2>{opportunity.title}</h2><p><b>Customer:</b> {opportunity.customer}</p><p>{opportunity.problem}</p><h3>What sources report</h3>{opportunity.observations.map((o, i) => { const s = context.discovery?.sources.find(s => s.id === o.sourceId); return <div className="source-observation" key={i}><p>{o.statement}</p><blockquote>{o.excerpt}</blockquote>{s && <a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a>}</div>; })}<p><b>Inference:</b> {opportunity.inference}</p><p><b>Product hypothesis:</b> {opportunity.approach}</p><p><b>Smallest product:</b> {opportunity.mvp}</p><p><b>Alternatives:</b> {opportunity.alternatives.join("; ")}</p><p><b>Required capabilities:</b> {opportunity.capabilities.join("; ")}</p><p><b>Attractiveness and difficulty:</b> {opportunity.whyNow}</p><h3>Still untested</h3><ul>{opportunity.assumptions.map(a => <li key={a}>{a}</li>)}</ul><p><b>First experiment:</b> {opportunity.firstExperiment}</p><p className="workspace-note">{opportunity.limitations}</p><button className="workspace-primary" disabled={busy || !!context.artifact} onClick={() => onUse(opportunity)}>Use this idea</button>{context.artifact && <p className="workspace-note">Start a new project to use a different opportunity.</p>}</article>)}
    {!!context.discovery?.sources.length && <section className="research-result"><h2>Source ledger</h2>{context.discovery.sources.map(s => <details key={s.id}><summary>{s.title} · {s.provenance === "web_search" ? "Search excerpt" : "Founder supplied"}</summary><p><a href={s.url} target="_blank" rel="noreferrer">Open source ↗</a></p><p>Published: {s.publishedAt ? new Date(s.publishedAt).toLocaleDateString() : "Unknown"} · Collected: {new Date(s.retrievedAt).toLocaleDateString()}</p><blockquote>{s.excerpt}</blockquote><p className="workspace-note">{s.limitations}</p></details>)}</section>}
  </div></DemoCommand>;
}
