"use client";
import { useEffect, useId, useState, type RefObject } from "react";
import { commandReason, matchingCommands } from "@/lib/commands";
import type { SessionContext } from "@/lib/types";
import { Icon } from "./icon";

export function CommandComposer({ value, onChange, onSubmit, onRecall, onFocusRequest, inputRef, context, busy, ready }: {
  value: string; onChange: (v: string) => void; onSubmit: (v: string) => void; onRecall: (direction: -1 | 1) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>; context: SessionContext; busy: boolean; ready: boolean;
  onFocusRequest: () => void;
}) {
  const [open, setOpen] = useState(false), [active, setActive] = useState(0), [notice, setNotice] = useState("");
  const id = useId().replaceAll(":", "");
  const suggestions = matchingCommands(value.startsWith("/") ? value : "").slice(0, 7);
  const selected = suggestions[active];
  const selectedReason = selected ? commandReason(selected, context, busy) : undefined;
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !document.querySelector('dialog[open],[role="dialog"]')) {
        event.preventDefault(); onFocusRequest(); if (!value.trim()) onChange("/"); setOpen(true); setActive(0);
      }
    }
    window.addEventListener("keydown", shortcut); return () => window.removeEventListener("keydown", shortcut);
  }, [inputRef, onChange, onFocusRequest, value]);
  useEffect(() => { if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: "nearest" }); }, [open, active, id]);
  const choose = (index: number) => {
    const entry = suggestions[index]; if (!entry) return;
    const reason = commandReason(entry, context, busy);
    if (reason) { setNotice(reason); return; }
    onChange(entry.command); setOpen(false); setNotice(""); inputRef.current?.focus();
  };
  return <div className="command-composer">
    {open && <div className="command-suggestions"><div className="command-menu-heading"><span>Commands</span><span>↑ ↓ select · Esc close</span></div><ul id={`${id}-list`} role="listbox" aria-label="Available Quorum commands">{suggestions.length ? suggestions.map((entry, index) => {
      const reason = commandReason(entry, context, busy);
      return <li role="option" id={`${id}-option-${index}`} aria-selected={index === active} aria-disabled={!!reason} key={entry.command} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}><div><b>{entry.command}</b><span className="command-kind">{entry.kind === "ai" ? "AI request" : entry.kind === "view" ? "Open saved / workspace" : "Action"}</span></div><p>{reason ?? entry.description}</p></li>;
    }) : <li className="no-command-match">No matching command. Try /help.</li>}</ul></div>}
    <label className="terminal-prompt-label" htmlFor={`${id}-input`}><span>QUORUM &gt;</span><span>⌘ / Ctrl K · commands</span></label>
    <textarea id={`${id}-input`} ref={inputRef} className="terminal-input" role="combobox" aria-label="Terminal command or founder idea" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open && selected ? `${id}-option-${active}` : undefined} aria-describedby={`${id}-hint`} value={value} rows={3} placeholder={context.artifact ? "Choose your next question. Type / for commands." : "Describe the idea you want to test…"} onFocus={() => { if (value.startsWith("/")) setOpen(true); }} onBlur={() => setOpen(false)} onChange={event => { onChange(event.target.value); setActive(0); setNotice(""); setOpen(event.target.value.startsWith("/") && !event.target.value.includes("\n")); }} onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
      if (["ArrowUp", "ArrowDown"].includes(event.key) && !value.includes("\n")) {
        event.preventDefault(); if (open && suggestions.length) setActive(previous => (previous + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length); else onRecall(event.key === "ArrowUp" ? -1 : 1); return;
      }
      if (event.key === "Tab" && open && selected && !selectedReason) { event.preventDefault(); choose(active); return; }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (open && selected && value.trim() !== selected.command) { choose(active); return; }
        setOpen(false); onSubmit(value);
      }
    }} />
    <div className="terminal-send-row"><span id={`${id}-hint`} className="terminal-hint">Enter to run · Shift + Enter for a new line</span><button className="terminal-submit" disabled={!ready || !value.trim()} onClick={() => { setOpen(false); onSubmit(value); }}>RUN<Icon name="send" /></button></div>
    <p className="command-feedback" role="status">{notice || (value.startsWith("/") && matchingCommands(value)[0]?.command === value.trim() ? commandReason(matchingCommands(value)[0], context, busy) ?? (matchingCommands(value)[0].kind === "ai" ? "This command makes an AI request. Saved outputs are available in /history." : "Opens existing content or performs the named action.") : "")}</p>
  </div>;
}
