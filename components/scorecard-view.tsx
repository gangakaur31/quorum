import { DIMENSIONS, QUORUM_AVERAGE_SPREAD_THRESHOLD } from "@/lib/scorecard";
import { PERSONA_META, type PersonaId, type Scorecard } from "@/lib/types";

function humanDimension(value: string | null) { return value?.replaceAll("_", " ") ?? "Unknown"; }

export function ScorecardView({ scorecard, personas }: { scorecard: Scorecard; personas: PersonaId[] }) {
  const split = scorecard.splitDimensions.map(humanDimension).join(" and ");
  return (
    <section className="scorecard-shell" aria-label="Quorum scorecard">
      <div className="scorecard-heading"><h2>SIMULATED PERSPECTIVES</h2><span>{scorecard.completedCount}/{scorecard.requestedCount} REVIEWS · RUBRIC {scorecard.rubricVersion}</span></div>
      <p className="evidence-needed">Willingness and trust: higher is better. Price resistance: lower is better. Unknown scores are excluded, never filled in. These are AI judgments, not customer observations.</p>
      <div className="table-scroll"><table className="score-table"><thead><tr><th>Dimension</th>{personas.map((persona) => <th key={persona}>{PERSONA_META[persona].label}</th>)}<th>Assessed</th><th>Range</th><th title="Population standard deviation of available ordinal scores; descriptive only">Dispersion (SD)</th></tr></thead><tbody>{scorecard.rows.map((row) => <tr key={row.dimension}><td>{DIMENSIONS.find((dimension) => dimension.key === row.dimension)?.label} {row.dimension === "price_resistance" ? "↓" : "↑"}</td>{personas.map((persona) => <td key={persona}>{row.scores[persona] ?? "Unknown"}</td>)}<td>{row.scoredCount}/{scorecard.requestedCount}</td><td className={row.spread !== null && row.spread >= QUORUM_AVERAGE_SPREAD_THRESHOLD ? "spread-high" : ""}>{row.spread ?? " - "}</td><td>{row.standardDeviation?.toFixed(2) ?? " - "}</td></tr>)}</tbody></table></div>
      <div className="scorecard-insights">
        <div><span className="insight-label">Weakest assessed dimension</span><span className="insight-value">{humanDimension(scorecard.mainObjection)}</span></div>
        <div><span className="insight-label">Most receptive simulation</span><span className="insight-value">{scorecard.strongestAudience ? PERSONA_META[scorecard.strongestAudience].label : "Not comparable yet"}</span></div>
        <div><span className="insight-label">Recurring AI concern</span><span className="insight-value">{scorecard.biggestRisk}</span></div>
      </div>
      <p className={`verdict ${scorecard.verdict !== "QUORUM" ? "no-quorum" : ""}`}><span>{scorecard.verdict}</span>{scorecard.verdict === "QUORUM" ? "These synthetic assessments align. Agreement can include shared negative views and does not validate demand." : scorecard.verdict === "PARTIAL" ? `${scorecard.missingPersonas.length} requested review(s) are missing or failed. Retry them before comparing the full panel.` : scorecard.verdict === "INSUFFICIENT DATA" ? "Agreement needs at least two completed reviews and all dimensions assessed. Supply missing context or gather evidence." : `Different views on ${split || "the assessed dimensions"}. Use the objections to design a test.`}</p>
      <p className="evidence-needed">Agreement rule: all requested reviews complete, every dimension assessed, at least two perspectives, mean range &lt; {QUORUM_AVERAGE_SPREAD_THRESHOLD}. Scores are ordinal; dispersion describes this panel, not statistical confidence.</p>
    </section>
  );
}
