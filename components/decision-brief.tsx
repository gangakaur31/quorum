import { PERSONA_META, type SessionContext } from "@/lib/types";
import { ArtifactView } from "@/components/artifact-view";
import { evaluateEvidence } from "@/lib/evidence";

function label(value: string | null) { return value?.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ") ?? "Unknown"; }

export function DecisionBrief({ context, shared = false }: { context: SessionContext; shared?: boolean }) {
  const scorecard = context.scorecard;
  const gate = context.confidenceGate;
  const decision = context.evidenceDecision ?? evaluateEvidence(context);
  const assumptions = Object.entries(context.assumptions ?? {}).filter(([, value]) => value?.trim());
  return (
    <main className="brief-page">
      <section className="brief-shell">
        <header className="brief-hero"><p>QUORUM DECISION BRIEF</p><h1>{context.artifact?.headline ?? "Founder validation session"}</h1><span>{shared ? "Shared read-only snapshot" : "Live session summary"}</span></header>
        <section className="brief-section"><h2>The idea</h2><p>{context.idea ?? "No founder idea was recorded."}</p>{assumptions.length > 0 && <div className="brief-assumptions">{assumptions.map(([key, value]) => <span key={key}><b>{label(key)}</b>{value}</span>)}</div>}</section>
        {context.artifact && <section className="brief-section"><h2>The generated landing artifact</h2><ArtifactView artifact={context.artifact} /></section>}
        <section className="brief-section"><h2>Evidence-aware decision: {decision.status}</h2><p>{decision.rationale}</p><p><b>Next step:</b> {decision.nextStep}</p><p>{Object.entries(decision.coverage).map(([kind, count]) => `${count} ${kind.replaceAll("_", " ")} records`).join(" · ")}</p><p>{decision.limitations.join(" ")}</p>{shared ? <p>Original evidence is private and was not included in this shared snapshot. Review it with the founder before relying on this decision.</p> : context.evidence?.map(e => <details key={e.id}><summary>{e.kind.replaceAll("_", " ")} · {e.direction}: {e.summary}</summary><p>{e.source} · {e.collectedAt}</p>{e.excerpt && <blockquote>{e.excerpt}</blockquote>}<p>{e.limitations}</p></details>)}</section>
        <section className="brief-section"><h2>What the panel said</h2>{context.personas?.length ? <p className="brief-jury-label">Selected jury: {context.personas.map((persona) => PERSONA_META[persona].label).join(", ")}</p> : null}<div className="brief-personas">{context.jury?.map((response) => <article key={response.persona}><h3>{PERSONA_META[response.persona].label}</h3><p><b>Strong case:</b> {response.steelman}</p><p><b>Concern:</b> {response.objection}</p><p><b>Would raise confidence:</b> {response.evidence_needed}</p></article>) ?? <p>No jury review is available.</p>}</div></section>
        {scorecard && <section className="brief-section"><h2>Quorum scorecard</h2><div className="brief-scoregrid"><span><b>Verdict</b>{scorecard.verdict}</span><span><b>Main objection</b>{label(scorecard.mainObjection)}</span><span><b>Strongest audience</b>{scorecard.strongestAudience ? PERSONA_META[scorecard.strongestAudience].label : "Unknown"}</span><span><b>Biggest risk</b>{scorecard.biggestRisk}</span></div></section>}
        {gate && <section className="brief-section brief-action"><h2>What to do next</h2><p>{gate.nextStep}</p><div className="brief-kit"><h3>Validation kit</h3><ol>{gate.validationKit.interviewQuestions.map((question, index) => <li key={`${index}-${question}`}>{question}</li>)}</ol><p><b>Outreach message:</b> {gate.validationKit.outreachMessage}</p><p><b>Experiment:</b> {gate.validationKit.experiment.method}</p><p><b>Success looks like:</b> {gate.validationKit.experiment.successCriterion}</p></div></section>}
        <footer>Quorum turns independent synthetic signal into a real-world next test. It does not prove product-market fit or provide legal clearance. Legal preparation notes remain private.</footer>
      </section>
    </main>
  );
}

