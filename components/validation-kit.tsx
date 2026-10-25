import type { ConfidenceGate } from "@/lib/types";

export function ValidationKit({ kit }: { kit: ConfidenceGate["validationKit"] }) {
  return (
    <section className="validation-kit" aria-label="Real-world validation kit">
      <div className="validation-kit-heading"><span>REAL-WORLD VALIDATION KIT</span><small>Built from this run&apos;s risks and scorecard</small></div>
      <div className="kit-grid">
        <div className="kit-card kit-questions"><h3>Questions for your interviews</h3><ol>{kit.interviewQuestions.map((question, index) => <li key={`${index}-${question}`}>{question}</li>)}</ol></div>
        <div className="kit-card"><h3>Outreach message</h3><p className="kit-message">{kit.outreachMessage}</p></div>
        <div className="kit-card kit-experiment"><h3>Smallest useful experiment</h3><p><b>Hypothesis</b>{kit.experiment.hypothesis}</p><p><b>Method</b>{kit.experiment.method}</p><p><b>Success looks like</b>{kit.experiment.successCriterion}</p></div>
      </div>
    </section>
  );
}
