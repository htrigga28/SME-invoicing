import { defineConfig } from "@playwright/test";

// These browser checks use local API fixtures. They do not use a database.
export default defineConfig({
  testDir: ".",
  testMatch: "pr29-automation.spec.ts",
  outputDir: "../.kickoff/pr29-browser-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3119",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [375, 768, 1024, 1440].map((width) => ({
    name: `${width}px`,
    use: { viewport: { width, height: 900 } }
  })),
  webServer: {
    command: "pnpm --filter @sme-invoicing/web exec next dev --port 3119",
    url: "http://localhost:3119/login",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NEXT_PUBLIC_API_URL: "http://127.0.0.1:4199" },
    stdout: "pipe",
    stderr: "pipe"
  }
});
