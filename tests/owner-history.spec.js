// Roadmap #7: work items remember who owned them, and when.
const { test, expect, seed, openApp, waitSaved, nav, card } = require("./helpers");

const ADA = { id: "m-ada", name: "Ada", active: true };
const BOB = { id: "m-bob", name: "Bob", active: true };

async function reassign(page, title, to) {
  await nav(page, "workitems");
  await page.locator("#wiRows tr", { hasText: title }).getByRole("button", { name: "Edit" }).click();
  await page.locator("#ff_managerId").selectOption(to);
  await page.locator("#formOk").click();
}

test("reassigning records the earlier owner in the queue, drawer and 1:1 summary", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
  await openApp(page, seed({
    managers: [ADA, BOB],
    // A pre-0.13 item with no ownerHistory: backfilled to Ada from its opened date.
    workItems: [{ id: "w-1", type: "escalation", title: "Sev2", managerId: "m-ada", status: "open", openedDate: "2026-09-01" }]
  }));
  await reassign(page, "Sev2", "m-bob");
  const row = page.locator("#wiRows tr", { hasText: "Sev2" });
  await expect(row.locator(".wi-proj")).toHaveText("previously Ada");
  await expect(row).toContainText("Bob");
  await nav(page, "board");
  await expect(card(page, "Ada").locator(".m-score")).toHaveText("score 0");
  await card(page, "Ada").click();
  await expect(page.locator("#drawerBody")).toContainText("Handed off (last 90 days)");
  await expect(page.locator("#drawerBody")).toContainText("Escalation: Sev2 → Bob (2026-10-19)");
});

test("reports count an item for everyone who carried it in the period", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
  await openApp(page, seed({
    managers: [ADA, BOB, { id: "m-old", name: "Cleo", active: false }],
    workItems: [
      // Ada Jul 1 – Aug 15, then Bob; done Sep 10.
      { id: "w-1", type: "oneoff", title: "Handoff", managerId: "m-bob", status: "done", archived: true, openedDate: "2026-07-01", completedDate: "2026-09-10",
        ownerHistory: [{ managerId: "m-ada", from: "2026-07-01", to: "2026-08-15" }, { managerId: "m-bob", from: "2026-08-15", to: null }] },
      // Cleo (archived) carried this in July only, then it went to Ada.
      { id: "w-2", type: "ditl", title: "Old", managerId: "m-ada", status: "open", openedDate: "2026-07-05",
        ownerHistory: [{ managerId: "m-old", from: "2026-07-05", to: "2026-07-31" }, { managerId: "m-ada", from: "2026-07-31", to: null }] }
    ]
  }));
  await nav(page, "reports");
  const t = page.locator(".carried table");
  await expect(t.locator("thead th")).toHaveText(["Manager", "2026-07", "2026-08", "2026-09", "2026-10"]);
  await expect(t.locator("tr", { hasText: "Ada" }).locator("td.num")).toHaveText(["2", "2", "1", "1"]);
  await expect(t.locator("tr", { hasText: "Bob" }).locator("td.num")).toHaveText(["0", "1", "1", "0"]);
  await expect(t.locator("tr", { hasText: "Cleo (archived)" }).locator("td.num")).toHaveText(["1", "0", "0", "0"]);
  await page.locator("#repGran").selectOption("quarter");
  await expect(t.locator("thead th")).toHaveText(["Manager", "2026 Q1", "2026 Q2", "2026 Q3", "2026 Q4"]);
  await expect(t.locator("tr", { hasText: "Bob" }).locator("td.num")).toHaveText(["0", "0", "1", "0"]);
});

test("back to the Backlog and to someone else; history survives reload", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA, BOB],
    workItems: [{ id: "w-1", type: "oneoff", title: "Plan", managerId: "m-ada", status: "open", openedDate: "2020-01-01" }]
  }));
  await reassign(page, "Plan", "");
  await nav(page, "board");
  await expect(page.locator("#backlogPanel")).toContainText("Plan");
  await reassign(page, "Plan", "m-bob");
  await waitSaved(page);
  await page.reload();
  await nav(page, "workitems");
  await expect(page.locator("#wiRows tr", { hasText: "Plan" }).locator(".wi-proj")).toHaveText("previously Ada");
});

test("a manually archived item stops counting as carried on the day it was archived", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-20T12:00:00Z"));
  await openApp(page, seed({
    managers: [ADA],
    workItems: [{ id: "w-1", type: "oneoff", title: "Parked", managerId: "m-ada", status: "open", openedDate: "2026-07-01" }]
  }));
  await nav(page, "workitems");
  await page.locator("#wiRows tr", { hasText: "Parked" }).getByRole("button", { name: "Archive" }).click();
  await waitSaved(page);
  await page.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
  await page.reload();
  await nav(page, "reports");
  await expect(page.locator(".carried tr", { hasText: "Ada" }).locator("td.num")).toHaveText(["1", "0", "0", "0"]);
});

test("older archived rows are bounded by the change log, else their own dates", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
  const d = seed({
    managers: [ADA],
    workItems: [
      { id: "w-1", type: "oneoff", title: "Logged", managerId: "m-ada", status: "open", archived: true, openedDate: "2026-07-01" },
      { id: "w-2", type: "oneoff", title: "Unlogged", managerId: "m-ada", status: "open", archived: true, openedDate: "2026-07-01", dueDate: "2026-08-05" }
    ]
  });
  d.changes = [{ id: "c1", at: "2026-09-10T12:00:00.000Z", by: "Old", entity: "workItems", entityId: "w-1", label: "Logged", field: "archived", from: "false", to: "true" }];
  await openApp(page, d);
  await nav(page, "reports");
  await expect(page.locator(".carried tr", { hasText: "Ada" }).locator("td.num")).toHaveText(["2", "2", "1", "0"]);
});

test("an older client's silent reassignment is repaired on load", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA, BOB],
    workItems: [{ id: "w-1", type: "oneoff", title: "Plan", managerId: "m-bob", status: "open", openedDate: "2020-01-01",
                  ownerHistory: [{ managerId: "m-ada", from: "2020-01-01", to: null }] }]
  }));
  await nav(page, "workitems");
  await expect(page.locator("#wiRows tr", { hasText: "Plan" }).locator(".wi-proj")).toHaveText("previously Ada");
});
