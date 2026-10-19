// Roadmap #9: a daily score snapshot per manager, a sparkline on the card, and a
// "Heavy since …" trend in the drawer and 1:1 summary.
const { test, expect, seed, openApp, waitSaved, card } = require("./helpers");

const items = (owner, n, type) => Array.from({ length: n }, (_, i) =>
  ({ id: owner + type + i, type: type || "escalation", title: "Item " + i, managerId: owner, status: "open" }));

test("history drives the sparkline and the band-since line", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
  await openApp(page, seed({
    managers: [{ id: "m-1", name: "Ada", active: true, scoreHistory: [
      { d: "2026-06-01", s: 4, c: 1 },     // Light
      { d: "2026-07-20", s: 12, c: 1 },    // Heavy from here on…
      { d: "2026-09-01", s: 13, c: 1 }     // …still Heavy
    ] }, { id: "m-2", name: "Bob", active: true }],
    workItems: items("m-1", 3)            // live score today: 12 → Heavy
  }));
  const ada = card(page, "Ada");
  await expect(ada.locator(".m-trend svg.spark polyline")).toHaveCount(1);
  await expect(ada.locator(".m-trend")).toHaveAttribute("title", "Heavy since 2026-07-20 (91 days)");
  await expect(card(page, "Bob").locator(".m-trend")).toHaveCount(0);   // no history yet
  await ada.click();
  await expect(page.locator("#drawerBody .d-trend svg.trend rect")).toHaveCount(4);
  await expect(page.locator("#drawerBody .d-trend-lab")).toContainText("Heavy since 2026-07-20 (91 days)");
  await page.keyboard.press("Escape");
  await card(page, "Bob").click();
  await expect(page.locator("#drawerBody .d-trend")).toContainText("builds up from today");
});

test("saves write one snapshot per day, and a later day shows the trend", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-01T12:00:00Z"));
  await openApp(page, seed({ managers: [{ id: "m-1", name: "Ada", active: true }] }));
  // Day 1: two edits; the second (escalation → 4, Light) is the day's snapshot.
  await card(page, "Ada").click();
  for (let i = 0; i < 2; i++) {
    await page.locator("#drawerBody").getByRole("button", { name: "+ Work item" }).click();
    await page.locator("#ff_title").fill("Esc " + i);
    await page.locator("#formOk").click();
    await waitSaved(page);
  }
  await page.keyboard.press("Escape");
  await expect(card(page, "Ada").locator(".heat")).toHaveText("Balanced");     // 8
  await expect(card(page, "Ada").locator(".m-trend")).toHaveCount(0);          // only today so far

  // Day 11: reload; history from day 1 now shows.
  await page.clock.setFixedTime(new Date("2026-10-11T12:00:00Z"));
  await page.reload();
  await expect(card(page, "Ada").locator(".m-trend")).toHaveAttribute("title", "Balanced since records began, 2026-10-01 (10 days)");
});

test("a capacity change doesn't rewrite the past", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
  await openApp(page, seed({
    managers: [{ id: "m-1", name: "Ada", active: true, capacity: 0.5, scoreHistory: [
      { d: "2026-09-01", s: 6, c: 1 }      // 6 at full capacity then: Balanced
    ] }],
    workItems: items("m-1", 1, "ditl").concat(items("m-1", 1, "oneoff"))   // 3 now, ÷ 0.5 = 6: Balanced
  }));
  await expect(card(page, "Ada").locator(".m-trend")).toHaveAttribute("title", "Balanced since records began, 2026-09-01 (48 days)");
});
