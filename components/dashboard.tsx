"use client";

import { CommandComposer } from "@/components/command-composer";
import { DemoAutofill } from "@/components/demo-autofill";
import { demoOffer } from "@/lib/demo-scenario";
import { ResultTabs } from "@/components/result-tabs";
import { SourceInspector } from "@/components/source-inspector";
import { SavedResults, CommandHelp } from "@/components/saved-results";
import { ValidationKit } from "@/components/validation-kit";
import { COMMANDS, commandReason, type ResultView } from "@/lib/commands";
import { resultLabel, type SavedResult } from "@/lib/result-history";
import { hasSavedProjectWork, projectRequest, readSavedProjects, rememberProject } from "@/lib/project";
import { useEffect, useRef, useState } from "react";
import { DiscoverWorkspace } from "@/components/discover-workspace";
import { EvidenceWorkspace, type EvidenceWorkspaceName } from "@/components/evidence-workspace";
import { DecisionBrief } from "@/components/decision-brief";
import { KnowledgeWorkspace } from "@/components/knowledge-workspace";
import { GroundingPanel } from "@/components/knowledge-sources";
import { LegalWorkspace } from "@/components/legal-workspace";
import type { Opportunity } from "@/lib/discovery-types";
import { ArtifactView } from "@/components/artifact-view";
import { AssumptionsPanel } from "@/components/assumptions-panel";
import { FinalSummary } from "@/components/final-summary";
import { GenerationProgress, type GenerationState } from "@/components/generation-progress";
import { Icon } from "@/components/icon";
import { InspectionPanel } from "@/components/inspection-panel";
import { MarketingComparison } from "@/components/marketing-comparison";
import { PersonaCard, PersonaErrorCard } from "@/components/persona-card";
import { PersonaSwitcher } from "@/components/persona-switcher";
import { ScorecardView } from "@/components/scorecard-view";
import { PERSONAS, PERSONA_META, type ConfidenceGate, type FounderAssumptions, type MarketingAngle, type PersonaFailure, type PersonaId, type PersonaResponse, type Scorecard, type SessionContext } from "@/lib/types";

type LogLine = { text: string; time?: string; tone?: "command" | "success" | "error" };
type BusyState = "generate" | "jury" | "angles" | "confidence" | "angle-jury";

const startingLogs: LogLine[] = [
  { text: "QUORUM v0.1" },
  { text: "Independent validation for product claims." },
  { text: "Describe your idea to generate a real landing artifact." },
];

const initialGenerationProgress: GenerationState = {
  step: 1,
  total: 4,
  label: "Preparing your idea",
  detail: "Turning the description into a focused product brief.",
};

const agentActivity: Record<BusyState, { label: string; messages: string[] }> = {
  generate: { label: "Building your landing artifact", messages: ["Waiting for a validated artifact from the configured AI provider."] },
  jury: { label: "Convening independent jurors", messages: ["Reviewers run concurrently. Completed reviews are saved before they appear."] },
  "angle-jury": { label: "Testing this marketing angle", messages: ["Reviewing this saved marketing angle with the selected panel."] },
  angles: { label: "Creating alternative ad angles", messages: ["Waiting for alternative messages from the configured AI provider."] },
  confidence: { label: "Preparing the real-world next step", messages: ["Preparing the interview kit. The decision rule uses stored evidence."] },
};

function newSession(): SessionContext {
  return { sessionId: crypto.randomUUID(), accessToken: crypto.randomUUID() };
}

function timestamp() {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
}

function displayError(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") return "Cancelled. Your saved results are preserved.";
  return error instanceof Error ? error.message : "Something interrupted that step. Please try again.";
}

function randomPanel() {
  return [...PERSONAS].sort(() => Math.random() - 0.5).slice(0, 3);
}

function mergeResponses(existing: PersonaResponse[], incoming: PersonaResponse[]) {
  const incomingPersonas = new Set(incoming.map((response) => response.persona));
  return [...existing.filter((response) => !incomingPersonas.has(response.persona)), ...incoming];
}

