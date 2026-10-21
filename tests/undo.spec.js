// Roadmap #3: undo the most recent archive action, from the notice bar or the
// Needs attention dialog, until the next change.
const { test, expect, seed, openApp, waitSaved, nav, card } = require("./helpers");

const ADA = { id: "m-ada", name: "Ada", active: true };
const undoBtn = (page) => page.locator("#notice").getByRole("button", { name: "Undo" });

test("archive all past roll-off can be undone from the dialog", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA],
    projects: [{ id: "p-1", name: "Apollo", status: "active" }],
    assignments: [{ id: "a-1", projectId: "p-1", managerId: "m-ada", role: "lead", effort: "light", endDate: "2020-03-01", archived: false }],
    workItems: [
      { id: "w-1", type: "oneoff", title: "Rolled A", managerId: "m-ada", status: "open", rollOffDate: "2020-02-01" },
      { id: "w-2", type: "oneoff", title: "Rolled B", managerId: "m-ada", status: "open", rollOffDate: "2020-02-01" }
    ]
  }));
  await expect(page.locator("#attnChip")).toHaveText("⚠ Needs attention (3)");
  await page.locator("#attnChip").click();
  await expect(page.locator("#attnUndo")).toBeHidden();
  await page.locator("#attnArchiveAll").click();
  await expect(page.locator("#attnList")).toContainText("Nothing needs attention");
  await expect(page.locator("#attnUndo")).toHaveText("Undo: archive 3 past roll-off");
  await page.locator("#attnUndo").click();
  await expect(page.locator("#attnList li")).toHaveCount(3);
  await expect(page.locator("#attnUndo")).toBeHidden();
  await page.locator("#attnClose").click();
  await expect(page.locator("#notice")).toContainText("Undone: archive 3 past roll-off.");
  await expect(card(page, "Ada")).toContainText("Leading1");
  await waitSaved(page);
  await page.reload();
  await expect(page.locator("#attnChip")).toHaveText("⚠ Needs attention (3)");
});

test("archiving a work item offers Undo on the notice bar", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA],
    workItems: [{ id: "w-1", type: "escalation", title: "Sev2", managerId: "m-ada", status: "open" }]
  }));
  await nav(page, "workitems");
  await page.locator("#wiRows tr", { hasText: "Sev2" }).getByRole("button", { name: "Archive" }).click();
  await expect(page.locator("#wiRows")).not.toContainText("Sev2");
  await undoBtn(page).click();
  await expect(page.locator("#wiRows tr", { hasText: "Sev2" })).toBeVisible();
  await expect(undoBtn(page)).toHaveCount(0);
});

test("mark done can be undone and the item returns to open", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA],
    workItems: [{ id: "w-1", type: "escalation", title: "Sev2", managerId: "m-ada", status: "in-progress" }]
  }));
  await card(page, "Ada").click();
  await page.locator("#drawerBody").getByRole("button", { name: "Done" }).click();
  await expect(page.locator("#drawerBody .d-sec").first()).not.toContainText("Sev2");
  await page.keyboard.press("Escape");
  await undoBtn(page).click();
  await expect(card(page, "Ada").locator(".m-score")).toHaveText("score 4");
  await nav(page, "workitems");
  await expect(page.locator("#wiRows tr", { hasText: "Sev2" })).toContainText("In progress");
});

test("archiving a project or a manager can be undone", async ({ page }) => {
  await openApp(page, seed({ managers: [ADA], projects: [{ id: "p-1", name: "Apollo", status: "active" }] }));
  await nav(page, "projects");
  page.on("dialog", (d) => d.accept());
  await page.locator(".pcard").getByRole("button", { name: "Archive" }).click();
  await expect(page.locator("#projList")).toContainText("No current projects");
  await undoBtn(page).click();
  await expect(page.locator(".pcard", { hasText: "Apollo" })).toBeVisible();

  await nav(page, "settings");
  await page.locator("#settingsManagers tr", { hasText: "Ada" }).getByRole("button", { name: "Archive" }).click();
  await expect(page.locator("#settingsManagers tr", { hasText: "Ada" })).toContainText("No");
  await undoBtn(page).click();
  await expect(page.locator("#settingsManagers tr", { hasText: "Ada" })).toContainText("Yes");
});

test("the next change ends the undo window", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA],
    workItems: [
      { id: "w-1", type: "oneoff", title: "Alpha", managerId: "m-ada", status: "open" },
      { id: "w-2", type: "oneoff", title: "Beta", managerId: "m-ada", status: "open" }
    ]
  }));
  await nav(page, "workitems");
  await page.locator("#wiRows tr", { hasText: "Alpha" }).getByRole("button", { name: "Archive" }).click();
  await expect(undoBtn(page)).toBeVisible();
  await page.locator("#wiRows tr", { hasText: "Beta" }).getByRole("button", { name: "Edit" }).click();
  await page.locator("#ff_title").fill("Beta edited");
  await page.locator("#formOk").click();
  await expect(undoBtn(page)).toHaveCount(0);
  await expect(page.locator("#wiRows")).not.toContainText("Alpha");
});

test("undo leaves alone a field changed again since", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA],
    workItems: [{ id: "w-1", type: "oneoff", title: "One", managerId: "m-ada", status: "open", rollOffDate: "2020-01-01" }]
  }));
  await page.locator("#attnChip").click();
  await page.locator("#attnList").getByRole("button", { name: "Archive" }).click();
  await waitSaved(page);   // a pending save of our own would win over the other tab
  // Another tab restores it before Undo is pressed: simulate by writing a newer
  // copy to IndexedDB and returning to the tab.
  await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open("heimdall", 1);
    req.onsuccess = () => {
      const tx = req.result.transaction("kv", "readwrite"), st = tx.objectStore("kv"), g = st.get("data");
      g.onsuccess = () => {
        const d = g.result; d.workItems[0].archived = false; d.workItems[0].title = "One (restored elsewhere)";
        d.settings.lastSavedAt = new Date(Date.now() + 60000).toISOString(); st.put(d, "data");
      };
      tx.oncomplete = () => { req.result.close(); resolve(); };
    };
  }));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("#notice")).toContainText("another Heimdall tab");
  await page.locator("#attnUndo").click();
  await page.locator("#attnClose").click();
  await expect(page.locator("#notice")).toContainText("1 change not undone — edited again since");
});
