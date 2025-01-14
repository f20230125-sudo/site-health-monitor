import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const violations = async (page: import("@playwright/test").Page) =>
  (await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);

test("loads with one h1, six sections and no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await expect(page).toHaveTitle(/Site Health Monitor/);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toContainText("WordPress");
  for (const id of ["scores", "speed", "backlog", "platforms", "checks", "method"]) await expect(page.locator(`#${id}`)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("the score chart has a table with every listed page, and the backlog names fixes", async ({ page }) => {
  await page.goto("/");
  await page.locator("#scores").getByRole("button", { name: "Table", exact: true }).click();
  await expect(page.locator("#scores table tbody tr")).toHaveCount(12);
  await expect(page.locator("#backlog tbody tr").first()).toBeVisible();
  await expect(page.locator("#platforms")).toContainText("WordPress");
});

test("the workbook downloads", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.getByRole("link", { name: /Download the Excel workbook/ }).getAttribute("href");
  expect((await request.get(href!)).status()).toBe(200);
});

for (const scheme of ["light", "dark"] as const) {
  test(`axe finds no violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");
    expect(await violations(page)).toEqual([]);
  });
}

for (const width of [390, 320]) {
  test(`no sideways scroll at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
}
