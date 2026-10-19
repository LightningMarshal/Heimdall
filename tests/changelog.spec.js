// Roadmap #6: append-only change log, union-merged across every copy.
const { test, expect, seed, openApp, waitSaved, nav } = require("./helpers");

const ADA = { id: "m-ada", name: "Ada", active: true };
const BOB = { id: "m-bob", name: "Bob", active: true };

test("edits are logged field by field, with ids resolved to names", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA, BOB],
    workItems: [{ id: "w-1", type: "oneoff", title: "Plan", managerId: "m-ada", status: "open" }]
  }));
  await nav(page, "workitems");
  await page.locator("#wiRows tr", { hasText: "Plan" }).getByRole("button", { name: "Edit" }).click();
  await page.locator("#ff_managerId").selectOption("m-bob");
  await page.locator("#ff_priority").selectOption("high");
  await page.locator("#formOk").click();
  await nav(page, "settings");
  const rows = page.locator("#changeLog tbody tr");
  await expect(rows).toHaveCount(2);
  const owner = rows.filter({ hasText: "managerId" });
  await expect(owner.locator("td")).toHaveText([/./, "Tester", "Work item: Plan", "managerId", "Ada", "Bob"]);
  await expect(rows.filter({ hasText: "priority" }).locator("td").nth(5)).toHaveText("high");

  await page.locator("#w_ditl").fill("5");
  await page.locator("#btnSaveSettings").click();
  await expect(rows.first().locator("td")).toHaveText([/./, "Tester", "Settings: Weighting", "weights.ditl", "2", "5"]);
  await expect(rows).toHaveCount(3);
  await waitSaved(page);
  await page.reload();
  await nav(page, "settings");
  await expect(page.locator("#changeLog tbody tr")).toHaveCount(3);
});

test("new records log once as added; sync saves and reloads log nothing", async ({ page }) => {
  await openApp(page, seed());
  await page.locator("#btnAddManager").click();
  await page.locator("#ff_name").fill("Cleo");
  await page.locator("#formOk").click();
  await waitSaved(page);
  await page.reload();
  await nav(page, "settings");
  await expect(page.locator("#changeLog tbody tr")).toHaveCount(1);
  await expect(page.locator("#changeLog tbody tr td").nth(2)).toHaveText("Manager: Cleo");
  await expect(page.locator("#changeLog tbody tr td").nth(3)).toHaveText("(added)");
});

test("a newer copy from another tab keeps both sides' log entries", async ({ page }) => {
  await openApp(page, seed({
    managers: [ADA],
    workItems: [{ id: "w-1", type: "oneoff", title: "Plan", managerId: "m-ada", status: "open" }]
  }));
  await nav(page, "workitems");
  await page.locator("#wiRows tr", { hasText: "Plan" }).getByRole("button", { name: "Archive" }).click();
  await waitSaved(page);
  // The other tab never saw our archive: its copy has the item unarchived, a
  // different edit, and its own log entry. It saves later, so it wins.
  await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open("heimdall", 1);
    req.onsuccess = () => {
      const tx = req.result.transaction("kv", "readwrite"), st = tx.objectStore("kv"), g = st.get("data");
      g.onsuccess = () => {
        const d = g.result;
        d.workItems[0].archived = false; d.workItems[0].title = "Plan v2";
        d.changes = [{ id: "other-1", at: new Date().toISOString(), by: "Other Tab", entity: "workItems", entityId: "w-1",
                       label: "Plan v2", field: "title", from: "Plan", to: "Plan v2" }];
        d.settings.lastSavedAt = new Date(Date.now() + 60000).toISOString();
        st.put(d, "data");
      };
      tx.oncomplete = () => { req.result.close(); resolve(); };
    };
  }));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("#wiRows")).toContainText("Plan v2");   // last write won the data…
  await nav(page, "settings");
  const rows = page.locator("#changeLog tbody tr");
  // …but our archive (archived + archivedDate) is still on record beside theirs.
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ hasText: "Other Tab" })).toContainText("Plan v2");
  const mine = rows.filter({ hasText: "Tester" }).locator("td:nth-child(4)");
  await expect(mine).toHaveCount(2);
  expect((await mine.allTextContents()).sort()).toEqual(["archived", "archivedDate"]);
});

test("the log keeps the newest 500 and downloads as CSV", async ({ page }) => {
  const changes = Array.from({ length: 520 }, (_, i) => ({
    id: "c" + i, at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), by: "Seed",
    entity: "managers", entityId: "m-ada", label: "Ada", field: "title", from: "t" + i, to: "t" + (i + 1)
  }));
  const d = seed({ managers: [ADA] }); d.changes = changes;
  await openApp(page, d);
  await nav(page, "settings");
  await expect(page.locator("#changeLog tbody tr")).toHaveCount(50);
  await page.locator("#changeLog").getByRole("button", { name: "Show all 500" }).click();
  await expect(page.locator("#changeLog tbody tr")).toHaveCount(500);
  await expect(page.locator("#changeLog tbody tr").last().locator("td").nth(4)).toHaveText("t20");
  const [dl] = await Promise.all([page.waitForEvent("download"),
    page.locator("#changeLog").getByRole("button", { name: "Download CSV" }).click()]);
  const text = require("fs").readFileSync(await dl.path(), "utf8");
  const lines = text.slice(1).trim().split("\r\n");
  expect(lines[0]).toBe("When (UTC),Who,Entity,Record,Field,From,To");
  expect(lines).toHaveLength(501);
});
