// Dev-time test harness for heimdall.html. The app itself has no dependencies;
// this drives the real file over file:// in Chromium, the way it is actually used.
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  timeout: 30000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    browserName: "chromium",
    headless: true,
    // Pinned date/time-zone checks set their own timezoneId per test.
    timezoneId: "UTC",
    locale: "en-US"
  }
});