function mergeFailures(existing: PersonaFailure[], incoming: PersonaFailure[]) {
  const incomingPersonas = new Set(incoming.map((failure) => failure.persona));
  return [...existing.filter((failure) => !incomingPersonas.has(failure.persona)), ...incoming];
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${String(remainder).padStart(2, "0")}s` : `${remainder}s`;
}

export function Dashboard({ onExit, initialCommand }: { onExit: () => void; initialCommand?: string }) {
  const [context, setContext] = useState<SessionContext>({ sessionId: "pending" });
  const [workspace, setWorkspace] = useState<"artifact" | "discover" | "brief" | "legal" | EvidenceWorkspaceName>("artifact");
  const [ready, setReady] = useState(false);
  const [terminalCollapsed, setTerminalCollapsed] = useState(false);
  const [projects, setProjects] = useState<SessionContext[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showShare, setShowShare] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [storageNote, setStorageNote] = useState("New project · saved on first action");
  const abortRef = useRef<AbortController | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;
  const [assumptions, setAssumptions] = useState<FounderAssumptions>({});
  const [input, setInput] = useState("");
  const [offerUndo, setOfferUndo] = useState<ReturnType<typeof demoOffer> | null>(null);
  const [offerDemoNotice, setOfferDemoNotice] = useState("");
  const [logs, setLogs] = useState<LogLine[]>(startingLogs);
  const [busy, setBusy] = useState<BusyState | null>(null);
  const [generationProgress, setGenerationProgress] = useState<GenerationState>(initialGenerationProgress);
  const [liveResponses, setLiveResponses] = useState<PersonaResponse[]>([]);
  const [liveFailures, setLiveFailures] = useState<PersonaFailure[]>([]);
  const [inspection, setInspection] = useState<PersonaResponse | null>(null);
  const [resultView, setResultView] = useState<ResultView>("offer");
  const [historicalResult, setHistoricalResult] = useState<SavedResult | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [unreadReviews, setUnreadReviews] = useState<PersonaId[]>([]);
  const [runPersonas, setRunPersonas] = useState<PersonaId[]>([]);
  const [unreadLogs, setUnreadLogs] = useState(0);
  const [focusEpoch, setFocusEpoch] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sourceTriggerRef = useRef<HTMLButtonElement>(null);
  const followLog = useRef(true);
  const previousLogCount = useRef(startingLogs.length);
  const entryHandled = useRef(false);
  const [activeAngle, setActiveAngle] = useState<MarketingAngle | null>(null);
  const [activePersona, setActivePersona] = useState<PersonaId | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const acceptContext = (next: SessionContext) => setContext(current => current.sessionId === next.sessionId ? next : current);
  useEffect(() => {
    const log = logRef.current, added = Math.max(0, logs.length - previousLogCount.current);
    previousLogCount.current = logs.length;
    if (followLog.current) { if (log) log.scrollTop = log.scrollHeight; setUnreadLogs(0); }
    else if (added) setUnreadLogs(previous => previous + added);
  }, [logs]);
  useEffect(() => { if (focusEpoch) { const heading = headingRef.current ?? document.querySelector<HTMLElement>(".workspace-heading h1,.brief-hero h1"); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); } window.scrollTo({ top: 0, behavior: "instant" }); } }, [focusEpoch]);
  useEffect(() => {
    setResultView("offer"); setHistoricalResult(null); setShowSources(false); setInspection(null); setUnreadReviews([]); setUnreadLogs(0); setHistory([]); setHistoryIndex(-1); setInput(""); setOfferUndo(null); setOfferDemoNotice(""); followLog.current = true;
  }, [context.sessionId]);
  useEffect(() => {
    if (ready && initialCommand && !entryHandled.current) { entryHandled.current = true; handleCommand(initialCommand); }
  // Only run a requested landing-page navigation once, after project initialization.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, initialCommand]);
  useEffect(() => {
    if (!showShare) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button,a[href],input') ?? []);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowShare(false);
      if (event.key === "Tab") { const items = focusable(); const first = items[0], last = items[items.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [showShare]);

  async function recover(session = contextRef.current) {
    try {
      const response = await fetch(`/api/session/${session.sessionId}`, { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" });
      const data = await response.json();
      if (response.ok && data.context) { if (contextRef.current.sessionId !== session.sessionId) return; acceptContext(data.context); setAssumptions(data.context.assumptions ?? {}); setStorageNote(data.storage === "redis" ? "Saved · hosted store · 14-day retention" : "Saved · local disk · 14-day retention"); return; }
      if (response.status !== 404) addLog(data.error || "Project recovery failed.", "error");
    } catch { addLog("Could not reach project storage. The browser copy is preserved; retry /reload.", "error"); }
  }
  useEffect(() => {
    try {
      const valid = readSavedProjects(localStorage.getItem("quorum-projects-v2"));
      setProjects(valid);
      localStorage.setItem("quorum-projects-v2", JSON.stringify(valid));
      localStorage.removeItem("quorum-active-v2");
    } catch { /* A fresh workspace also works without browser storage. */ }
    setContext(newSession());
    setReady(true);
  // Entry always starts fresh. Saved snapshots load only after explicit selection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (!hasSavedProjectWork(context)) {
      try { localStorage.removeItem("quorum-active-v2"); } catch { /* Drafts need no cache. */ }
      return;
    }
    if (context.updatedAt) setStorageNote(previous => previous.startsWith("Saved") ? previous : "Saved to project storage · 14-day retention");
    setProjects(previous => {
      const next = rememberProject(previous, context);
      try { localStorage.setItem("quorum-projects-v2", JSON.stringify(next)); localStorage.setItem("quorum-active-v2", context.sessionId); }
      catch { setStorageNote("Browser cache is full. Export this project; server saves are unaffected."); }
      return next;
    });
  }, [context, ready]);
  function switchProject(id: string) {
    if (busy) return addLog("Cancel the active operation before switching projects.", "error");
    const project = projects.find(p => p.sessionId === id);
    if (project) { setContext(project); setAssumptions(project.assumptions ?? {}); setWorkspace("artifact"); setActiveAngle(null); setActivePersona(null); setLiveResponses([]); setLiveFailures([]); void recover(project); }
  }
  function exportProject() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(context, null, 2)], { type: "application/json" }));
    link.download = `quorum-${context.sessionId}.json`; link.click(); URL.revokeObjectURL(link.href);
    addLog("Private project exported. Keep the access key in this file private.", "success");
  }
  async function useOpportunity(opportunity: Opportunity) {
    try {
      const response = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: projectRequest(context), operation: "select", opportunityId: opportunity.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (contextRef.current.sessionId !== data.context.sessionId) return;
      acceptContext(data.context); setAssumptions(data.context.assumptions ?? {}); setInput(data.context.idea); setWorkspace("artifact"); inputRef.current?.focus();
      addLog("Opportunity and sources saved. Review the idea, then press Enter to generate the offer.", "success");
    } catch (error) { addLog(displayError(error), "error"); }
  }

  const displayResponses = activeAngle
    ? busy === "angle-jury" ? liveResponses : context.marketingRuns?.[activeAngle.id]?.responses ?? liveResponses
    : busy === "jury" ? mergeResponses(context.jury ?? [], liveResponses) : context.jury ?? liveResponses;
  const displayFailures = activeAngle
    ? busy === "angle-jury" ? liveFailures : context.marketingRuns?.[activeAngle.id]?.failures ?? []
    : busy === "jury" ? mergeFailures(context.failures ?? [], liveFailures).filter(f => !liveResponses.some(r => r.persona === f.persona)) : context.failures ?? liveFailures;
  const displayScorecard = activeAngle ? context.marketingRuns?.[activeAngle.id]?.scorecard : context.scorecard;
  const displayPersonas = activeAngle ? context.marketingRuns?.[activeAngle.id]?.personas ?? context.personas ?? [] : context.personas ?? [];
  const selectedPersona = activePersona ?? displayResponses[0]?.persona ?? displayFailures[0]?.persona ?? null;
  const selectedResponse = displayResponses.find((response) => response.persona === selectedPersona);
  const selectedFailure = displayFailures.find((failure) => failure.persona === selectedPersona);

  useEffect(() => {
    if (!busy) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    setElapsedSeconds(0);
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  const addLog = (text: string, tone?: LogLine["tone"]) => setLogs((previous) => [...previous, { text, time: timestamp(), tone }]);

  async function generate(idea: string) {
    if (busy) return;
    abortRef.current = new AbortController();
    openResult("offer");
    setBusy("generate");
    setGenerationProgress(initialGenerationProgress);
    addLog(`QUORUM > ${idea}`, "command");
    addLog("Generating your rendered landing artifact…");
    try {
      const response = await fetch("/api/generate", { method: "POST", signal: abortRef.current?.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: { ...projectRequest(context), assumptions }, idea }) });
      if (!response.ok || !response.body) { const failure = await response.json().catch(() => ({})); throw new Error(failure.error || "Artifact generation did not start. Please try again."); }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let complete: { context?: SessionContext; error?: string } | undefined;
      let streamError: string | undefined;
      while (true) {
        const read = await reader.read();
        if (read.done) break;
        buffer += decoder.decode(read.value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const eventName = chunk.match(/^event: (.+)$/m)?.[1];
          const raw = chunk.match(/^data: (.+)$/m)?.[1];
          if (!eventName || !raw) continue;
          const payload = JSON.parse(raw) as GenerationState & { context?: SessionContext; error?: string };
          if (eventName === "provider-status") { const status = JSON.parse(raw) as { state: string; provider: string; attempt: number }; if (status.state === "fallback") addLog("Claude did not return a usable offer. Starting Groq recovery."); else if (status.state === "retrying") addLog(`${status.provider === "anthropic" ? "Claude" : "Groq"} recovery attempt ${status.attempt}; no partial output has been accepted.`); }
          if (eventName === "progress") setGenerationProgress(payload);
          if (eventName === "complete") { setGenerationProgress(payload); complete = payload; }
          if (eventName === "error") streamError = payload.error ?? "Artifact generation did not complete.";
        }
      }
      if (streamError || !complete?.context) throw new Error(streamError ?? "Artifact generation did not complete.");
      setContext(complete.context);
      setAssumptions(complete.context.assumptions ?? assumptions);
      setActiveAngle(null);
      addLog("Artifact rendered. Choose jurors with slash commands.", "success");
    } catch (error) {
      addLog(displayError(error), "error");
      await recover();
    } finally {
      setBusy(null);
    }
  }

  async function createAngles() {
    if (busy || !context.artifact) return addLog("Generate an artifact before testing angles.", "error");
    abortRef.current = new AbortController();
    openResult("angles");
    setBusy("angles");
    addLog("QUORUM > /angles", "command");
    addLog("Generating independent ad angles…");
    try {
      const response = await fetch("/api/marketing", { method: "POST", signal: abortRef.current?.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: projectRequest(context) }) });
      const data = await response.json() as { angles?: MarketingAngle[]; context?: SessionContext; error?: string };
      if (!response.ok || !data.context) throw new Error(data.error ?? "Marketing angles did not complete.");
      setContext(data.context);
      setActiveAngle(null);
      addLog(`${data.angles?.length ?? 0} ad angles are ready for the same jury.`, "success");
    } catch (error) {
      addLog(displayError(error), "error");
      await recover();
    } finally {
      setBusy(null);
    }
  }

  async function runJury(personas: PersonaId[], angle?: MarketingAngle) {
    if (busy || !context.artifact) return addLog("Generate an artifact and finish the active operation first.", "error");
    abortRef.current = new AbortController();
    openResult("reviews");
    if (!personas.length) return addLog("Choose at least one persona before convening the jury.", "error");
    const purpose = angle ? `Testing angle: ${angle.headline}` : `Convening ${personas.map((persona) => PERSONA_META[persona].label).join(", ")}.`;
    setBusy(angle ? "angle-jury" : "jury");
    setLiveResponses([]);
    setLiveFailures([]);
    setActiveAngle(angle ?? null);
    setActivePersona(personas.length === 1 ? personas[0] : null);
    setUnreadReviews([]); setRunPersonas([...new Set(personas)]);
    addLog(angle ? `QUORUM > /test ${angle.id}` : `QUORUM > ${personas.map((persona) => `/${persona}`).join(" ")}`, "command");
    addLog(`${purpose} Responses stream in independently…`);
    try {
      const response = await fetch("/api/jury", { method: "POST", signal: abortRef.current?.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: projectRequest(context), personas, angle }) });
      if (!response.ok || !response.body) throw new Error(await response.text() || "Jury request could not start.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedSuccess = false;
      let complete: { context?: SessionContext; scorecard?: Scorecard; responses?: PersonaResponse[]; failures?: PersonaFailure[]; personas?: PersonaId[]; error?: string } | undefined;
      while (true) {
        const read = await reader.read();
        if (read.done) break;
        buffer += decoder.decode(read.value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const eventName = chunk.match(/^event: (.+)$/m)?.[1];
          const raw = chunk.match(/^data: (.+)$/m)?.[1];
          if (!eventName || !raw) continue;
          const payload = JSON.parse(raw) as PersonaResponse & PersonaFailure & { context?: SessionContext; scorecard?: Scorecard; responses?: PersonaResponse[]; failures?: PersonaFailure[]; personas?: PersonaId[]; error?: string };
          if (eventName === "provider-status") { const status = JSON.parse(raw) as { state: string; provider: string; persona: PersonaId; attempt: number }; if (status.state === "fallback") addLog(`${PERSONA_META[status.persona].label}: Claude did not return a usable result. Starting Groq recovery.`); else if (status.state === "retrying") addLog(`${PERSONA_META[status.persona].label}: ${status.provider === "anthropic" ? "Claude" : "Groq"} recovery attempt ${status.attempt}.`); }
          if (eventName === "persona") { receivedSuccess = true; setLiveResponses((previous) => [...previous, payload as PersonaResponse]); setActivePersona(previous => previous ?? payload.persona); setUnreadReviews(previous => [...new Set([...previous, payload.persona])]); }
          if (eventName === "persona-error") { setLiveFailures((previous) => [...previous, payload as PersonaFailure]); setActivePersona(previous => previous ?? payload.persona); setUnreadReviews(previous => [...new Set([...previous, payload.persona])]); }
          if (eventName === "complete") complete = payload;
          if (eventName === "error" || eventName === "persistence-error") addLog(payload.error ?? "An operation could not be saved.", "error");
        }
      }
      if (!complete?.scorecard || !complete.responses) throw new Error(complete?.error ?? "The stream ended before completion. Saved reviews will be recovered.");
      if (angle) {
        const marketingRuns = { ...(context.marketingRuns ?? {}), [angle.id]: { responses: complete.responses, failures: complete.failures, personas: complete.personas, scorecard: complete.scorecard } };
        if (complete.context) setContext(complete.context); else setContext((previous) => ({ ...previous, marketingRuns }));
        addLog(`Scorecard complete for “${angle.headline}”.`, "success");
      } else {
        const nextContext: SessionContext = complete.context ?? { ...context, personas: complete.personas ?? personas, jury: complete.responses, failures: complete.failures ?? [], scorecard: complete.scorecard };
        setContext(nextContext);
        addLog(`Scorecard complete: ${complete.scorecard.verdict}.`, complete.scorecard.verdict === "QUORUM" ? "success" : "error");
        if (receivedSuccess && !abortRef.current?.signal.aborted) await runConfidence(nextContext);
        if (complete.error) addLog(complete.error, "error");
      }
    } catch (error) {
      addLog(displayError(error), "error");
      await recover();
    } finally {
      setBusy(null);
    }
  }

  async function runConfidence(nextContext: SessionContext) {
    setBusy("confidence");
    addLog("Preparing interview questions from the current project evidence…");
    try {
      const response = await fetch("/api/confidence", { method: "POST", signal: abortRef.current?.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: projectRequest(nextContext) }) });
      const data = await response.json() as { confidenceGate?: ConfidenceGate; context?: SessionContext; error?: string };
      if (!response.ok || !data.context) throw new Error(data.error ?? "Confidence Gate did not complete.");
      setContext(data.context);
      addLog("Interview kit saved. Open Interview kit when you are ready; the evidence decision remains rule-based.", "success");
    } catch (error) {
      addLog(displayError(error), "error");
      await recover();
    } finally {
      setBusy(null);
    }
  }

  async function copyDecisionBrief() {
    try {
      const response = await fetch("/api/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: projectRequest(context), operation: "share" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const url = `${window.location.origin}/brief/${data.shareId}`;
      setShareLink(url);
      try { await navigator.clipboard.writeText(url); } catch { /* The visible link remains copyable. */ }
      addLog("Read-only brief snapshot saved. Anyone with its link can read it for up to 14 days. Revoke it from this dialog.", "success");
      await recover();
    } catch (error) { addLog(displayError(error), "error"); }
  }

  async function deleteProject() {
    if (!window.confirm("Delete this project, shared brief and public experiment contacts? Export first if you need an archive.")) return;
    try {
      const response = await fetch(`/api/session/${context.sessionId}`, { method: "DELETE", headers: { Authorization: `Bearer ${context.accessToken}` } });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const remaining = projects.filter(p => p.sessionId !== context.sessionId);
      setProjects(remaining); localStorage.setItem("quorum-projects-v2", JSON.stringify(remaining)); clearSession(); addLog("Project and its public records deleted.", "success");
    } catch (error) { addLog(displayError(error), "error"); }
  }
  async function restoreAccess(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5000000) throw new Error("Choose a Quorum JSON export below 5 MB.");
      const saved = JSON.parse(await file.text()) as SessionContext;
      if (!/^[a-zA-Z0-9-]{16,100}$/.test(saved.sessionId) || !/^[a-zA-Z0-9-]{16,100}$/.test(saved.accessToken ?? "")) throw new Error("This file does not contain a valid private project key.");
      const response = await fetch(`/api/session/${saved.sessionId}`, { headers: { Authorization: `Bearer ${saved.accessToken}` }, cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "The stored project is unavailable. The export remains a readable archive.");
      setContext(data.context); setAssumptions(data.context.assumptions ?? {}); setWorkspace("artifact"); setActiveAngle(null); setActivePersona(null); addLog("Project access restored from its private export.", "success");
    } catch (error) { addLog(displayError(error), "error"); }
  }
  function inspect(personaName: string) {
    const lookup = personaName.trim().toLowerCase().replaceAll("_", "-");
    const response = context.jury?.find((entry) => entry.persona === lookup);
    if (!response) return addLog(`No stored decision summary found for “${personaName}”.`, "error");
    openResult("reviews");
    choosePersona(response.persona);
    setInspection(response);
    setActiveAngle(null);
    addLog(`Opening ${PERSONA_META[response.persona].label}'s stored decision summary.`, "success");
  }

  function clearSession() {
    if (busy) return;
    setStorageNote("New project · saved on first action");
    setWorkspace("artifact"); setShareLink(""); setContext(newSession()); setAssumptions({}); setLogs(startingLogs); setLiveResponses([]); setLiveFailures([]); setInspection(null); setActiveAngle(null); setActivePersona(null); setHistoricalResult(null); setResultView("offer"); setInput("");
  }

  function openResult(view: ResultView, focus = true) {
    setWorkspace("artifact"); setResultView(view); setHistoricalResult(null); setInspection(null); setShowSources(false);
    if (window.innerWidth <= 900) setTerminalCollapsed(true);
    if (focus) setFocusEpoch(previous => previous + 1);
  }
  function navigateWorkspace(name: typeof workspace) {
    if (name === "artifact") openResult("offer");
    else { setWorkspace(name); setHistoricalResult(null); setShowSources(false); setFocusEpoch(previous => previous + 1); if (window.innerWidth <= 900) setTerminalCollapsed(true); }
  }
  function choosePersona(persona: PersonaId) { setActivePersona(persona); setUnreadReviews(previous => previous.filter(p => p !== persona)); setInspection(null); }
  function openSaved(record: SavedResult) {
    openResult(record.kind === "review" ? "reviews" : record.kind === "panel" ? "scores" : record.kind);
    setActiveAngle(null);
    setHistoricalResult(record);
    addLog(`Viewing saved ${resultLabel(record)}. No AI request made.`, "success");
  }
  function recall(direction: -1 | 1) {
    const next = direction === -1 ? (historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1)) : Math.min(history.length, historyIndex + 1);
    setHistoryIndex(next); setInput(history[next] ?? "");
  }
  function focusTerminal() { setTerminalCollapsed(false); requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.scrollIntoView({ block: "nearest" }); }); }
  async function clearSavedResults() {
    try {
      const response = await fetch("/api/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: projectRequest(context), operation: "clear-result-history" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); acceptContext(data.context); addLog("Saved output versions cleared. Current results are preserved.", "success");
    } catch (error) { addLog(displayError(error), "error"); }
  }
  function runAgain() {
    if (busy) return;
    if (historicalResult?.kind === "review") {
      const angle = historicalResult.angle ? context.marketingAngles?.find(a => a.id === historicalResult.angle?.id) : undefined;
      if (historicalResult.angle && !angle) return addLog("That earlier angle is no longer current. Open Angles to review the saved messages before generating again.", "error");
      void runJury([historicalResult.response.persona], angle); return;
    }
    if (resultView === "reviews" && selectedPersona) { void runJury([selectedPersona], activeAngle ?? undefined); return; }
    if (resultView === "angles") { void createAngles(); return; }
    if (resultView === "kit") { openResult("kit"); abortRef.current = new AbortController(); void runConfidence(context); return; }
    if (resultView === "scores") {
      const previousPanel = historicalResult?.kind === "panel" ? historicalResult : undefined;
      const angle = previousPanel?.angle ? context.marketingAngles?.find(a => a.id === previousPanel.angle?.id) : activeAngle ?? undefined;
      if (previousPanel?.angle && !angle) return addLog("This angle has been replaced. Open the current Angles view before running its panel again.", "error");
      void runJury(previousPanel?.personas ?? displayPersonas, angle);
    }
  }
  function handleCommand(value: string) {
    const command = value.trim(); if (!command) return;
    setInput(""); setHistory(previous => [...previous, command].slice(-100)); setHistoryIndex(-1);
    const navigation: Record<string, typeof workspace> = { "/discover": "discover", "/artifact": "artifact", "/evidence": "evidence", "/interviews": "interviews", "/experiments": "experiments", "/perspectives": "perspectives", "/decision": "decision", "/knowledge": "knowledge", "/brief": "brief", "/legal": "legal" };
    if (navigation[command]) { navigateWorkspace(navigation[command]); addLog(`QUORUM > ${command}`, "command"); return; }
    const views: Record<string, ResultView> = { "/reviews": "reviews", "/scorecard": "scores", "/history": "history", "/help": "help" };
    if (views[command]) { openResult(views[command]); addLog(`QUORUM > ${command}`, "command"); return; }
    if (command === "/cancel") { abortRef.current?.abort(); addLog("Cancellation requested. Saved results will be recovered."); return; }
    if (command === "/reload") { void recover(); return; }
    if (command === "/share") { setShowShare(true); return; }
    if (command === "/export") { exportProject(); return; }
    if (command.startsWith("/inspect ") || command.startsWith("/why ")) { inspect(command.replace(/^\/(inspect|why)\s+/, "")); return; }
    if (command === "/summary") { if (context.confidenceGate && context.scorecard) openResult("summary"); else addLog("Prepare a review panel and interview kit before opening its summary.", "error"); return; }
    if (busy) return addLog("An operation is active. You can read saved results or use /cancel before starting another request.", "error");
    const definition = COMMANDS.find(c => c.command === command), reason = definition ? commandReason(definition, context, false) : undefined;
    if (reason) return addLog(reason, "error");
    if (command === "/delete") { void deleteProject(); return; }
    if (command === "/restore") { restoreRef.current?.click(); return; }
    if (command === "/kit") { openResult("kit"); abortRef.current = new AbortController(); void runConfidence(context); return; }
    if (!context.artifact && !command.startsWith("/")) { void generate(command); return; }
    if (command === "/clear") { clearSession(); return; }
    if (command === "/randomize") { void runJury(randomPanel()); return; }
    if (command === "/angles") { void createAngles(); return; }
    const parts = command.split(/\s+/);
    if (parts.every(part => part.startsWith("/") && PERSONAS.includes(part.slice(1) as PersonaId))) { void runJury([...new Set(parts.map(part => part.slice(1) as PersonaId))]); return; }
    addLog("Unrecognized command. Type / for suggestions, or /help to browse the available actions.", "error");
  }

  const isBusy = Boolean(busy);
  const activeMessage = busy ? agentActivity[busy].messages[0] : "";
  const titles: Record<ResultView, [string, string]> = {
    offer: ["Your offer, ready to examine.", "Read the proposition before asking anyone to challenge it."],
    reviews: ["One perspective at a time.", "AI assessments reveal questions to investigate. They are not customer evidence."],
    scores: ["Read the panel together.", "Inspect ordinal assessments, unknowns and disagreement."],
    angles: ["Different ways to express the offer.", "These messages are hypotheses to test with real people."],
    kit: ["Prepare the next conversation.", "Non-leading questions, an outreach draft and a proposed experiment."],
    summary: ["Decide what to investigate next.", "A readable summary of the saved panel and its proposed next step."],
    history: ["Return to an earlier result.", "Read a saved version without starting another AI request."],
    help: ["Find the right command.", "Choose your next question. Keep control of the pace."],
  };
  const unseenReviews = unreadReviews.filter(p => p !== selectedPersona);
  const finishedCount = runPersonas.filter(p => liveResponses.some(r => r.persona === p) || liveFailures.some(r => r.persona === p)).length;
  const sourceTask = historicalResult ? ({ offer: "generate", review: "jury", panel: "jury", angles: "marketing", kit: "experiment" } as const)[historicalResult.kind] : ({ offer: "generate", reviews: "jury", scores: "jury", angles: "marketing", kit: "experiment", summary: "experiment", history: "knowledge", help: "knowledge" } as const)[resultView];
  const canRunAgain = !isBusy && (resultView === "kit" ? !!context.idea : !!context.artifact && (["angles", "reviews", "scores"].includes(resultView))) && (resultView !== "reviews" || !!selectedPersona || historicalResult?.kind === "review") && (resultView !== "scores" || !!displayPersonas.length || historicalResult?.kind === "panel");
  const currentReviewStale = !!selectedResponse && selectedResponse.contextRevision !== (context.evaluationRevision ?? 0);
  const visibleAngles = historicalResult?.kind === "angles" ? historicalResult.angles : context.marketingAngles;
  const visibleGate = historicalResult?.kind === "kit" ? historicalResult.gate : context.confidenceGate;

  return (
    <main className="app-shell terminal-led">
      <input ref={restoreRef} type="file" accept="application/json,.json" hidden onChange={e => { void restoreAccess(e.target.files?.[0]); e.target.value = ""; }} />
      <header className="app-topbar"><div className="app-brand"><span className="status" />QUORUM CLI</div><button className="mobile-terminal-toggle" aria-expanded={!terminalCollapsed} onClick={() => setTerminalCollapsed(value => !value)}>{terminalCollapsed ? "Show terminal" : "Hide terminal"}</button><nav className="app-nav" aria-label="Project actions"><select aria-label="Switch project" title="Open a saved project explicitly. New visits start with empty drafts." value={context.sessionId} disabled={isBusy} onChange={e => switchProject(e.target.value)}>{projects.some(p => p.sessionId === context.sessionId) ? null : <option value={context.sessionId}>New project</option>}{projects.map(p => <option key={p.sessionId} value={p.sessionId}>{p.idea?.slice(0, 35) || "Untitled project"}</option>)}</select><button className="topbar-button" disabled={isBusy} onClick={clearSession}>NEW PROJECT</button><button className="topbar-button" onClick={exportProject}>EXPORT</button><button className="topbar-button" onClick={focusTerminal}>FOCUS TERMINAL</button><button className="topbar-button" onClick={onExit}>EXIT</button></nav></header>
      <div className="app-grid">
        <section className={`terminal-panel${terminalCollapsed ? " is-collapsed" : ""}`} aria-label="Quorum command terminal">
          <div className="terminal-header"><p className="terminal-kicker">ONE COMMAND AT A TIME</p><h2>{context.artifact ? "Choose the next question." : "Start with the idea."}</h2><p>Your commands set the pace. Read each result, inspect its basis, then choose what comes next.</p></div>
          {!context.artifact && workspace === "artifact" && <DemoAutofill disabled={isBusy || !ready} controller={{ canUndo: !!offerUndo, notice: offerDemoNotice, fill: () => { const example = demoOffer(); if (input === example.input && JSON.stringify(assumptions) === JSON.stringify(example.assumptions)) { setOfferDemoNotice("The example is already filled. Nothing changed; any previous Undo remains available."); return; } setOfferUndo({ input, assumptions: structuredClone(assumptions) }); setInput(example.input); setAssumptions(example.assumptions); setOfferDemoNotice("ScopeSignal idea and optional assumptions filled. Review or edit, then press RUN. No AI request or save was made."); }, undo: () => { if (!offerUndo) return; setInput(offerUndo.input); setAssumptions(offerUndo.assumptions); setOfferUndo(null); setOfferDemoNotice("Previous idea and assumptions restored. Saved projects are unchanged."); } }} />}
          {!context.artifact && <AssumptionsPanel assumptions={assumptions} onChange={setAssumptions} />}
          <div className="workspace-nav" aria-label="Workspace commands">{["artifact", "discover", "evidence", "interviews", "experiments", "perspectives", "decision", "knowledge", "legal", "brief"].map(name => <button key={name} aria-current={workspace === name ? "page" : undefined} onClick={() => { navigateWorkspace(name as typeof workspace); addLog(`QUORUM > /${name}`, "command"); }}>/{name}</button>)}</div>
          <div className="terminal-tools"><button onClick={() => handleCommand("/history")}>Saved results <span>{context.resultHistory?.length ?? 0}</span></button><button onClick={() => handleCommand("/help")}>Commands <kbd>⌘K</kbd></button></div>
          <p className="terminal-hint storage-note" role="status">{storageNote}</p>
          <div ref={logRef} className="terminal-log" role="log" aria-label="Terminal activity" aria-live="polite" aria-relevant="additions" onScroll={() => { const element = logRef.current; if (!element) return; followLog.current = element.scrollHeight - element.clientHeight - element.scrollTop < 48; if (followLog.current) setUnreadLogs(0); }}>{logs.map((log, index) => <p className={`log-line ${log.tone ?? ""}`} key={`${index}-${log.text}`}><span className="time">{log.time ?? "--:--:--"}</span>{log.text}</p>)}{busy && <button className="cancel-operation" onClick={() => abortRef.current?.abort()}>Cancel operation</button>}{busy && <p className="terminal-activity"><span className="time">WAIT</span><i />{activeMessage}<b>{formatDuration(elapsedSeconds)}</b></p>}</div>
          {!!unreadLogs && <button className="new-terminal-activity" onClick={() => { followLog.current = true; if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; setUnreadLogs(0); }}>{unreadLogs} new activity · Jump to latest ↓</button>}
          <div className="terminal-input-wrap"><CommandComposer value={input} onChange={setInput} onSubmit={handleCommand} onRecall={recall} onFocusRequest={focusTerminal} inputRef={inputRef} context={context} busy={isBusy} ready={ready} />{context.artifact && <div className="quick-commands" aria-label="Suggested next commands"><span>CHOOSE WHAT TO READ NEXT</span><button type="button" onClick={() => openResult("reviews")}>View reviews</button><button type="button" onClick={() => navigateWorkspace("evidence")}>Record evidence</button><button type="button" onClick={() => navigateWorkspace("knowledge")}>Source library</button></div>}</div>
        </section>
        <section className="canvas" aria-label="Artifact canvas"><div className="canvas-inner">
          {workspace === "discover" ? <DiscoverWorkspace key={context.sessionId} context={context} onContext={acceptContext} onUse={opportunity => void useOpportunity(opportunity)} />
            : workspace === "knowledge" ? <KnowledgeWorkspace key={context.sessionId} context={context} onContext={acceptContext} />
              : workspace === "legal" ? <LegalWorkspace key={context.sessionId} context={context} onContext={acceptContext} />
                : workspace === "brief" ? <><button className="return-run" onClick={() => setShowShare(true)}>Share reviewed Decision Brief snapshot</button><DecisionBrief context={context} /></>
                  : workspace !== "artifact" ? <EvidenceWorkspace key={`${context.sessionId}:${workspace}`} workspace={workspace} context={context} onContext={acceptContext} />
                    : <>
                      <header className="result-heading"><div><p className="section-label">QUORUM / {historicalResult ? "SAVED VERSION" : resultView.toUpperCase()}</p><h1 ref={headingRef} tabIndex={-1}>{historicalResult ? resultLabel(historicalResult) : titles[resultView][0]}</h1><p>{historicalResult ? `Saved ${new Date(historicalResult.createdAt).toLocaleString()}. Opening this version does not change current scores or evidence.` : titles[resultView][1]}</p></div></header>
                      <ResultTabs value={resultView} onChange={view => openResult(view, false)} />
                      <div className="result-tools"><span>{historicalResult ? historicalResult.contextRevision !== (context.evaluationRevision ?? 0) ? "Earlier project context" : "Saved version · current context" : "Viewing saved content makes no AI request"}</span><div>{historicalResult && <button onClick={() => openResult("history")}>Back to saved results</button>}{!["history", "help"].includes(resultView) && <button ref={sourceTriggerRef} onClick={() => setShowSources(true)}>Inspect sources</button>}{canRunAgain && <button className="rerun-result" onClick={runAgain}>Run again <small>AI request</small></button>}</div></div>
                      <div className="result-operation" aria-live="polite">{busy ? <><span className="operation-dot" /><span>{agentActivity[busy].label}{(busy === "jury" || busy === "angle-jury") && runPersonas.length ? ` · ${finishedCount}/${runPersonas.length} perspectives finished` : ""}</span><span className="operation-elapsed">{formatDuration(elapsedSeconds)} elapsed</span><button onClick={() => abortRef.current?.abort()}>Cancel operation</button></> : <><span className="operation-idle" />{context.updatedAt ? "Project saved. Choose when to continue." : "New project. Your first saved action creates the project."}</>}</div>
                      {!!historicalResult && <p className="historical-notice">You are reading a retained output. Its assumptions, sources or legal context may have changed. Current project decisions are available in /decision.</p>}
                      <div className="focused-result" role={resultView === "history" || resultView === "help" ? undefined : "tabpanel"} id={`result-panel-${resultView}`} aria-labelledby={resultView === "history" || resultView === "help" ? undefined : `result-tab-${resultView}`}>
                        {resultView === "history" ? <SavedResults context={context} onOpen={openSaved} onClear={() => void clearSavedResults()} />
                          : resultView === "help" ? <CommandHelp context={context} busy={isBusy} onChoose={command => { setInput(command); setTerminalCollapsed(false); requestAnimationFrame(() => inputRef.current?.focus()); }} />
                            : resultView === "offer" ? busy === "generate" ? <GenerationProgress progress={generationProgress} /> : historicalResult?.kind === "offer" || context.artifact ? <ArtifactView artifact={historicalResult?.kind === "offer" ? historicalResult.artifact : context.artifact!} /> : <div className="canvas-intro"><div><Icon name="terminal" /><h2>Start with the thing you want to test.</h2><p>Describe your idea in the terminal. Add any customer or problem assumptions you want to examine.</p><button onClick={() => { setTerminalCollapsed(false); requestAnimationFrame(() => inputRef.current?.focus()); }}>Write your idea <Icon name="arrow" /></button><button onClick={() => navigateWorkspace("discover")}>Explore a starting point</button></div></div>
                              : resultView === "reviews" ? <>
                                {historicalResult?.kind === "review" ? <><PersonaCard response={historicalResult.response} onInspect={setInspection} />{historicalResult.angle && <p className="workspace-note">Angle reviewed: {historicalResult.angle.headline}</p>}</> : <>
                                  {!!unseenReviews.length && <button className="new-reviews" onClick={() => choosePersona(unseenReviews[0])}>{unseenReviews.length} new {unseenReviews.length === 1 ? "perspective" : "perspectives"} available · Read next →</button>}
                                  {(displayResponses.length > 0 || displayFailures.length > 0) && <PersonaSwitcher responses={displayResponses} failures={displayFailures} activePersona={selectedPersona} onSelect={choosePersona} />}
                                  {currentReviewStale && <p className="historical-notice">This review was made with earlier or unversioned context. It remains readable; run it again to assess the current evidence. Current scoring excludes stale reviews.</p>}
                                  {(selectedResponse || selectedFailure) && <div role="tabpanel" id="jury-panel" aria-labelledby={`jury-tab-${selectedPersona}`} tabIndex={0}>{selectedResponse && <PersonaCard response={selectedResponse} onInspect={setInspection} />}{selectedFailure && <PersonaErrorCard failure={selectedFailure} disabled={isBusy} onRetry={() => void runJury([selectedFailure.persona], activeAngle ?? undefined)} />}</div>}
                                  {!displayResponses.length && !displayFailures.length && <div className="result-empty"><h2>{busy === "jury" || busy === "angle-jury" ? "Waiting for the first perspective." : "Choose a question to examine."}</h2><p>Reviewers run independently. Start with a focused perspective, then decide whether you need another.</p><div className="workspace-actions"><button disabled={isBusy || !context.artifact} onClick={() => void runJury(["analyst"])}>Run analyst · AI request</button><button disabled={isBusy || !context.artifact} onClick={() => void runJury(["skeptic"])}>Run skeptic · AI request</button></div></div>}
                                </>}
                                {inspection && <InspectionPanel response={inspection} onClose={() => setInspection(null)} />}
                              </>
                                : resultView === "scores" ? historicalResult?.kind === "panel" || displayScorecard ? <ScorecardView scorecard={historicalResult?.kind === "panel" ? historicalResult.scorecard : displayScorecard!} personas={historicalResult?.kind === "panel" ? historicalResult.personas : displayPersonas} /> : <div className="result-empty"><h2>No panel scorecard yet.</h2><p>Read a review first. A partial or failed panel keeps its unknowns visible.</p><button onClick={() => openResult("reviews")}>Open reviews</button></div>
                                  : resultView === "angles" ? <>{visibleAngles?.length ? <><div className="angle-grid">{visibleAngles.map(angle => <article className="angle-card" key={angle.id}><h2>{angle.headline}</h2><p>{angle.angle}</p><p><b>Call to action:</b> {angle.cta}</p>{!historicalResult && <button disabled={isBusy || !displayPersonas.length} onClick={() => void runJury(displayPersonas, angle)}>Review this angle · AI request</button>}</article>)}</div>{!historicalResult && context.marketingRuns && <MarketingComparison angles={visibleAngles} runs={context.marketingRuns} onSelect={angle => { openResult("reviews"); setActiveAngle(angle); setActivePersona(null); setLiveResponses([]); setLiveFailures([]); }} />}</> : <div className="result-empty"><h2>Give the offer another expression.</h2><p>Generate two or three messaging hypotheses. Real tests are needed to compare their effectiveness.</p><button disabled={isBusy || !context.artifact} onClick={() => void createAngles()}>Generate angles · AI request</button></div>}</>
                                    : resultView === "kit" ? visibleGate ? <div className="interview-kit-view"><p className="kit-context-note">Questions and thresholds below are AI proposals. Your actual evidence decision is inspected separately in /decision.</p><ValidationKit kit={visibleGate.validationKit} /><details className="kit-decision-context"><summary>Evidence decision recorded with this kit</summary><p><b>{visibleGate.status ?? "Gather evidence"}:</b> {visibleGate.rationale}</p><p><b>Recorded next step:</b> {visibleGate.nextStep}</p><p>This is context from preparation time. Inspect /decision for the current rule-based decision.</p></details></div> : <div className="result-empty"><h2>Prepare a conversation with a real person.</h2><p>Generate five non-leading questions, an outreach draft and a proposed small test.</p><button disabled={isBusy || !context.idea} onClick={runAgain}>Prepare interview kit · AI request</button></div>
                                      : context.confidenceGate && context.scorecard ? <FinalSummary responses={context.jury ?? []} scorecard={context.scorecard} gate={context.confidenceGate} onClose={() => openResult("reviews")} /> : <div className="result-empty"><h2>A summary needs a saved panel and kit.</h2><p>You can always inspect the evidence decision in /decision.</p><button onClick={() => navigateWorkspace("decision")}>Open evidence decision</button></div>}
                      </div>
                      {activeAngle && ["reviews", "scores"].includes(resultView) && !historicalResult && <div className="angle-context"><p>Angle under review: <b>{activeAngle.headline}</b></p><button className="return-run" onClick={() => { setActiveAngle(null); setActivePersona(null); setLiveResponses([]); setLiveFailures([]); }}>Return to main reviews</button></div>}
                      {!historicalResult && !["history", "help"].includes(resultView) && <GroundingPanel context={context} workspace={sourceTask} />}
                    </>}
          {workspace !== "artifact" && workspace !== "knowledge" && <GroundingPanel context={context} workspace={workspace} />}
        </div></section>
      </div>
      {showSources && <SourceInspector context={context} returnFocus={sourceTriggerRef.current} task={sourceTask} historical={!!historicalResult || (resultView === "reviews" && !!selectedResponse)} historicalRunId={historicalResult?.groundingRunId ?? (resultView === "reviews" ? selectedResponse?.groundingRunId : undefined)} onClose={() => setShowSources(false)} />}
      {showShare && <div className="dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="share-title" className="share-dialog"><h2 id="share-title">Share a read-only Decision Brief</h2><p>The snapshot includes your idea, generated artifact, AI reviews, scorecard and next step. Private interview notes, raw evidence records, legal preparation, knowledge documents, retrieval history, saved output versions and the project access key are excluded. Aggregate evidence counts and the decision are included. AI text may reflect private sources, so inspect it first.</p><p>Anyone with the link can read the published snapshot. Links expire after 14 days. Public URLs need a publicly reachable server and persistent storage.</p><div className="workspace-actions"><button onClick={() => void copyDecisionBrief()}>Create / refresh share link</button><button onClick={() => setShowShare(false)}>Close</button></div>{shareLink && <p><a href={shareLink} target="_blank" rel="noreferrer">{shareLink}</a></p>}{context.shareId && <button onClick={async () => { const response = await fetch("/api/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: projectRequest(context), operation: "revoke-share" }) }); const data = await response.json(); if (response.ok) { acceptContext(data.context); setShareLink(""); addLog("Share link revoked.", "success"); } else addLog(data.error, "error"); }}>Revoke shared snapshot</button>}</section></div>}
    </main>
  );
}

