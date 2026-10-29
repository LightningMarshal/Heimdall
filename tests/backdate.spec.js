// Issue #13: work logged with an earlier date shows in the trend (and the reports)
// from that date, not from the day it was typed in. And the card's sparkline is
// twice the height it was.
const { test, expect, seed, openApp, waitSaved, nav, card } = require("./helpers");

const TODAY = new Date("2026-10-29T12:00:00Z");
const trendTitle = (page, name) => card(page, name).locator(".m-trend");

test("a backdated work item changes the recorded trend from its opened date", async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await openApp(page, seed({
    managers: [{ id: "m-ada", name: "Ada", active: true, scoreHistory: [{ d: "2026-09-01", s: 2, c: 1 }] }],
    workItems: [{ id: "w-1", type: "ditl", title: "Old DITL", managerId: "m-ada", status: "open", openedDate: "2026-09-01" }]
  }));
  await expect(trendTitle(page, "Ada")).toHaveAttribute("title", "Light since records began, 2026-09-01 (58 days)");
  await card(page, "Ada").click();
  await page.locator("#drawerBody").getByRole("button", { name: "+ Work item" }).click();
  await page.locator("#ff_title").fill("Escalation found late");
  await page.locator("#ff_openedDate").fill("2026-10-10");
  await page.locator("#formOk").click();
  await page.keyboard.press("Escape");
  // 2 + 4 = 6 since Oct 10, not just since today.
  await expect(trendTitle(page, "Ada")).toHaveAttribute("title", "Balanced since 2026-10-10 (19 days)");
  await waitSaved(page);
  await page.reload();
  await expect(trendTitle(page, "Ada")).toHaveAttribute("title", "Balanced since 2026-10-10 (19 days)");
});

test("before any snapshot, the trend is estimated from the dates", async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await openApp(page, seed({
    managers: [{ id: "m-bob", name: "Bob", active: true }],
    workItems: [
      { id: "w-1", type: "escalation", title: "E", managerId: "m-bob", status: "open", openedDate: "2026-10-01" },
      { id: "w-2", type: "ditl", title: "D", managerId: "m-bob", status: "open", openedDate: "2026-10-15" }
    ]
  }));
  await expect(trendTitle(page, "Bob")).toHaveAttribute("title", "Balanced since 2026-10-15 (14 days)");
  await card(page, "Bob").click();
  await expect(page.locator("#drawerBody .d-trend svg.trend polyline")).toHaveCount(1);
});

test("a backdated close-out takes the project off the past; an effort change doesn't rewrite it", async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await openApp(page, seed({
    managers: [{ id: "m-ada", name: "Ada", active: true, scoreHistory: [{ d: "2026-09-01", s: 6, c: 1 }] }],
    projects: [{ id: "p-1", name: "Apollo", status: "active", priority: "med", startDate: "2026-09-01" }],
    assignments: [{ id: "a-1", projectId: "p-1", managerId: "m-ada", role: "lead", effort: "heavy", startDate: "2026-09-01", archived: false }]
  }));
  await expect(trendTitle(page, "Ada")).toHaveAttribute("title", "Balanced since records began, 2026-09-01 (58 days)");

  // Effort heavy → light: 3 today, but the past stays as recorded.
  await nav(page, "projects");
  await page.locator(".pcard", { hasText: "Apollo" }).getByRole("button", { name: "Edit" }).click();
  await page.locator("#projTeam .trow select").nth(2).selectOption("light");
  await page.locator("#projOk").click();
  await nav(page, "board");
  await expect(trendTitle(page, "Ada")).toHaveAttribute("title", "Light since today");

  // Closed out as of Oct 15: nothing counts from Oct 16.
  await nav(page, "projects");
  await page.locator(".pcard", { hasText: "Apollo" }).getByRole("button", { name: "Close out" }).click();
  await page.locator("#ff_completedDate").fill("2026-10-15");
  await page.locator("#formOk").click();
  await nav(page, "board");
  await expect(trendTitle(page, "Ada")).toHaveAttribute("title", "Light since 2026-10-16 (13 days)");
});

