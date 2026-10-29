// Click-through smoke suite: board, projects, work items, needs attention,
// reports, and settings, each asserted on the rendered DOM.
const { test, expect, seed, openApp, waitSaved, nav, card } = require("./helpers");

const ADA = { id: "m-ada", name: "Ada Lovelace", title: "Eng Manager", location: "London", active: true };
const BOB = { id: "m-bob", name: "Bob Ross", title: "Eng Manager", location: "Remote", active: true };
const PROJ = { id: "p-1", name: "Apollo", status: "active", priority: "high", startDate: "2020-01-01" };

test("empty start: add a manager, asked for a name once, persists across reload", async ({ page }) => {
  await openApp(page, null, { name: null });
  await expect(page.locator("#boardCards")).toContainText("No managers yet");
  await page.locator("#btnAddManager").click();
  // First mutation asks for a name.
  await expect(page.locator("#nameOverlay")).toHaveClass(/show/);
  await page.locator("#nameInput").fill("Grace");
  await page.locator("#nameOk").click();
  await page.locator("#ff_name").fill("Ada Lovelace");
  await page.locator("#ff_title").fill("Eng Manager");
  await page.locator("#formOk").click();
  await expect(card(page, "Ada Lovelace")).toBeVisible();
  await expect(card(page, "Ada Lovelace").locator(".heat")).toHaveText("Light");
  await waitSaved(page);
  await expect(page.locator("#bannerText")).toContainText("Last saved by Grace");
  await page.reload();
  await expect(card(page, "Ada Lovelace")).toBeVisible();
});

test("cancelling the name prompt cancels the edit", async ({ page }) => {
  await openApp(page, null, { name: null });
  await page.locator("#btnAddManager").click();
  await page.locator("#nameCancel").click();
  await expect(page.locator("#formOverlay")).not.toHaveClass(/show/);
  await expect(page.locator("#boardCards")).toContainText("No managers yet");
});

test("weighted score and heat band on the board, fractional scores resolve downward", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA, BOB],
    projects: [PROJ],
    // Lead × Medium = 3 × 1.5 = 4.5 → Light (not the band above, not the top band).
    assignments: [{ id: "a-1", projectId: "p-1", managerId: "m-ada", role: "lead", effort: "medium", archived: false }],
    workItems: [
      { id: "w-1", type: "escalation", title: "Outage follow-up", managerId: "m-bob", status: "open", openedDate: "2020-01-01" },
      { id: "w-2", type: "ditl", title: "Shadow day", managerId: "m-bob", status: "in-progress", openedDate: "2020-01-01" },
      // Done items do not count.
      { id: "w-3", type: "escalation", title: "Old one", managerId: "m-bob", status: "done", archived: true, completedDate: "2020-01-02" }
    ]
  }));
  const ada = card(page, "Ada Lovelace");
  await expect(ada.locator(".heat")).toHaveText("Light");
  await expect(ada.locator(".m-score")).toHaveText("score 4.5");
  await expect(ada).toContainText("Leading1");
  const bob = card(page, "Bob Ross");
  await expect(bob.locator(".heat")).toHaveText("Balanced");      // 4 + 2 = 6
  await expect(bob.locator(".m-score")).toHaveText("score 6");
  await expect(bob.locator(".chip.alert")).toContainText("Escalations1");
});

test("manager drawer lists what they carry and opens the project from it", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA], projects: [PROJ],
    assignments: [{ id: "a-1", projectId: "p-1", managerId: "m-ada", role: "lead", effort: "heavy", archived: false }],
    workItems: [{ id: "w-1", type: "oneoff", title: "Write the RFC", managerId: "m-ada", status: "open", openedDate: "2020-01-01", relatedProjectId: "p-1" }]
  }));
  await card(page, "Ada Lovelace").click();
  const drawer = page.locator("#drawerBody");
  await expect(drawer).toContainText("Project: Apollo — Lead (Heavy)");
  await expect(drawer).toContainText("One-off: Write the RFC · Apollo [Open]");
  await drawer.getByRole("button", { name: "Done" }).click();
  await expect(drawer).toContainText("Recently completed");
  await expect(drawer.locator(".d-sec").nth(1)).toContainText("Write the RFC (done ");
  await drawer.getByRole("button", { name: /Project: Apollo/ }).click();
  await expect(page.locator("#view-projects")).toBeVisible();
  await expect(page.locator("#projectOverlay")).toHaveClass(/show/);
  await expect(page.locator("#pf_name")).toHaveValue("Apollo");
});

