import { defineConfig, devices } from "@playwright/test";

const databaseUrl = "file:./playwright.sqlite";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false,
	workers: 1,
	timeout: 60_000,
	expect: {
		timeout: 15_000,
	},
	globalSetup: "./tests/e2e/global-setup.ts",
	outputDir: "output/playwright/test-results",
	reporter: [
		["list"],
		[
			"html",
			{
				open: "never",
				outputFolder: "output/playwright/html-report",
			},
		],
	],
	use: {
		baseURL: "http://127.0.0.1:3000",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
			},
		},
	],
	webServer: {
		command: "npm run dev",
		url: "http://127.0.0.1:3000",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		stdout: "pipe",
		stderr: "pipe",
		env: {
			...process.env,
			DATABASE_URL: databaseUrl,
		},
	},
});
