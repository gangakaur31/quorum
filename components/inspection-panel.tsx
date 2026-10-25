import { Icon } from "@/components/icon";
import { PERSONA_META, type PersonaResponse } from "@/lib/types";
export function InspectionPanel({ response, onClose }: { response: PersonaResponse; onClose: () => void }) {
  const meta = PERSONA_META[response.persona];
  return <section className="summary" aria-label={`${meta.label} decision summary`}><div className="summary-heading"><h2><Icon name="book" className="inline h-4 w-4" /> {meta.label.toUpperCase()}  -  DECISION SUMMARY</h2><button className="summary-toggle" onClick={onClose}>Close</button></div><div className="trace"><h3>What informed this response</h3>{response.reasoning_trace.length ? <ol>{response.reasoning_trace.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol> : <p className="trace-empty">This response did not include an inspectable summary.</p>}</div></section>;
}