test("projects: add with a team, close out, reopen, archive and restore", async ({ page }) => {
  await openApp(page, seed({ managers: [ADA, BOB] }));
  await nav(page, "projects");
  await expect(page.locator("#projList")).toContainText("No projects yet");
  await page.locator("#btnAddProject").click();
  await page.locator("#pf_name").fill("Hermes");
  await page.locator("#projAddMember").click();
  await page.locator("#projTeam .trow select").nth(1).selectOption("lead");
  await page.locator("#projOk").click();
  const pc = page.locator(".pcard", { hasText: "Hermes" });
  await expect(pc).toContainText("Ada Lovelace · Lead · Medium");

  await expect(page.locator("#projScopeWrap")).toBeHidden();
  await pc.getByRole("button", { name: "Close out" }).click();
  await page.locator("#formOk").click();
  // A closed-out project leaves the default list; Show: Closed out pulls it up.
  await expect(pc).toHaveCount(0);
  await expect(page.locator("#projList")).toContainText("No current projects");
  await page.locator("#projScope").selectOption("closed");
  await expect(pc).toContainText("Complete");
  await nav(page, "board");
  await expect(card(page, "Ada Lovelace").locator(".m-score")).toHaveText("score 0");

  await nav(page, "projects");
  await pc.getByRole("button", { name: "Reopen" }).click();
  // Nothing is hidden any more, so the list is back to current projects.
  await expect(page.locator("#projScopeWrap")).toBeHidden();
  await expect(pc.locator(".pill.status").first()).toHaveText("Active");

  page.once("dialog", (d) => d.accept());
  await pc.getByRole("button", { name: "Archive" }).click();
  await expect(page.locator("#projList")).toContainText("No current projects");
  await page.locator("#projScope").selectOption("archived");
  await page.locator(".pcard", { hasText: "Hermes" }).getByRole("button", { name: "Restore" }).click();
  await expect(page.locator(".pcard", { hasText: "Hermes" })).not.toHaveClass(/archived/);
});

test("projects: only current projects are listed until Show asks for more (#11)", async ({ page }) => {
  await openApp(page, seed({ projects: [
    PROJ,
    { id: "p-2", name: "Gemini", status: "on-hold", priority: "med" },
    { id: "p-3", name: "Mercury", status: "complete", priority: "med", completedDate: "2020-06-01" },
    { id: "p-4", name: "Skylab", status: "active", priority: "low", archived: true },
    { id: "p-5", name: "Vostok", status: "complete", priority: "low", archived: true }
  ] }));
  await nav(page, "projects");
  const names = page.locator("#projList .p-name");
  await expect(page.locator("#projCount")).toHaveText("(2 current · 1 closed out · 2 archived)");
  await expect(page.locator("#projScope")).toHaveValue("current");
  await expect(names).toHaveText(["Apollo", "Gemini"]);
  await page.locator("#projScope").selectOption("closed");
  await expect(names).toHaveText(["Mercury"]);
  await page.locator("#projScope").selectOption("archived");
  // Archived wins over status: an archived closed-out project is listed as archived.
  await expect(names).toHaveText(["Skylab", "Vostok"]);
  await page.locator("#projScope").selectOption("all");
  await expect(names).toHaveText(["Apollo", "Gemini", "Mercury", "Skylab", "Vostok"]);
});

test("work items: add, filter, mark done into History, restore", async ({ page }) => {
  await openApp(page, seed({ managers: [ADA, BOB] }));
  await nav(page, "workitems");
  await page.locator("#btnAddWorkItem").click();
  await page.locator("#ff_type").selectOption("other");
  // "Other" asks what kind of work it is, and that label replaces "Other".
  await expect(page.locator("#ff_typeOther")).toBeVisible();
  await page.locator("#ff_typeOther").fill("Vendor audit");
  await page.locator("#ff_title").fill("Audit Acme");
  await page.locator("#ff_managerId").selectOption("m-bob");
  await page.locator("#formOk").click();
  const row = page.locator("#wiRows tr", { hasText: "Audit Acme" });
  await expect(row.locator(".pill")).toHaveText("Vendor audit");
  await expect(row).toContainText("Bob Ross");

  await page.locator("#fManager").selectOption("m-ada");
  await expect(page.locator("#wiRows")).toContainText("No work items match the filters.");
  await page.locator("#fClear").click();

  await row.getByRole("button", { name: "Done" }).click();
  await expect(page.locator("#wiRows")).not.toContainText("Audit Acme");
  await page.locator("#fScope").selectOption("history");
  const hist = page.locator("#wiRows tr", { hasText: "Audit Acme" });
  await expect(hist).toContainText("Done");
  await hist.getByRole("button", { name: "Restore" }).click();
  await page.locator("#fScope").selectOption("active");
  await expect(page.locator("#wiRows")).toContainText("Audit Acme");
});

