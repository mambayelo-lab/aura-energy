import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Chromium préinstallé de l'environnement de développement, s'il existe.
const chromium = process.env.PW_CHROMIUM ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

export default defineConfig({
  testDir: "./src/test/e2e",
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 3000",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromium ? { launchOptions: { executablePath: chromium } } : {}),
      },
    },
  ],
});
