"use client";
import { Children, cloneElement, createContext, isValidElement, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode, type ReactElement } from "react";
import { demoCommandForms, demoFieldsMatch, type DemoCommandId, type DemoFields, type DemoFormId, type DemoValue } from "@/lib/demo-scenario";
import type { SessionContext } from "@/lib/types";
import { Icon } from "./icon";

type Draft = { read: () => DemoFields; replace: (values: DemoFields) => void };
type Controller = { fill: () => void; undo: () => void; canUndo: boolean; notice: string; register: (id: DemoFormId, draft: Draft) => () => void };
const DemoContext = createContext<Controller | null>(null);

/** Local drafts only. No form submission, network, DOM access, navigation or persistence. */
export function DemoCommand({ command, context, children }: { command: DemoCommandId; context: SessionContext; children: ReactNode }) {
  const drafts = useRef(new Map<DemoFormId, Draft>()), previous = useRef(new Map<DemoFormId, DemoFields>());
  const [canUndo, setCanUndo] = useState(false), [notice, setNotice] = useState("");
  const filled = useRef(false);
  useEffect(() => {
    if (!filled.current) return;
    const examples = demoCommandForms(command, context);
    for (const [id, draft] of drafts.current) {
      const next = examples[id]?.hypothesisId, current = draft.read();
      if (next && current.hypothesisId === "") draft.replace({ ...current, hypothesisId: next });
    }
  }, [context.hypotheses, command]);
  const register = (id: DemoFormId, draft: Draft) => { drafts.current.set(id, draft); return () => { if (drafts.current.get(id) === draft) drafts.current.delete(id); }; };
  const fill = () => {
    filled.current = true;
    const examples = demoCommandForms(command, context), snapshots = new Map<DemoFormId, DemoFields>();
    for (const [id, draft] of drafts.current) {
      const values = examples[id]; if (!values) continue;
      const current = draft.read(); if (demoFieldsMatch(current, values)) continue;
      snapshots.set(id, structuredClone(current)); draft.replace(structuredClone(values));
    }
    if (!snapshots.size) { setNotice("These example fields are already filled. Nothing changed; any previous Undo remains available."); return; }
    previous.current = snapshots;
    setCanUndo(previous.current.size > 0);
    setNotice("ScopeSignal demo fields filled, including scripted notes and results where available. Fictional records are labelled Demo and excluded from real validation. Review, then use the normal action. Nothing saved or run.");
  };
  const undo = () => { filled.current = false; for (const [id, values] of previous.current) drafts.current.get(id)?.replace(structuredClone(values)); previous.current.clear(); setCanUndo(false); setNotice("Previous inputs restored. Saved records were not changed."); };
  return <DemoContext.Provider value={{ fill, undo, canUndo, notice, register }}>{children}</DemoContext.Provider>;
}

export function DemoAutofill({ disabled, controller }: { disabled?: boolean; controller?: Pick<Controller, "fill" | "undo" | "canUndo" | "notice"> }) {
  const local = useContext(DemoContext), control = controller ?? local;
  if (!control) return null;
  return <div className="demo-autofill"><div className="demo-autofill-actions"><button type="button" className="demo-autofill-button" aria-label="Fill example data" title="Fill this command's draft fields with the shared ScopeSignal example. Does not submit or call AI. Undo restores your previous inputs." disabled={disabled} onClick={control.fill}><Icon name="spark" />Demo Autofill</button>{control.canUndo && <button type="button" className="demo-undo" disabled={disabled} onClick={control.undo}>Undo fill</button>}</div>{control.notice && <p role="status">{control.notice}</p>}</div>;
}

type FieldProps = Record<string, unknown> & { name?: string; type?: string; value?: DemoValue; checked?: boolean; defaultValue?: DemoValue; defaultChecked?: boolean; children?: ReactNode; onChange?: (event: unknown) => void };
function valuesFrom(children: ReactNode, controlledOnly = false): DemoFields {
  const values: DemoFields = {};
  const visit = (nodes: ReactNode) => Children.forEach(nodes, node => {
    if (!isValidElement<FieldProps>(node)) return;
    const p = node.props;
    if (["input", "select", "textarea"].includes(String(node.type)) && p.name && p.type !== "file") {
      const explicit = p.type === "checkbox" ? p.checked !== undefined : p.value !== undefined;
      if (!controlledOnly || explicit) {
        if (p.type === "checkbox") {
          if (typeof p.value === "string") { const list = values[p.name] as string[] | undefined; values[p.name] = [...(list ?? []), ...((p.checked ?? p.defaultChecked) ? [p.value] : [])]; }
          else values[p.name] = p.checked ?? p.defaultChecked ?? false;
        } else {
          let fallback: DemoValue = "";
          if (node.type === "select") { const options: ReactElement<FieldProps>[] = []; const collect = (items: ReactNode) => Children.forEach(items, item => { if (isValidElement<FieldProps>(item)) { if (item.type === "option") options.push(item); else collect(item.props.children); } }); collect(p.children); fallback = options[0]?.props.value ?? ""; }
          values[p.name] = p.value ?? p.defaultValue ?? fallback;
        }
      }
    }
    visit(p.children);
  });
  visit(children); return values;
}

/** Makes legacy native inputs React-controlled while preserving their original action handlers. */
export function DemoForm({ formId, onPopulate, children, ...props }: ComponentProps<"form"> & { formId: DemoFormId; onPopulate?: (values: DemoFields) => void }) {
  const demo = useContext(DemoContext);
  const initial = useRef(valuesFrom(children)), [fields, setFields] = useState<DemoFields>(initial.current);
  const latest = useRef({ fields, children, onPopulate }); latest.current = { fields, children, onPopulate };
  useEffect(() => {
    const draft: Draft = { read: () => ({ ...latest.current.fields, ...valuesFrom(latest.current.children, true) }), replace: values => { setFields(values); latest.current.onPopulate?.(values); } };
    return demo?.register(formId, draft);
  // The command scope stays mounted; draft readers always use current React props/state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);
  const render = (nodes: ReactNode): ReactNode => Children.map(nodes, node => {
    if (!isValidElement<FieldProps>(node)) return node;
    const p = node.props;
    if (["input", "select", "textarea"].includes(String(node.type)) && p.name && p.type !== "file") {
      const external = p.type === "checkbox" ? p.checked !== undefined : p.value !== undefined && p.type !== "checkbox";
      const value = fields[p.name] ?? initial.current[p.name] ?? "";
      const checkbox = p.type === "checkbox";
      const change = (event: unknown) => {
        const target = (event as { currentTarget: HTMLInputElement }).currentTarget;
        setFields(previous => ({ ...previous, [p.name!]: checkbox ? typeof p.value === "string" ? target.checked ? [...new Set([...(Array.isArray(previous[p.name!]) ? previous[p.name!] as string[] : []), p.value])] : (Array.isArray(previous[p.name!]) ? previous[p.name!] as string[] : []).filter(v => v !== p.value) : target.checked : target.value }));
        p.onChange?.(event);
      };
      return cloneElement(node, { defaultValue: undefined, defaultChecked: undefined, ...(checkbox ? { checked: external ? p.checked : typeof p.value === "string" ? Array.isArray(value) && value.includes(p.value) : Boolean(value) } : { value: external ? p.value : value }), onChange: change });
    }
    return p.children ? cloneElement(node, {}, render(p.children)) : node;
  });
  return <form {...props} onReset={event => { setFields(initial.current); props.onReset?.(event); }}>{render(children)}</form>;
}
