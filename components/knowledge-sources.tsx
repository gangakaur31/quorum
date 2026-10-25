"use client";
import type { KnowledgeEntry, RetrievalSnapshot } from "@/lib/knowledge-types";
import { retrieveSnapshot } from "@/lib/knowledge";
import type { SessionContext } from "@/lib/types";

function SourceLink({ source }: { source: string }) {
  let href: string | undefined;
  try { const url = new URL(source); if (url.protocol === "https:" && !url.username && !url.password) href = url.href; } catch {}
  return href ? <a href={href} target="_blank" rel="noreferrer">Open original source</a> : <span>{source}</span>;
}
export function KnowledgePassages({ snapshot }: { snapshot: RetrievalSnapshot }) {
  return <>{!snapshot.passages.length && <p>No matching passages.</p>}{snapshot.passages.map((p: KnowledgeEntry) => <details className="knowledge-passage" key={p.passageId}><summary>{p.title} <span className="knowledge-tag">{p.layer} · {p.provenance.replaceAll("_", " ")}</span></summary><blockquote>{p.content}</blockquote><p className="workspace-note">{p.publisher} · Publication: {p.publishedAt?.slice(0, 10) ?? "unknown"} · Reviewed / collected: {p.reviewedAt.slice(0, 10)}<br />Version {p.version} · Characters {p.start}–{p.end} · BM25 {p.score.toFixed(2)} · Matches: {p.matchedTerms.join(", ")}</p><SourceLink source={p.source} /><p className="workspace-note">{p.limitations}</p></details>)}{snapshot.gaps.map(g => <p className="workspace-note" key={g}>{g}</p>)}</>;
}
export function GroundingPanel({ context, workspace }: { context: SessionContext; workspace: string }) {
  const task = ({ artifact: "generate", perspectives: "jury", interviews: "interview", experiments: "experiment", evidence: "decision" } as Record<string, string>)[workspace] ?? workspace;
  const run = context.groundingRuns?.slice().reverse().find(r => r.task === task);
  const snapshot = run ?? retrieveSnapshot(context, task);
  const label = ({ generate: "offer", jury: "AI jury", marketing: "marketing", discover: "Discover", interview: "interview", experiment: "experiment planning", legal: "legal preparation" } as Record<string, string>)[task] ?? task;
  return <div className="workspace-content grounding-panel"><details className="research-result"><summary>{run ? `Sources supplied to the last successful ${label} request` : `Relevant source passages · ${label}`} · {snapshot.passages.length}</summary><p className="workspace-note">{run ? `Saved ${new Date(run.createdAt).toLocaleString()}. This records supplied context, not proof that every passage supports the response. Later changes can make a past request outdated.` : "Current retrieval preview. These passages have not been sent to an AI for this view. Decisions, score calculations and experiment counts keep their existing rules."} Manage documents and inspect all requests in /knowledge.</p><KnowledgePassages snapshot={snapshot} /></details></div>;
}
