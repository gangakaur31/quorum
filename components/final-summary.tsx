import { Icon } from "@/components/icon";
import { PERSONA_META, type ConfidenceGate, type PersonaResponse, type Scorecard } from "@/lib/types";

type FinalSummaryProps = {
  responses: PersonaResponse[];
  scorecard: Scorecard;
  gate: ConfidenceGate;
  onClose: () => void;
};

export function FinalSummary({ responses, scorecard, gate, onClose }: FinalSummaryProps) {
  return (
    <section className="summary" aria-label="What to do now">
      <div className="summary-heading">
        <h2><Icon name="jury" className="inline h-4 w-4" /> WHAT TO DO NOW</h2>
        <button className="summary-toggle" onClick={onClose}>Close summary</button>
      </div>
      <div className="summary-body">
        <p className="summary-lede">Product-market fit means a real group finds your product valuable enough to choose it. This is a directional synthetic signal, not proof - use it to decide the smallest real conversation or test to run next.</p>
        <div className="summary-rows">
          {responses.map((response) => (
            <div className="summary-row" key={response.persona}>
              <strong>{PERSONA_META[response.persona].label}</strong>
              <span>
                {response.steelman} But: {response.objection}
                <em>To improve this view: {response.evidence_needed}</em>
              </span>
            </div>
          ))}
        </div>
        <div className="summary-grid">
          <div><span>Verdict</span><b>{scorecard.verdict}</b></div>
          <div><span>Where to focus</span><b>{scorecard.mainObjection?.replaceAll("_", " ") ?? "Gather missing context"}</b></div>
          <div><span>Most receptive simulation</span><b>{scorecard.strongestAudience ? PERSONA_META[scorecard.strongestAudience].label : "Not comparable yet"}</b></div>
          <div><span>Largest risk</span><b>{scorecard.biggestRisk}</b></div>
        </div>
        <p className="next-step"><strong>Do this next: </strong>{gate.nextStep}</p>
      </div>
    </section>
  );
}
