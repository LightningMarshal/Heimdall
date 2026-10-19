// Roadmap #4: CSV download from Reports — every period at the chosen grouping.
const fs = require("fs");
const { test, expect, seed, openApp, nav } = require("./helpers");

async function downloadCsv(page) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.locator("#btnReportCsv").click()]);
  return { name: dl.suggestedFilename(), text: fs.readFileSync(await dl.path(), "utf8") };
}

test("CSV has a BOM, CRLF rows, oldest period first, and no-date items last", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-05-04T12:00:00Z"));
  await openApp(page, seed({
    workItems: [
      { id: "w-1", type: "escalation", title: "a", status: "open", openedDate: "2026-04-02" },
      { id: "w-2", type: "ditl", title: "b", status: "done", openedDate: "2026-01-20" },
      { id: "w-3", type: "escalation", title: "c", status: "open", openedDate: "2026-01-15" },
      { id: "w-4", type: "other", typeOther: "Vendor audit", title: "d", status: "open", openedDate: "2026-04-30" },
      { id: "w-5", type: "oneoff", title: "e", status: "open" }
    ]
  }));
  await nav(page, "reports");
  await page.locator("#repGran").selectOption("month");
  const { name, text } = await downloadCsv(page);
  expect(name).toBe("heimdall-report-month-20260504.csv");
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text.slice(1).split("\r\n")).toEqual([
    "Period,Total,Escalation,DITL,One-off,Other",
    "2026-01,2,1,1,0,0",
    "2026-04,2,1,0,0,1",
    "(no date),1,0,0,1,0",
    ""
  ]);
});

test("CSV includes every period even when the chart shows only the latest 20", async ({ page }) => {
  const items = [];
  for (let m = 0; m < 30; m++) {
    const y = 2024 + Math.floor(m / 12), mo = String((m % 12) + 1).padStart(2, "0");
    items.push({ id: "w" + m, type: "oneoff", title: "t" + m, status: "open", openedDate: y + "-" + mo + "-10" });
  }
  await openApp(page, seed({ workItems: items }));
  await nav(page, "reports");
  await expect(page.locator(".bucket")).toHaveCount(20);
  await expect(page.locator("#reportBody")).toContainText("Showing the 20 most recent of 30 periods");
  const { text } = await downloadCsv(page);
  const rows = text.slice(1).trim().split("\r\n");
  expect(rows).toHaveLength(31);
  expect(rows[1]).toBe("2024-01,1,0,0,1,0");
  expect(rows[30]).toBe("2026-06,1,0,0,1,0");
});

test("CSV follows the grouping: quarterly and all time", async ({ page }) => {
  await openApp(page, seed({
    workItems: [
      { id: "w-1", type: "ditl", title: "a", status: "open", openedDate: "2025-12-31" },
      { id: "w-2", type: "ditl", title: "b", status: "open", openedDate: "2026-01-01" }
    ]
  }));
  await nav(page, "reports");
  await page.locator("#repGran").selectOption("quarter");
  let { text } = await downloadCsv(page);
  expect(text.slice(1).trim().split("\r\n").slice(1)).toEqual(["2025 Q4,1,0,1,0,0", "2026 Q1,1,0,1,0,0"]);
  await page.locator("#repGran").selectOption("all");
  ({ text } = await downloadCsv(page));
  expect(text.slice(1).trim().split("\r\n").slice(1)).toEqual(["All time,2,0,2,0,0"]);
});
