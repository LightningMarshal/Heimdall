// Shared helpers for the Heimdall smoke suite.
//
// Everything here drives the real heimdall.html over file:// and asserts on what
// is rendered, never on the app's internals: the app is one IIFE with nothing
// exported, and the bugs worth catching are the ones a user sees.
const path = require("path");
const { pathToFileURL } = require("url");
const base = require("@playwright/test");

const APP_URL = pathToFileURL(path.join(__dirname, "..", "heimdall.html")).href;

// Every test fails on an uncaught page error, so a render that throws half-way
// can't pass by accident because the assertion happened to look elsewhere.
const test = base.test.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await use(page);
    base.expect(errors, "uncaught errors in the page").toEqual([]);
  }
});

// A minimal valid data file. Pass the arrays you need; settings take the app's
// defaults (validate() fills anything missing).
function seed(parts) {
  parts = parts || {};
  return {
    managers: parts.managers || [],
    projects: parts.projects || [],
    assignments: parts.assignments || [],
    workItems: parts.workItems || [],
    settings: Object.assign({ lastSavedBy: "Seed", lastSavedAt: "2020-01-01T00:00:00.000Z" }, parts.settings || {})
  };
}

function waitReady(page) {
  return page.waitForFunction(() => {
    const b = document.getElementById("bannerText");
    return b && b.textContent !== "Loading…";
  });
}

// Open the app, optionally with data already in IndexedDB (db "heimdall", store
// "kv", key "data"). The user's name is seeded too unless name is null, so the
// one-time name prompt doesn't block every mutation; tests of that prompt pass
// { name: null }.
async function openApp(page, data, opts) {
  opts = opts || {};
  const name = ("name" in opts) ? opts.name : "Tester";
  await page.goto(APP_URL);
  await waitReady(page);
  if (data || name) {
    await page.evaluate(({ data, name }) => new Promise((resolve, reject) => {
      const req = indexedDB.open("heimdall", 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result, tx = db.transaction("kv", "readwrite"), store = tx.objectStore("kv");
        if (data) store.put(data, "data");
        if (name) store.put(name, "name");
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    }), { data: data || null, name: name || null });
    await page.reload();
    await waitReady(page);
  }
}

// Wait for the debounced auto-save to land, so a reload sees it.
function waitSaved(page) {
  return base.expect(page.locator("#saveStatus")).toHaveText(/Saved/);
}

function nav(page, view) {
  return page.locator('#nav button[data-view="' + view + '"]').click();
}

// The board card for a manager, by name.
function card(page, name) {
  return page.locator(".mcard", { has: page.locator(".m-name", { hasText: name }) });
}

module.exports = { test, expect: base.expect, APP_URL, seed, openApp, waitSaved, nav, card };
