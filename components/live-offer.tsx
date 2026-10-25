"use client";
import { useEffect, useState } from "react";
import { DemoAutofill } from "./demo-autofill";
import { demoContact } from "@/lib/demo-scenario";
export function LiveOffer({ publicId, objective, disclosure, demo = false }: { publicId: string; objective: "waitlist" | "interview"; disclosure: string; demo?: boolean }) {
  const [startedAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [visitId, setVisitId] = useState<string | undefined>();
  const [source, setSource] = useState("direct / unknown");
  const [email, setEmail] = useState(""), [consent, setConsent] = useState(false);
  const [previous, setPrevious] = useState<{ email: string; consent: boolean } | null>(null), [notice, setNotice] = useState("");
  const demoController = { canUndo: !!previous, notice, fill: () => { const sample = demoContact(); if (email === sample.email && consent === sample.consent) return; setPrevious({ email, consent }); setEmail(sample.email); setConsent(sample.consent); setNotice("Synthetic demo contact filled. Nothing submitted or measured. Use the normal action to save this example."); }, undo: () => { if (!previous) return; setEmail(previous.email); setConsent(previous.consent); setPrevious(null); setNotice("Previous contact draft restored."); } };
  useEffect(() => { setSource(new URLSearchParams(window.location.search).get("utm_source") || "direct / unknown"); }, []);
  async function submit(body: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/live/${publicId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, source }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      return data;
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save your response. Try again."); }
    finally { setBusy(false); }
  }
  return <section className="research-result"><h2>{objective === "waitlist" ? "Register early interest" : "Request a research interview"}</h2><p>This is an early concept experiment. Signing up expresses interest; it is not a purchase or a promise that a product will launch.</p><p>{disclosure}</p>{complete ? <p role="status">Your email was saved for the requested follow-up. Email delivery and address verification are not automatic.</p> : <form className="workspace-form" onSubmit={async e => { e.preventDefault(); const form = new FormData(e.currentTarget); const result = await submit({ operation: "contact", email: form.get("email"), website: form.get("website"), consent: form.get("consent") === "on", startedAt, visitId }); if (result?.accepted) setComplete(true); }}>{demo && <DemoAutofill disabled={busy} controller={demoController} />}<label>Your email<input required name="email" type="email" maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label><div className="bot-field" aria-hidden="true"><label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div><label className="checkbox-label"><input name="consent" type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} />I agree to share my email with this project's owner for the follow-up described above. The experiment and contacts expire after 14 days. No email is sent automatically.</label><button className="workspace-primary" disabled={busy}>{busy ? "Saving…" : objective === "waitlist" ? "Register interest" : "Request an interview"}</button></form>}<hr /><p className="workspace-note">Optional measurement: allow this experiment to record one consenting browser visit per day and its traffic-source tag. No advertising cookies or IP addresses are stored. You can read the offer and submit contact details without enabling measurement.</p>{!visitId ? <button disabled={busy} onClick={async () => { let visitorId = crypto.randomUUID(); try { const saved = localStorage.getItem("quorum-visitor-v1"); if (saved) visitorId = saved; else localStorage.setItem("quorum-visitor-v1", visitorId); } catch {} const data = await submit({ operation: "visit", measurementConsent: true, visitorId }); if (data?.visitId) setVisitId(data.visitId); }}>Allow anonymous visit measurement</button> : <p role="status" className="workspace-note">Consenting visit recorded. Repeated clicks in this browser today are deduplicated.</p>}{error && <p role="alert" className="workspace-error">{error}</p>}</section>;
}
