import type { ComponentProps } from "react";

export type IconName = "jury" | "arrow" | "lens" | "spark" | "shield" | "person" | "switch" | "wallet" | "terminal" | "copy" | "chevron" | "close" | "check" | "book" | "send";

export function Icon({ name, className = "", ...props }: { name: IconName } & ComponentProps<"svg">) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<IconName, React.ReactNode> = {
    jury: <><rect x="3" y="3" width="18" height="14" rx="2" {...common} /><path d="M7 21v-2.5a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3V21M9 8h.01M12 8h.01M15 8h.01" {...common} /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" {...common} /></>,
    lens: <><circle cx="10.5" cy="10.5" r="5.5" {...common} /><path d="m15 15 4 4" {...common} /></>,
    spark: <><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" {...common} /><path d="m18 16 .6 2.1L21 19l-2.4.8L18 22l-.6-2.2L15 19l2.4-.9L18 16Z" {...common} /></>,
    shield: <><path d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z" {...common} /><path d="M9.5 12 11 13.5l3.5-3.5" {...common} /></>,
    person: <><circle cx="12" cy="8" r="3.3" {...common} /><path d="M5.5 21v-1.6A5.4 5.4 0 0 1 11 14h2a5.4 5.4 0 0 1 5.5 5.4V21" {...common} /></>,
    switch: <><path d="M7 7h11M15 3l4 4-4 4M17 17H6M9 13l-4 4 4 4" {...common} /></>,
    wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2V7.5Z" {...common} /><path d="M4 9h15M16 14h.01" {...common} /></>,
    terminal: <><path d="m5 7 4 4-4 4M11 17h8" {...common} /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="1" {...common} /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" {...common} /></>,
    chevron: <path d="m7 10 5 5 5-5" {...common} />,
    close: <path d="m6 6 12 12M18 6 6 18" {...common} />,
    check: <path d="m5 12 4.2 4L19 6" {...common} />,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" {...common} /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M8 7h8" {...common} /></>,
    send: <><path d="m21 3-8.5 18-2.5-7-7-2.5L21 3Z" {...common} /><path d="m10 14 4-4" {...common} /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>{paths[name]}</svg>;
}
