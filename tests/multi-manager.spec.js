// Issue #12: more than one manager on a work item. The owner stays the owner; the
// others are "also working on it", and each carries the item at its full weight.
const { test, expect, seed, openApp, waitSaved, nav, card } = require("./helpers");

const ADA = { id: "m-ada", name: "Ada Lovelace", active: true };
const BOB = { id: "m-bob", name: "Bob Ross", active: true };
const CY = { id: "m-cy", name: "Cy Twombly", active: true };

test("an item with two managers counts for both, and shows on both", async ({ page }) => {
  await openApp(page, seed({ managers: [ADA, BOB, CY] }));
  await nav(page, "workitems");
  await page.locator("#btnAddWorkItem").click();
  await page.locator("#ff_title").fill("Big outage");
  await page.locator("#ff_managerId").selectOption("m-ada");
  const others = page.locator("#ff_helpers");
  // The owner isn't offered as a helper too.
  await expect(others.getByLabel("Ada Lovelace")).toBeHidden();
  await others.getByLabel("Bob Ross").check();
  await page.locator("#formOk").click();

  const row = page.locator("#wiRows tr", { hasText: "Big outage" });
  await expect(row.locator("td").nth(2)).toHaveText("Ada Lovelace+ Bob Ross");
  await page.locator("#fManager").selectOption("m-bob");
  await expect(row).toBeVisible();
  await page.locator("#fManager").selectOption("m-cy");
  await expect(row).toHaveCount(0);
  await page.locator("#fClear").click();

  await nav(page, "board");
  await expect(card(page, "Ada Lovelace").locator(".m-score")).toHaveText("score 4");
  await expect(card(page, "Bob Ross").locator(".m-score")).toHaveText("score 4");
  await expect(card(page, "Bob Ross").locator(".chips")).toContainText("Escalations1");
  await card(page, "Bob Ross").click();
  await expect(page.locator("#drawerBody")).toContainText("Big outage (helping Ada Lovelace)");
  await page.keyboard.press("Escape");

  // Hand it to Bob: he is the owner now, and no longer listed as helping.
  await nav(page, "workitems");
  await row.getByRole("button", { name: "Edit" }).click();
  await expect(others.getByLabel("Bob Ross")).toBeChecked();
  await page.locator("#ff_managerId").selectOption("m-bob");
  await expect(others.getByLabel("Bob Ross")).toBeHidden();
  await others.getByLabel("Cy Twombly").check();
  await page.locator("#formOk").click();
  await expect(row.locator("td").nth(2)).toHaveText("Bob Ross+ Cy Twombly");
  await nav(page, "board");
  await expect(card(page, "Ada Lovelace").locator(".m-score")).toHaveText("score 0");
  await expect(card(page, "Bob Ross").locator(".m-score")).toHaveText("score 4");
  await expect(card(page, "Cy Twombly").locator(".m-score")).toHaveText("score 4");

  await waitSaved(page);
  await page.reload();
  await nav(page, "workitems");
  await expect(row.locator("td").nth(2)).toHaveText("Bob Ross+ Cy Twombly");
  await expect(row).toContainText("previously Ada Lovelace");
});

test("others on an item need an owner", async ({ page }) => {
  await openApp(page, seed({ managers: [ADA, BOB] }));
  await nav(page, "workitems");
  await page.locator("#btnAddWorkItem").click();
  await page.locator("#ff_title").fill("Orphan help");
  await page.locator("#ff_helpers").getByLabel("Bob Ross").check();
  await page.locator("#formOk").click();
  await expect(page.locator("#notice")).toContainText("Choose an owner before adding others");
  await expect(page.locator("#formOverlay")).toHaveClass(/show/);
});

test("reports count an item for everyone who helped on it in the period", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
  await openApp(page, seed({
    managers: [ADA, BOB],
    workItems: [{ id: "w-1", type: "escalation", title: "Joint", managerId: "m-ada", status: "open", openedDate: "2026-08-10",
      ownerHistory: [{ managerId: "m-ada", from: "2026-08-10", to: null }],
      // Bob helped through September only.
      helpers: [{ managerId: "m-bob", from: "2026-08-20", to: "2026-09-30" }] }]
  }));
  await nav(page, "reports");
  const t = page.locator(".carried table");
  await expect(t.locator("tr", { hasText: "Ada" }).locator("td.num")).toHaveText(["0", "1", "1", "1"]);
  await expect(t.locator("tr", { hasText: "Bob" }).locator("td.num")).toHaveText(["0", "1", "1", "0"]);
  // He's no longer on it, so it no longer counts on his card.
  await nav(page, "board");
  await expect(card(page, "Bob Ross").locator(".m-score")).toHaveText("score 0");
});
