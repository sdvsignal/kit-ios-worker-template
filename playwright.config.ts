import { defineConfig } from "@playwright/test";

// API-only e2e against a local `wrangler dev` (no browser needed).
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:8787" },
  webServer: {
    command:
      "npx wrangler d1 migrations apply DB --local && npx wrangler dev --port 8787 --ip 127.0.0.1 --var ALLOW_EVENT_READ:true --var ENV_NAME:e2e",
    url: "http://127.0.0.1:8787/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
