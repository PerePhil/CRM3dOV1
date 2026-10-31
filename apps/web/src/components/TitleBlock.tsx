/** OV-1 title block (SPEC §8.4): operation name, scenario, seed. */
export function TitleBlock(props: { operation: string; scenarioId: string; seed: number | null }) {
  return (
    <header className="flex items-stretch border-b border-rule bg-paper text-sm">
      <div className="border-r border-rule px-3 py-1.5">
        <div className="text-[10px] uppercase text-ink-muted">DoDAF OV-1 · High-Level Operational Concept</div>
        <h1 className="text-base font-bold tracking-wide">{props.operation}</h1>
      </div>
      <dl className="flex items-center gap-6 px-3 font-[family-name:var(--font-data)] text-xs">
        <div>
          <dt className="text-ink-muted">SCENARIO</dt>
          <dd>{props.scenarioId}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">SEED</dt>
          <dd>{props.seed ?? "—"}</dd>
        </div>
      </dl>
    </header>
  );
}
