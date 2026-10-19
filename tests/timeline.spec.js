// Roadmap #5: the "who frees up when" timeline. Projections never change the board.
const { test, expect, seed, openApp, nav, card } = require("./helpers");

const NOW = "2026-10-19T12:00:00Z";   // local date 2026-10-19 in UTC

function data() {
  return seed({
    managers: [
      { id: "m-ada", name: "Ada", active: true },
      { id: "m-bob", name: "Bob", active: true, capacity: 0.5 },
      { id: "m-old", name: "Gone", active: false }
    ],
    projects: [
      { id: "p-1", name: "Apollo", status: "active", targetDate: "2026-12-31" },
      { id: "p-2", name: "Hermes", status: "active" },
      { id: "p-x", name: "Archived", status: "active", archived: true }
    ],
    assignments: [
      // Ada: lead on Apollo until Nov 2 (explicit end) → 3 × 1.5 = 4.5
      { id: "a-1", projectId: "p-1", managerId: "m-ada", role: "lead", effort: "medium", endDate: "2026-11-02", archived: false },
      // Bob: contributor on Apollo with no end → falls back to the target date (Dec 31)
      { id: "a-2", projectId: "p-1", managerId: "m-bob", role: "contributor", effort: "light", archived: false },
      // Bob: contributor on Hermes, no end and no target → open-ended
      { id: "a-3", projectId: "p-2", managerId: "m-bob", role: "contributor", effort: "light", archived: false },
      // Archived project must not appear anywhere
      { id: "a-4", projectId: "p-x", managerId: "m-ada", role: "lead", effort: "heavy", endDate: "2026-11-10", archived: false }
    ],
    workItems: [
      // Ada: escalation past roll-off (left gutter), DITL rolling off in 5 weeks
      { id: "w-1", type: "escalation", title: "Sev1 cleanup", managerId: "m-ada", status: "open", rollOffDate: "2026-10-01" },
      { id: "w-2", type: "ditl", title: "Ride-along", managerId: "m-ada", status: "open", rollOffDate: "2026-11-23" },
      // Bob: one-off due well past the window (right gutter)
      { id: "w-3", type: "oneoff", title: "Annual plan", managerId: "m-bob", status: "open", dueDate: "2027-03-01" }
    ]
  });
}

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date(NOW)); });

test("lanes show markers, gutters, and projections; the board is unchanged", async ({ page }) => {
  await openApp(page, data());
  // Board first: Ada = 4.5 + 4 + 2 = 10.5 (past roll-off still counts), Bob = (1+1+1)/0.5 = 6.
  await expect(card(page, "Ada").locator(".m-score")).toHaveText("score 10.5");
  await nav(page, "timeline");
  const lanes = page.locator(".tl-lane");
  await expect(lanes).toHaveCount(2);            // archived manager has no lane
  const ada = lanes.filter({ hasText: "Ada" });
  await expect(ada.locator(".tl-mark")).toHaveCount(2);
  await expect(ada.locator(".tl-mark.project")).toHaveAttribute("title", "Apollo — Lead (Medium) — rolls off 2026-11-02 (in 14 days)");
  await expect(ada.locator(".tl-mark.ditl")).toHaveAttribute("title", /Ride-along — rolls off 2026-11-23 \(in 35 days\)/);
  await expect(ada.locator(".tl-gut.past")).toHaveText("1 past");
  // 2 wk (day 14): the lead role ending on day 14 still counts that day; the past
  // escalation is assumed gone → 4.5 + 2 = 6.5. 6 wk: 0. 12 wk: 0.
  await expect(ada.locator(".tl-now .m-score")).toHaveText("now 10.5");
  await expect(ada.locator(".tl-proj span")).toHaveText(["2 wk 6.5", "6 wk 0", "12 wk 0"]);
  await expect(page.locator("#tlBody")).not.toContainText("Archived");

  const bob = lanes.filter({ hasText: "Bob" });
  // Target-date fallback is a hollow marker.
  await expect(bob.locator(".tl-mark.project.target")).toHaveAttribute("title", /Apollo — Contributor \(Light\) — project target 2026-12-31/);
  await expect(bob.locator(".tl-gut.right")).toHaveText("1 later1 no date");
  // Bob (capacity 50%): open-ended Hermes 1 + Annual plan 1 + Apollo until Dec 31 (day 73) 1.
  await expect(bob.locator(".tl-proj span")).toHaveText(["2 wk 6", "6 wk 6", "12 wk 4"]);
});

test("sort by most room in 6 weeks, and markers click through", async ({ page }) => {
  const d = data();
  // Two open-ended escalations put Ada at 8 in six weeks, behind Bob's 6.
  d.workItems.push({ id: "w-8", type: "escalation", title: "Long A", managerId: "m-ada", status: "open" },
                   { id: "w-9", type: "escalation", title: "Long B", managerId: "m-ada", status: "open" });
  await openApp(page, d);
  await nav(page, "timeline");
  await expect(page.locator(".tl-lane .tl-who .lnk")).toHaveText(["Ada", "Bob"]);
  await page.locator("#tlSort").selectOption("room");
  await expect(page.locator(".tl-lane .tl-who .lnk")).toHaveText(["Bob", "Ada"]);
  await page.locator(".tl-lane", { hasText: "Bob" }).locator(".tl-mark").click();
  await expect(page.locator("#projectOverlay")).toHaveClass(/show/);
  await expect(page.locator("#pf_name")).toHaveValue("Apollo");
});

test("names open the drawer; empty state without managers", async ({ page }) => {
  await openApp(page, data());
  await nav(page, "timeline");
  await page.locator(".tl-lane .tl-who .lnk", { hasText: "Ada" }).click();
  await expect(page.locator("#drawerOverlay")).toHaveClass(/show/);
  await expect(page.locator("#drawerBody .d-name")).toHaveText("Ada");
  await page.keyboard.press("Escape");
  await openApp(page, seed());
  await nav(page, "timeline");
  await expect(page.locator("#tlBody")).toContainText("No active managers yet");
});
