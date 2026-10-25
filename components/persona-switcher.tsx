import { Icon } from "@/components/icon";
import { PERSONA_META, type PersonaFailure, type PersonaId, type PersonaResponse } from "@/lib/types";

export function PersonaSwitcher({ responses, failures, activePersona, onSelect }: { responses: PersonaResponse[]; failures: PersonaFailure[]; activePersona: PersonaId | null; onSelect: (persona: PersonaId) => void }) {
  const people = [...responses.map((response) => response.persona), ...failures.map((failure) => failure.persona)].filter((persona, index, all) => all.indexOf(persona) === index);
  if (!people.length) return null;
  return (
    <div className="persona-switcher" role="tablist" aria-label="Switch jury perspectives">
      {people.map((persona) => {
        const meta = PERSONA_META[persona];
        const selected = (activePersona ?? people[0]) === persona;
        return <button type="button" role="tab" id={`jury-tab-${persona}`} aria-controls="jury-panel" tabIndex={selected ? 0 : -1} aria-selected={selected} className={selected ? "active" : ""} key={persona} onClick={() => onSelect(persona)} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const index = people.indexOf(persona);
          const next = event.key === "Home" ? 0 : event.key === "End" ? people.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + people.length) % people.length;
          onSelect(people[next]);
          document.getElementById(`jury-tab-${people[next]}`)?.focus();
        }}><Icon name={meta.glyph} /><span>{meta.label}</span></button>;
      })}
    </div>
  );
}
