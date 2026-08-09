const { defineConfig } = require("@playwright/test");

// Dedicated test port: 4177 may be occupied by another workspace's dev server.
const TEST_PORT = 4517;

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: { baseURL: `http://127.0.0.1:${TEST_PORT}` },
  webServer: {
    command: "node server.js",
    env: { PORT: String(TEST_PORT) },
    port: TEST_PORT,
    reuseExistingServer: false
  }
});
