// Roadmap #2: per-manager capacity. The band follows score ÷ capacity; the card
// shows both numbers whenever capacity is not 100%.
const { test, expect, seed, openApp, waitSaved, nav, card } = require("./helpers");

const items = (owner, n) => Array.from({ length: n }, (_, i) =>
  ({ id: owner + "-w" + i, type: "ditl", title: "DITL " + i, managerId: owner, status: "open" }));

test("half capacity doubles the load that decides the band", async ({ page }) => {
  await openApp(page, seed({
    managers: [
      { id: "m-full", name: "Full Timer", active: true },                 // no capacity → 100%
      { id: "m-half", name: "Half Timer", active: true, capacity: 0.5 }
    ],
    workItems: items("m-full", 3).concat(items("m-half", 3))           // 3 × DITL 2 = 6 each
  }));
  const full = card(page, "Full Timer"), half = card(page, "Half Timer");
  await expect(full.locator(".heat")).toHaveText("Balanced");
  await expect(full.locator(".m-score")).toHaveText("score 6");
  await expect(full).not.toContainText("Capacity");
  await expect(half.locator(".heat")).toHaveText("Heavy");
  await expect(half.locator(".m-score")).toHaveText("score 12 · raw 6");
  await expect(half).toContainText("Capacity50%");
  await expect(half.locator(".heat")).toHaveAttribute("title", /this score: 12 \(6 raw at 50% capacity\)/);

  await half.click();
  await expect(page.locator("#drawerBody")).toContainText("score 12 (6 raw at 50% capacity)");
});

test("capacity is set in the manager form, validated, and persists", async ({ page }) => {
  await openApp(page, seed({
    managers: [{ id: "m-1", name: "Ada", active: true }],
    workItems: items("m-1", 3)
  }));
  await nav(page, "settings");
  const row = page.locator("#settingsManagers tr", { hasText: "Ada" });
  await expect(row).toContainText("100%");
  await row.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("#ff_capacityPct")).toHaveValue("100");
  await page.locator("#ff_capacityPct").fill("0");
  await page.locator("#formOk").click();
  await expect(page.locator("#notice")).toContainText("Capacity must be between 10 and 300%");
  await page.locator("#ff_capacityPct").fill("150");
  await page.locator("#formOk").click();
  await expect(row).toContainText("150%");
  await waitSaved(page);
  await page.reload();
  // 6 ÷ 1.5 = 4 → Light
  await expect(card(page, "Ada").locator(".heat")).toHaveText("Light");
  await expect(card(page, "Ada").locator(".m-score")).toHaveText("score 4 · raw 6");
});

test("unusable capacity in a hand-edited file falls back to full load", async ({ page }) => {
  await openApp(page, seed({
    managers: [
      { id: "m-1", name: "Zero", active: true, capacity: 0 },
      { id: "m-2", name: "Text", active: true, capacity: "0.5" },
      { id: "m-3", name: "Junk", active: true, capacity: "lots" }
    ],
    workItems: items("m-1", 1).concat(items("m-2", 1), items("m-3", 1))
  }));
  await expect(card(page, "Zero").locator(".m-score")).toHaveText("score 2");
  await expect(card(page, "Text").locator(".m-score")).toHaveText("score 4 · raw 2");
  await expect(card(page, "Junk").locator(".m-score")).toHaveText("score 2");
});

test("new managers default to 100% capacity", async ({ page }) => {
  await openApp(page, seed());
  await page.locator("#btnAddManager").click();
  await expect(page.locator("#ff_capacityPct")).toHaveValue("100");
  await page.locator("#ff_name").fill("Newbie");
  await page.locator("#formOk").click();
  await expect(card(page, "Newbie").locator(".m-score")).toHaveText("score 0");
});
