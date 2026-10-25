import type { FounderAssumptions } from "@/lib/types";

const fields: Array<{ key: keyof FounderAssumptions; label: string; placeholder: string }> = [
  { key: "targetAudience", label: "Who is this for?", placeholder: "e.g. restaurant groups" },
  { key: "price", label: "What might it cost?", placeholder: "e.g. 99 per month" },
  { key: "problem", label: "What problem do they have?", placeholder: "e.g. splitting shared bills is slow" },
  { key: "currentAlternative", label: "What do they use now?", placeholder: "e.g. manual split calculations" },
];

export function AssumptionsPanel({ assumptions, onChange }: { assumptions: FounderAssumptions; onChange: (assumptions: FounderAssumptions) => void }) {
  return (
    <details className="assumptions-panel">
      <summary><span>OPTIONAL</span> Tell the jury what you are assuming</summary>
      <p>These become explicit assumptions to test, not claims Quorum treats as true.</p>
      <div className="assumptions-fields">
        {fields.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <input
              value={assumptions[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(event) => onChange({ ...assumptions, [field.key]: event.target.value })}
            />
          </label>
        ))}
      </div>
    </details>
  );
}
