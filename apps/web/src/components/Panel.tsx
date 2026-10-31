import type { ReactNode } from "react";

/** Briefing-slide panel (SPEC §8.5): light, thin dark border, square corners, small bold header. */
export function Panel(props: { title: string; side: "left" | "right"; children: ReactNode }) {
  return (
    <aside
      aria-label={props.title}
      className={`min-h-0 overflow-auto bg-paper-alt p-2 ${props.side === "left" ? "border-r" : "border-l"} border-rule`}
    >
      <h2 className="mb-2 border-b border-rule pb-1 text-xs font-bold uppercase tracking-wider">
        {props.title}
      </h2>
      {props.children}
    </aside>
  );
}
