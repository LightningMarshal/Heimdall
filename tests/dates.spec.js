// Plain YYYY-MM-DD dates have no time zone and have bitten this app twice
// (UTC parsing put reports, ages, and roll-off a day off). Each check here runs
// with the browser in a different zone, at a wall-clock time where the local
// date and the UTC date disagree.
const { test, expect, seed, openApp, nav } = require("./helpers");

const ZONES = [
  // zone, a UTC instant, and the local calendar date at that instant
  { tz: "UTC", at: "2026-03-10T12:00:00Z", today: "2026-03-10", yesterday: "2026-03-09" },
  // 23:30 on the 10th in New York is already the 11th in UTC.
  { tz: "America/New_York", at: "2026-03-11T03:30:00Z", today: "2026-03-10", yesterday: "2026-03-09" },
  // 08:00 on the 11th in Auckland is still the 10th in UTC.
  { tz: "Pacific/Auckland", at: "2026-03-10T19:00:00Z", today: "2026-03-11", yesterday: "2026-03-10" }
];

for (const z of ZONES) {
  test.describe(z.tz, () => {
    test.use({ timezoneId: z.tz });
    test.beforeEach(async ({ page }) => {
      // A UTC instant, so the test runner's own zone cannot leak in. Timers keep
      // running, so the save debounce still fires.
      await page.clock.setFixedTime(new Date(z.at));
    });

    test("new work item defaults to the local date and is 0 days old", async ({ page }) => {
      await openApp(page, seed({ managers: [{ id: "m-1", name: "Ada", active: true }] }));
      await nav(page, "workitems");
      await page.locator("#btnAddWorkItem").click();
      await expect(page.locator("#ff_openedDate")).toHaveValue(z.today);
      await page.locator("#ff_title").fill("Fresh");
      await page.locator("#formOk").click();
      const row = page.locator("#wiRows tr", { hasText: "Fresh" });
      await expect(row.locator("td.age")).toHaveText("0d");
      await expect(row).toContainText(z.today);
    });

    test("roll-off today is not flagged; roll-off yesterday is", async ({ page }) => {
      await openApp(page, seed({
        managers: [{ id: "m-1", name: "Ada", active: true }],
        workItems: [
          { id: "w-1", type: "oneoff", title: "Today", managerId: "m-1", status: "open", openedDate: z.yesterday, rollOffDate: z.today },
          { id: "w-2", type: "oneoff", title: "Yesterday", managerId: "m-1", status: "open", openedDate: z.yesterday, rollOffDate: z.yesterday }
        ]
      }));
      await expect(page.locator("#attnChip")).toHaveText("⚠ Needs attention (1)");
      await page.locator("#attnChip").click();
      await expect(page.locator("#attnList")).toContainText("Yesterday");
      await expect(page.locator("#attnList")).not.toContainText("One-off: Today —");
      await expect(page.locator("#attnList li")).toHaveCount(1);
    });

    test("an item opened on the 1st reports in that month, not the one before", async ({ page }) => {
      await openApp(page, seed({
        workItems: [{ id: "w-1", type: "oneoff", title: "First", status: "open", openedDate: "2026-03-01" }]
      }));
      await nav(page, "reports");
      await expect(page.locator(".bucket .lab")).toHaveText(["2026-03"]);
    });

    test("closing out a project defaults to the local date", async ({ page }) => {
      await openApp(page, seed({ projects: [{ id: "p-1", name: "Apollo", status: "active" }] }));
      await nav(page, "projects");
      await page.locator(".pcard").getByRole("button", { name: "Close out" }).click();
      await expect(page.locator("#ff_completedDate")).toHaveValue(z.today);
      await page.locator("#formOk").click();
      await expect(page.locator(".pcard")).toContainText("completed " + z.today);
    });
  });
}
