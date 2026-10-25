"use client";
import type { ResultView } from "@/lib/commands";
const TABS = [{ id: "offer", label: "Offer" }, { id: "reviews", label: "Reviews" }, { id: "scores", label: "Scorecard" }, { id: "angles", label: "Angles" }, { id: "kit", label: "Interview kit" }, { id: "summary", label: "Summary" }] as const;
export function ResultTabs({ value, onChange }: { value: ResultView; onChange: (v: ResultView) => void }) {
  if (value === "history" || value === "help") return null;
  return <div className="result-tabs" role="tablist" aria-label="Saved project results">{TABS.map((tab, index) => <button key={tab.id} id={`result-tab-${tab.id}`} role="tab" type="button" aria-selected={value === tab.id} aria-controls={`result-panel-${value}`} tabIndex={value === tab.id ? 0 : -1} onClick={() => onChange(tab.id)} onKeyDown={event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    onChange(TABS[next].id); document.getElementById(`result-tab-${TABS[next].id}`)?.focus();
  }}>{tab.label}</button>)}</div>;
}
