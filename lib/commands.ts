import { PERSONAS, PERSONA_META, type SessionContext } from "./types";
export type ResultView = "offer" | "reviews" | "scores" | "angles" | "kit" | "summary" | "history" | "help";
export type CommandDefinition = { command: string; description: string; kind: "view" | "ai" | "action"; requires?: "artifact" | "idea" | "gate" | "review" };
export const COMMANDS: CommandDefinition[] = [
  { command: "/artifact", description: "Open your saved landing offer", kind: "view" },
  { command: "/reviews", description: "Read saved AI perspectives, one at a time", kind: "view" },
  { command: "/scorecard", description: "Compare the current panel's assessments", kind: "view" },
  { command: "/history", description: "Reopen saved output versions without generating", kind: "view" },
  ...PERSONAS.map(persona => ({ command: `/${persona}`, description: `Run ${PERSONA_META[persona].label.toLowerCase()}: ${PERSONA_META[persona].description}`, kind: "ai" as const, requires: "artifact" as const })),
  { command: "/randomize", description: "Run three randomly selected AI perspectives", kind: "ai", requires: "artifact" },
  { command: "/angles", description: "Generate alternative messages for your offer", kind: "ai", requires: "artifact" },
  { command: "/kit", description: "Generate non-leading questions and a proposed test", kind: "ai", requires: "idea" },
  { command: "/summary", description: "Open the saved panel summary and next step", kind: "view", requires: "gate" },
  { command: "/discover", description: "Research a starting point with source excerpts", kind: "view" },
  { command: "/evidence", description: "Record assumptions and real observations", kind: "view" },
  { command: "/interviews", description: "Prepare interviews and import consented notes", kind: "view" },
  { command: "/experiments", description: "Plan tests, record results or publish an offer", kind: "view" },
  { command: "/perspectives", description: "Define a focused simulated customer profile", kind: "view" },
  { command: "/knowledge", description: "Manage source documents and ask cited questions", kind: "view" },
  { command: "/legal", description: "Prepare private legal questions for your locations", kind: "view" },
  { command: "/decision", description: "Inspect the evidence rule and decision history", kind: "view" },
  { command: "/brief", description: "Read your decision brief", kind: "view" },
  { command: "/share", description: "Review what a public brief would contain", kind: "action" },
  { command: "/reload", description: "Recover the latest server-saved project", kind: "action" },
  { command: "/export", description: "Download a private archive with its access key", kind: "action" },
  { command: "/restore", description: "Restore access from a private project export", kind: "action" },
  { command: "/cancel", description: "Cancel the active AI request", kind: "action" },
  { command: "/help", description: "Browse all commands and their prerequisites", kind: "view" },
  { command: "/clear", description: "Start a new project; keep the current project saved", kind: "action" },
  { command: "/delete", description: "Delete the current project after confirmation", kind: "action" },
];
export function commandReason(entry: CommandDefinition, context: SessionContext, busy: boolean): string | undefined {
  if (entry.kind === "ai" && busy) return "Finish or cancel the active request first.";
  if (entry.requires === "artifact" && !context.artifact) return "Generate a landing offer first.";
  if (entry.requires === "idea" && !context.idea) return "Save an idea or generate your offer first.";
  if (entry.requires === "gate" && (!context.confidenceGate || !context.scorecard)) return "Complete a review panel and prepare its interview kit first.";
}
export function matchingCommands(query: string): CommandDefinition[] {
  const term = query.trim().replace(/^\//, "").toLowerCase();
  const rank = (entry: CommandDefinition) => entry.command.slice(1) === term ? 3 : entry.command.slice(1).startsWith(term) ? 2 : entry.command.slice(1).includes(term) ? 1 : 0;
  return COMMANDS.filter(c => !term || `${c.command} ${c.description}`.toLowerCase().includes(term))
    .sort((a, b) => rank(b) - rank(a));
}
