import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = "file:./playwright.sqlite";
const currentFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(currentFilePath);
const repoRoot = path.resolve(testsDir, "../..");
const testDatabasePath = path.join(repoRoot, "prisma", "playwright.sqlite");

async function removeFile(filePath: string) {
	await rm(filePath, { force: true });
}

export default async function globalSetup() {
	await Promise.all([
		removeFile(testDatabasePath),
		removeFile(`${testDatabasePath}-journal`),
		removeFile(`${testDatabasePath}-shm`),
		removeFile(`${testDatabasePath}-wal`),
	]);

	const result = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
		cwd: repoRoot,
		encoding: "utf8",
		env: {
			...process.env,
			DATABASE_URL: databaseUrl,
			SKIP_ENV_VALIDATION: "1",
		},
	});

	if (result.status === 0) {
		return;
	}

	throw new Error(
		[
			"Failed to prepare the Playwright SQLite database.",
			result.stdout,
			result.stderr,
		]
			.filter(Boolean)
			.join("\n"),
	);
}