test("a new project's team starts with the project; the start is editable per person", async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await openApp(page, seed({
    managers: [{ id: "m-ada", name: "Ada", active: true, scoreHistory: [{ d: "2026-09-01", s: 0, c: 1 }] },
               { id: "m-bob", name: "Bob", active: true }]
  }));
  await nav(page, "projects");
  await page.locator("#btnAddProject").click();
  await page.locator("#pf_name").fill("Gemini");
  await page.locator("#pf_startDate").fill("2026-09-15");
  await page.locator("#projAddMember").click();
  await page.locator("#projTeam .trow select").nth(1).selectOption("lead");
  await page.locator("#projTeam .trow select").nth(2).selectOption("heavy");
  await page.locator("#projOk").click();
  await nav(page, "board");
  await expect(trendTitle(page, "Ada")).toHaveAttribute("title", "Balanced since 2026-09-15 (44 days)");

  // Bob joins later, backdated to Oct 1; a start in the future is refused.
  await nav(page, "projects");
  await page.locator(".pcard", { hasText: "Gemini" }).getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("#projTeam .trow").first().locator('input[type="date"]').first()).toHaveValue("2026-09-15");
  await page.locator("#projAddMember").click();
  const bobRow = page.locator("#projTeam .trow").nth(1);
  await bobRow.locator('input[type="date"]').first().fill("2026-11-02");
  await page.locator("#projOk").click();
  await expect(page.locator("#notice")).toContainText("can't be in the future");
  await bobRow.locator('input[type="date"]').first().fill("2026-10-01");
  await page.locator("#projOk").click();
  await nav(page, "board");
  // Contributor, medium: 1.5 — Light, and nothing of his before Oct 1.
  await expect(trendTitle(page, "Bob")).toHaveAttribute("title", "Light since records began, 2026-10-01 (28 days)");
});

test("moving a work item's opened date earlier moves it in the carried report", async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await openApp(page, seed({
    managers: [{ id: "m-ada", name: "Ada", active: true }],
    workItems: [{ id: "w-1", type: "oneoff", title: "Late entry", managerId: "m-ada", status: "open", openedDate: "2026-10-20" }]
  }));
  await nav(page, "reports");
  await page.locator("#repGran").selectOption("quarter");
  const ada = page.locator(".carried tr", { hasText: "Ada" }).locator("td.num");
  await expect(ada).toHaveText(["0", "0", "0", "1"]);
  await nav(page, "workitems");
  await page.locator("#wiRows tr", { hasText: "Late entry" }).getByRole("button", { name: "Edit" }).click();
  await page.locator("#ff_openedDate").fill("2026-07-01");
  await page.locator("#formOk").click();
  await nav(page, "reports");
  await expect(ada).toHaveText(["0", "0", "1", "1"]);
});

test("the card sparkline is twice its old height", async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await openApp(page, seed({ managers: [{ id: "m-ada", name: "Ada", active: true, scoreHistory: [{ d: "2026-09-01", s: 6, c: 1 }] }] }));
  const box = await card(page, "Ada").locator("svg.spark").boundingBox();
  expect(box.height).toBe(44);
});

test("saving a project leaves an old team member without a start date alone", async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await openApp(page, seed({
    managers: [{ id: "m-ada", name: "Ada", active: true, scoreHistory: [{ d: "2026-09-01", s: 6, c: 1 }] }],
    projects: [{ id: "p-1", name: "Apollo", status: "active", priority: "med", startDate: "2026-09-01" }],
    // From before assignments had start dates.
    assignments: [{ id: "a-1", projectId: "p-1", managerId: "m-ada", role: "lead", effort: "heavy", archived: false }]
  }));
  await nav(page, "projects");
  await page.locator(".pcard", { hasText: "Apollo" }).getByRole("button", { name: "Edit" }).click();
  await page.locator("#pf_description").fill("touched");
  await page.locator("#projOk").click();
  await nav(page, "board");
  await expect(trendTitle(page, "Ada")).toHaveAttribute("title", "Balanced since records began, 2026-09-01 (58 days)");
});
