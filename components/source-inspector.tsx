"use client";
import { useEffect, useRef } from "react";
import type { SessionContext } from "@/lib/types";
import { retrieveSnapshot } from "@/lib/knowledge";
import { KnowledgePassages } from "./knowledge-sources";
export function SourceInspector({ context, task, historicalRunId, historical = false, returnFocus, onClose }: { context: SessionContext; task: string; historicalRunId?: string; historical?: boolean; returnFocus?: HTMLElement | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = returnFocus ?? document.activeElement as HTMLElement | null, element = dialog.current;
    element?.showModal(); return () => { element?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  const run = historical ? context.groundingRuns?.find(r => r.id === historicalRunId) : context.groundingRuns?.slice().reverse().find(r => r.task === task);
  const snapshot = run ?? (!historical ? retrieveSnapshot(context, task) : null);
  return <dialog className="source-inspector" ref={dialog} aria-labelledby="source-inspector-title" onClose={onClose} onCancel={onClose} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="source-inspector-inner workspace-content"><header><div><p className="section-label">QUORUM / SOURCES</p><h2 id="source-inspector-title">{run ? "Supplied to this AI request" : "Source inspection"}</h2></div><button onClick={onClose}>Close sources</button></header><p className="workspace-note">{run ? `Saved ${new Date(run.createdAt).toLocaleString()}. This records supplied context; check whether it supports each interpretation.` : historical ? "The original input snapshot is no longer retained. Current sources are available in /knowledge; they are not substituted for this older request." : "Current retrieval preview. These passages have not been sent to an AI for this view."}</p>{snapshot && <section className="research-result"><KnowledgePassages snapshot={snapshot} /></section>}</div></dialog>;
}
