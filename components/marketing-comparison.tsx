import { PERSONA_META, type MarketingAngle, type Scorecard } from "@/lib/types";

export function MarketingComparison({ angles, runs, onSelect }: { angles: MarketingAngle[]; runs: Record<string, { scorecard: Scorecard }>; onSelect: (angle: MarketingAngle) => void }) {
  const tested = angles.filter((angle) => Object.prototype.hasOwnProperty.call(runs, angle.id) && runs[angle.id]?.scorecard);
  if (!tested.length) return null;
  const panels = tested.map((angle) => runs[angle.id].scorecard);
  const baseline = panels[0];
  const comparable = panels.every((panel) =>
    panel.completedCount >= 2 && !panel.missingPersonas.length && !panel.unknownScoreCount &&
    panel.rubricVersion === baseline.rubricVersion &&
    [...panel.requestedPersonas].sort().join(",") === [...baseline.requestedPersonas].sort().join(","),
  );
  return <section className="scorecard-shell" aria-label="Marketing angle comparison"><div className="scorecard-heading"><h2>ANGLE COMPARISON</h2><span>{comparable ? "SAME COMPLETE PANEL · SAME RUBRIC" : "INCOMPLETE OR DIFFERENT PANELS"}</span></div><p className="evidence-needed">AI assessments can suggest a messaging test. They cannot identify a conversion winner. {comparable ? "Model attribution remains available on each review." : "Complete the same panel with the same rubric before interpreting score differences."}</p><div className="table-scroll"><table className="score-table"><thead><tr><th>Angle</th><th>Assessment</th><th>Completed</th><th>Avg. range</th><th>Most receptive simulation</th><th /></tr></thead><tbody>{tested.map((angle) => { const scorecard = runs[angle.id].scorecard; return <tr key={angle.id}><td>{angle.headline}</td><td className={scorecard.verdict !== "QUORUM" ? "spread-high" : ""}>{scorecard.verdict}</td><td>{scorecard.completedCount}/{scorecard.requestedCount}</td><td>{scorecard.averageSpread?.toFixed(2) ?? "Unknown"}</td><td>{scorecard.strongestAudience ? PERSONA_META[scorecard.strongestAudience].label : "Unknown"}</td><td><button className="inspect-button" onClick={() => onSelect(angle)}>Open run</button></td></tr>; })}</tbody></table></div></section>;
}
