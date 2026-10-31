import { expect, test } from "@playwright/test";

test("app boots into the OV-1 shell with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto("/");

  await expect(page.getByTestId("banner-top")).toHaveText(
    "UNCLASSIFIED // NOTIONAL — ACADEMIC USE",
  );
  await expect(page.getByTestId("banner-bottom")).toBeVisible();
  await expect(page.getByRole("heading", { name: "CONTESTED // OV-1" })).toBeVisible();
  await expect(page.getByTestId("scenario-list").locator("li")).toHaveCount(6);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("callout-N-UAV")).toBeVisible();
  await expect(page.getByTestId("legend")).toBeVisible();

  await page.screenshot({ path: "test-results/ov1-slide-view.png" });
  expect(errors).toEqual([]);
});
