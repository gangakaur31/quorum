import { Icon } from "@/components/icon";
import { ValidationKit } from "@/components/validation-kit";
import type { ConfidenceGate } from "@/lib/types";

export function ConfidenceGateView({ gate, onSummary, onShare }: { gate: ConfidenceGate; onSummary: () => void; onShare: () => void }) {
  return (
    <section className="gate" aria-label="Confidence Gate">
      <div className="gate-heading"><h2><Icon name="check" />CONFIDENCE GATE</h2><span className="gate-badge">{gate.status ?? "GATHER EVIDENCE"}</span></div>
      <div className="gate-body">
        <p>{gate.rationale}</p>
        <p className="next-step"><strong>Small next step: </strong>{gate.nextStep}</p>
        <p className="citation">AI agreement is a source of questions, not proof of demand. Review original evidence and its limits before committing resources.</p>
        <div className="gate-actions"><button className="summary-toggle" onClick={onSummary}>Open plain-language summary</button><button className="share-button" onClick={onShare}>Share Decision Brief</button></div>
      </div>
      <ValidationKit kit={gate.validationKit} />
    </section>
  );
}
