import { Icon } from "@/components/icon";
import { PERSONA_META, type PersonaFailure, type PersonaResponse } from "@/lib/types";

export function PersonaCard({ response, onInspect }: { response: PersonaResponse; onInspect: (persona: PersonaResponse) => void }) {
  const meta = PERSONA_META[response.persona];
  const score = (value: number | null) => value === null ? "Unknown" : `${value}/5`;
  return (
    <article className="persona-card">
      <div className="persona-head">
        <div className="persona-label"><Icon name={meta.glyph} />{response.profileName ? `${response.profileName} (${meta.label})` : meta.label}</div>
        <div className="score-pills" aria-label={`${meta.label} scores`}>
          <span className="score-pill">TRY ↑ <b>{score(response.scores.willingness_to_try)}</b></span>
          <span className="score-pill" title="Price resistance: lower is better">RESISTANCE ↓ <b>{score(response.scores.price_resistance)}</b></span>
          <span className="score-pill">TRUST ↑ <b>{score(response.scores.trust)}</b></span>
        </div>
      </div>
      <p className="steelman"><span className="card-caption">Strongest case</span>{response.steelman}</p>
      <p className="objection"><span className="card-caption">Main objection</span>{response.objection}</p>
      <p className="evidence-needed"><span className="card-caption">What could change this view: </span>{response.evidence_needed}</p>
      {response.next_step && <p className="evidence-needed"><span className="card-caption">Next test: </span>{response.next_step}</p>}
      <p className="review-boundary">AI assessment · not customer evidence. Risk: {response.risk_category.replaceAll("_", " ")}.</p>
      {!!response.assumptions?.length && <details className="review-assumptions"><summary>Untested assumptions used in this review · {response.assumptions.length}</summary><ul>{response.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul></details>}
      <details className="review-metadata"><summary>About this AI review</summary><p>{response.attribution ? `${response.attribution.provider} / ${response.attribution.model} · ${new Date(response.attribution.completedAt).toLocaleString()}` : "Provider attribution was not recorded for this older result."} · Rubric {response.rubricVersion ?? "legacy"}. Scores are ordinal simulated assessments; unknown values remain unknown.</p></details>
      <button className="inspect-button" onClick={() => onInspect(response)}>Inspect decision summary</button>
    </article>
  );
}

export function PersonaErrorCard({ failure, onRetry, disabled = false }: { failure: PersonaFailure; onRetry?: () => void; disabled?: boolean }) {
  const meta = PERSONA_META[failure.persona];
  return <article className="persona-card persona-error"><div className="persona-label"><Icon name={meta.glyph} />{meta.label} · incomplete</div><p>{failure.error}</p><p>This perspective is excluded from the current scorecard. Any earlier review remains available for inspection.</p>{onRetry && <button className="inspect-button" disabled={disabled} onClick={onRetry}>Retry {meta.label}</button>}</article>;
}
