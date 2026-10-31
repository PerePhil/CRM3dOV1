/**
 * Runtime access to tokens.css for code that can't use CSS classes (three.js materials, lines).
 * tokens.css stays the single source of truth; this only reads it.
 */
import type { Affiliation, Link } from "@ov1/catalog";

export type ColorToken =
  | `${Affiliation}`
  | `${Affiliation}-strong`
  | "sky-top"
  | "sky-bottom"
  | "ocean"
  | "land"
  | "outline"
  | "ink"
  | "paper"
  | "paper-alt"
  | `link-${string}`;

const cache = new Map<string, string>();

/** Resolve `--color-<token>` from :root. Throws if the token doesn't exist, so typos fail loudly. */
export function color(token: ColorToken): string {
  const hit = cache.get(token);
  if (hit) return hit;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-${token}`)
    .trim();
  if (!value) throw new Error(`theme: missing CSS token --color-${token} in tokens.css`);
  cache.set(token, value);
  return value;
}

/** Link-type color token for a catalog link, e.g. L-GCS-C2 → "link-gcs-c2". */
export const linkColorToken = (link: Pick<Link, "id">): ColorToken =>
  `link-${link.id.replace(/^L-/, "").toLowerCase()}`;