test("backlog shows unassigned work and Assign… opens it", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA],
    workItems: [{ id: "w-1", type: "ditl", title: "Unowned DITL", managerId: null, status: "open", openedDate: "2020-01-01" }]
  }));
  const bl = page.locator("#backlogPanel");
  await expect(bl).toContainText("Backlog — unassigned work (1)");
  await bl.getByRole("button", { name: "Assign…" }).click();
  await page.locator("#ff_managerId").selectOption("m-ada");
  await page.locator("#formOk").click();
  await expect(bl).toBeEmpty();
  await expect(card(page, "Ada Lovelace")).toContainText("DITL1");
});

test("needs attention: roll-off, overdue, orphaned owner, past-target project", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA, Object.assign({}, BOB, { active: false })],
    projects: [Object.assign({}, PROJ, { targetDate: "2020-06-01" })],
    workItems: [
      { id: "w-1", type: "oneoff", title: "Rolled", managerId: "m-ada", status: "open", openedDate: "2020-01-01", rollOffDate: "2020-02-01" },
      { id: "w-2", type: "oneoff", title: "Late", managerId: "m-ada", status: "open", openedDate: "2020-01-01", dueDate: "2020-02-01" },
      { id: "w-3", type: "oneoff", title: "Orphan", managerId: "m-bob", status: "open", openedDate: "2020-01-01" }
    ]
  }));
  await expect(page.locator("#attnChip")).toHaveText("⚠ Needs attention (4)");
  await page.locator("#attnChip").click();
  const list = page.locator("#attnList");
  await expect(list).toContainText("Past roll-off 2020-02-01");
  await expect(list).toContainText("Overdue (due 2020-02-01)");
  await expect(list).toContainText("Owner archived");
  await expect(list).toContainText("Past target 2020-06-01");
  await page.locator("#attnArchiveAll").click();
  await expect(list).not.toContainText("Rolled");
  await expect(page.locator("#attnChip")).toHaveText("⚠ Needs attention (3)");
});

test("reports bucket work items by period and type", async ({ page }) => {
  await openApp(page, seed({
    workItems: [
      { id: "w-1", type: "escalation", title: "a", status: "open", openedDate: "2026-01-15" },
      { id: "w-2", type: "ditl", title: "b", status: "done", openedDate: "2026-01-20" },
      { id: "w-3", type: "oneoff", title: "c", status: "open", openedDate: "2026-04-02" }
    ]
  }));
  await nav(page, "reports");
  await expect(page.locator("#reportBody .stat").first()).toContainText("3");
  await expect(page.locator(".bucket", { hasText: "2026-01" }).locator(".n")).toHaveText("2");
  await page.locator("#repGran").selectOption("quarter");
  await expect(page.locator(".bucket", { hasText: "2026 Q2" }).locator(".n")).toHaveText("1");
});

test("settings: changing a weight re-scores the board and survives reload", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA],
    workItems: [{ id: "w-1", type: "escalation", title: "x", managerId: "m-ada", status: "open", openedDate: "2020-01-01" }]
  }));
  await expect(card(page, "Ada Lovelace").locator(".m-score")).toHaveText("score 4");
  await nav(page, "settings");
  await page.locator("#w_escalation").fill("10");
  await page.locator("#btnSaveSettings").click();
  await waitSaved(page);
  await page.reload();
  await expect(card(page, "Ada Lovelace").locator(".m-score")).toHaveText("score 10");
  await expect(card(page, "Ada Lovelace").locator(".heat")).toHaveText("Heavy");
});

test("hand-edited data is coerced: string weights add, not concatenate", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA],
    workItems: [
      { id: "w-1", type: "escalation", title: "x", managerId: "m-ada", status: "open" },
      { id: "w-2", type: "ditl", title: "y", managerId: "m-ada", status: "open" }
    ],
    settings: { weights: { escalation: "4", ditl: "2" } }
  }));
  await expect(card(page, "Ada Lovelace").locator(".m-score")).toHaveText("score 6");
});

test("search jumps to a work item", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA],
    workItems: [{ id: "w-1", type: "oneoff", title: "Quarterly audit", managerId: "m-ada", status: "open" }]
  }));
  await page.locator("#searchInput").fill("quarterly");
  await page.locator("#searchPop .sr-item", { hasText: "Quarterly audit" }).click();
  await expect(page.locator("#view-workitems")).toBeVisible();
  await expect(page.locator("#ff_title")).toHaveValue("Quarterly audit");
});
