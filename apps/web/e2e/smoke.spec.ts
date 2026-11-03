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
  await expect(page.getByTestId("scenario-list").locator("li")).toHaveCount(6);
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
