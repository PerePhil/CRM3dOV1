/** Footer disclaimer shown on the public site. Keep this exact wording. */
export const DISCLAIMER_TEXT =
  "CMU Cyber Risk Modeling student project. Notional, public-source data only. Not affiliated with or endorsed by Boeing.";

export function Disclaimer() {
  return (
    <footer
      data-testid="disclaimer"
      className="bg-paper px-3 py-0.5 text-center text-xs text-ink-muted"
    >
      {DISCLAIMER_TEXT}
    </footer>
  );
}
