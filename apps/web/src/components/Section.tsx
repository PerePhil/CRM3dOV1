import { type ReactNode, useState } from "react";

/**
 * Collapsible sidebar section (SPEC §8.5 briefing-slide panel): light, thin rule, square corners,
 * bold uppercase header. The header is a button so a presenter can fold away what the room
 * doesn't need to read. `aside` shows a one-line summary next to the title (e.g. the active step),
 * which stays visible when the section is collapsed.
 */
export function Section(props: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  aside?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? true);
  const id = `section-${props.title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section
      aria-label={props.title}
      data-testid={id}
      className={`border-b border-rule bg-paper-alt ${props.className ?? ""}`}
    >
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-paper focus-visible:outline-2 focus-visible:outline-friendly-strong"
        >
          <span aria-hidden className="w-3 text-xs text-ink-muted">
            {open ? "▾" : "▸"}
          </span>
          <span className="text-sm font-bold uppercase tracking-wider">{props.title}</span>
          {props.aside ? (
            <span className="ml-auto truncate text-sm text-ink-muted">{props.aside}</span>
          ) : null}
        </button>
      </h2>
      {open ? (
        <div id={`${id}-body`} className="px-3 pb-3">
          {props.children}
        </div>
      ) : null}
    </section>
  );
}
