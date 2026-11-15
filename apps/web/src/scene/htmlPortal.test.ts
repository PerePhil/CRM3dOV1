import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The re-target bug (htmlPortal.ts) only shows up in dev builds, which the e2e suite doesn't
// run, so guard the cause directly: every drei <Html> in the scene pins its portal.
describe("scene <Html> elements", () => {
  const dir = __dirname;
  const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));

  it.each(files)("%s passes portal={useHtmlPortal()} to every <Html>", (file) => {
    const src = readFileSync(join(dir, file), "utf8");
    const tags = src.match(/<Html\b[^>]*>/g) ?? [];
    for (const tag of tags) expect(tag).toMatch(/\bportal=\{/);
  });
});
