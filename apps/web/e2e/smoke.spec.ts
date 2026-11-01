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
