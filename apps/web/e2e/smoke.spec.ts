import { expect, test } from "@playwright/test";

test("app boots into the OV-1 shell with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  // Catch CSP violations directly too, not only through the console message Chromium logs.
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(
        `CSP violation: ${e.violatedDirective} blocked ${e.blockedURI} at ${e.sourceFile}:${e.lineNumber}:${e.columnNumber} sample=${e.sample}`,
      );
    });
  });

  const response = await page.goto("/");

  // vite preview serves public/_headers (see vite.config.ts), so this is the production CSP.
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'none'");
  expect(csp).not.toContain("unsafe-eval");
  expect(csp).not.toContain("unsafe-inline");

  await expect(page.getByTestId("banner-top")).toHaveText(
    "UNCLASSIFIED // NOTIONAL — ACADEMIC USE",
  );
  await expect(page.getByTestId("banner-bottom")).toBeVisible();
  await expect(page.getByRole("heading", { name: "CONTESTED // OV-1" })).toBeVisible();
  await expect(page.getByTestId("scenario-list").locator(":scope > li")).toHaveCount(3);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("callout-N-UAV")).toBeVisible();
  await expect(page.getByTestId("legend")).toBeVisible();
  await expect(page.getByTestId("disclaimer")).toHaveText(
    "CMU Cyber Risk Modeling student project. Notional, public-source data only. Not affiliated with or endorsed by Boeing.",
  );

  await page.screenshot({ path: "test-results/ov1-slide-view.png" });
  expect(errors).toEqual([]);
});

test("idle timeline flies the UAV; pause freezes it; scrub seeks", async ({ page }) => {
  await page.goto("/");
  const uav = page.getByTestId("callout-N-UAV");
  await expect(uav).toBeVisible();
  await expect(page.getByTestId("callout-status-N-UAV")).toHaveText(/AWAITING TASKING/);

  const a = await uav.boundingBox();
  await page.waitForTimeout(1500);
  const b = await uav.boundingBox();
  expect(b).not.toEqual(a);

  const toggle = page.getByTestId("playback-toggle");
  await toggle.click();
  await expect(toggle).toHaveText("Play");
  const c = await uav.boundingBox();
  await page.waitForTimeout(800);
  expect(await uav.boundingBox()).toEqual(c);

  await page.getByTestId("playback-scrub").fill("14");
  await expect(page.getByTestId("playback-clock")).toContainText("T+00:14.0");
  await expect.poll(async () => uav.boundingBox()).not.toEqual(c);
});

test("refuel op: mission steps panel follows playback and seeks", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("mission-load-refuel-op").click();
  await expect(page.getByTestId("callout-N-RCV")).toBeVisible();
  await page.getByTestId("playback-toggle").click();
  await expect(page.getByTestId("playback-toggle")).toHaveText("Play");

  await page.getByTestId("mission-step-14").getByRole("button").click();
  await expect(page.getByTestId("mission-step-counter")).toHaveText("STEP 14 / 18");
  await expect(page.getByTestId("mission-step-14")).toHaveAttribute("aria-current", "step");
  await expect(page.getByTestId("mission-step-watch")).toContainText("Receiver Communication");
  await expect(page.getByTestId("callout-status-N-RCV")).toHaveText(/CONTACT/);

  await page.getByTestId("mission-step-next").click();
  await expect(page.getByTestId("mission-step-counter")).toHaveText("STEP 15 / 18");
  await page.screenshot({ path: "test-results/ov1-refuel-op.png" });
});

test("refuel op hides adversaries; an attack storyboard reveals one with a red step", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("mission-load-refuel-op").click();
  await expect(page.getByTestId("callout-N-RCV")).toBeVisible();
  await expect(page.getByTestId("callout-N-ADV-CYBER")).toHaveCount(0);
  await expect(page.getByTestId("callout-N-ADV-SPOOF")).toHaveCount(0);

  await page.getByTestId("scenario-variant-s2-malware").click();
  await page.getByTestId("playback-toggle").click();
  await expect(page.getByTestId("callout-N-ADV-CYBER")).toHaveCount(0);
  await page.getByTestId("mission-step-attack").getByRole("button").click();
  await expect(page.getByTestId("mission-step-counter")).toHaveText("ATTACK · AFTER STEP 14");
  await expect(page.getByTestId("mission-step-attack")).toHaveAttribute("aria-current", "step");
  await expect(page.getByTestId("callout-N-ADV-CYBER")).toBeVisible();
  await expect(page.getByTestId("callout-N-ADV-JAM")).toHaveCount(0);
  await page.screenshot({ path: "test-results/ov1-s2-malware-attack.png" });
});

test("presenter controls: camera track, text size, collapsible panel", async ({ page }) => {
  await page.goto("/");
  const uav = page.getByTestId("callout-N-UAV");
  await expect(uav).toBeVisible();

  // Text size scales the root font, so every rem-sized label grows.
  const before = await uav.boundingBox();
  await page.getByTestId("text-larger").click();
  await expect
    .poll(async () => (await uav.boundingBox())?.height ?? 0)
    .toBeGreaterThan(before?.height ?? 0);

  // Track mode: after the ease-in, the UAV callout sits near the middle of the viewport.
  await page.getByTestId("camera-track").click();
  await expect(page.getByTestId("camera-track")).toHaveAttribute("aria-pressed", "true");
  const canvas = await page.locator("canvas").boundingBox();
  await expect
    .poll(async () => {
      const b = await uav.boundingBox();
      if (!b || !canvas) return Number.POSITIVE_INFINITY;
      return Math.abs(b.x + b.width / 2 - (canvas.x + canvas.width / 2));
    })
    .toBeLessThan(80);
  await page.keyboard.press("r");
  await expect(page.getByTestId("camera-track")).toHaveAttribute("aria-pressed", "false");

  // Sections collapse; the panel hides and comes back.
  const steps = page.getByTestId("section-mission-steps").getByRole("button").first();
  await steps.click();
  await expect(steps).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("p");
  await expect(page.getByTestId("sidebar")).toHaveCount(0);
  await page.getByTestId("sidebar-toggle").click();
  await expect(page.getByTestId("sidebar")).toBeVisible();
});
