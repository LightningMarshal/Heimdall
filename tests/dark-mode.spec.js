// Roadmap #13: dark mode — follows the system, can be forced from Settings, prints light.
const { test, expect, seed, openApp, nav } = require("./helpers");

const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const heatBg = (page) => page.locator(".mcard .heat").first().evaluate((e) => getComputedStyle(e).backgroundColor);
const LIGHT = "rgb(245, 246, 248)", DARK = "rgb(15, 17, 21)";

const data = () => seed({ managers: [{ id: "m-1", name: "Ada", active: true }] });

test("follows the system color scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openApp(page, data());
  expect(await bg(page)).toBe(DARK);
  expect(await heatBg(page)).toBe("rgb(22, 48, 31)");
  await page.emulateMedia({ colorScheme: "light" });
  expect(await bg(page)).toBe(LIGHT);
  expect(await heatBg(page)).toBe("rgb(231, 247, 238)");
});

test("Settings → Appearance overrides the system and persists in this browser", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openApp(page, data());
  await nav(page, "settings");
  await expect(page.locator("#themeSel")).toHaveValue("system");
  await page.locator("#themeSel").selectOption("dark");
  expect(await bg(page)).toBe(DARK);
  await page.reload();
  expect(await bg(page)).toBe(DARK);
  await nav(page, "settings");
  await expect(page.locator("#themeSel")).toHaveValue("dark");
  // Forced light wins over a dark system.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.locator("#themeSel").selectOption("light");
  expect(await bg(page)).toBe(LIGHT);
  await page.locator("#themeSel").selectOption("system");
  expect(await bg(page)).toBe(DARK);
});

test("printing is always light", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openApp(page, data());
  await page.emulateMedia({ media: "print", colorScheme: "dark" });
  expect(await bg(page)).toBe("rgb(255, 255, 255)");
  expect(await heatBg(page)).toBe("rgb(231, 247, 238)");
});
