import { expect, type Page, test } from "@playwright/test";

test.describe("Remit end-to-end flows", () => {
	test("onboards a student and keeps the dashboard as the primary workspace", async ({
		page,
	}) => {
		const studentName = uniqueStudentName("Landing");

		await page.goto("/");

		await expect(
			page.getByRole("heading", {
				name: "From any chain to final tuition payment in under a second",
			}),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "University View" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Toggle theme" }),
		).toBeVisible();

		await page.getByRole("link", { name: "Start Student Demo" }).click();
		await createStudent(page, studentName);

		await expect(page.getByText(studentName)).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Statements" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Deposit" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Add funds" }),
		).toBeVisible();
		await expect(page.getByText("USDC", { exact: true })).toBeVisible();
		await expect(page.getByText("EURC", { exact: true })).toBeVisible();
		await expect(page.getByText("JPYC", { exact: true })).toBeVisible();
		await expect(page.getByText("Swap into USDC")).toHaveCount(0);
		await expect(
			page.getByRole("heading", { name: "Deposit funds" }),
		).toHaveCount(0);

		await page.goto("/");
		await expect(page).toHaveURL(/\/dashboard$/);
		await expect(page.getByText(studentName)).toBeVisible();
	});

	test("runs the inline deposit workflow and refreshes the dashboard in place", async ({
		page,
	}) => {
		const studentName = uniqueStudentName("Deposit");

		await createStudentFromDemo(page, studentName);

		await page.getByRole("button", { name: "Deposit" }).click();
		await expect(
			page.getByRole("heading", { name: "Deposit funds" }),
		).toBeVisible();

		const panel = page.locator("aside");
		await panel.getByRole("button", { name: /Base/ }).click();
		await expect(panel.getByText("Chain")).toBeVisible();
		await panel.getByRole("button", { name: "EURC" }).click();
		await panel.locator('input[type="number"]').fill("5000");
		await panel.getByRole("button", { name: "Continue" }).click();
		await panel.getByRole("button", { name: "Deposit funds" }).click();

		await expect(panel.getByText("Approve on Base")).toBeVisible();
		await expect(
			panel.getByRole("heading", { name: "Funds arrived" }),
		).toBeVisible({ timeout: 35_000 });
		await expect(panel.getByText("5,000.00 EURC")).toBeVisible();

		await panel.getByRole("button", { name: "Close" }).click();
		await expect(page).toHaveURL(/\/dashboard$/);
		await expect(page.getByText("EURC", { exact: true })).toBeVisible();
		await expect(
			page.getByText("€5,000.00 EURC", { exact: true }),
		).toBeVisible();
		await expect(page.getByText("Deposit from Base")).toBeVisible();
		await expect(page.getByText("+$5,000.00")).toBeVisible();
	});

	test("credits a JPYC deposit into wallet balances", async ({ page }) => {
		const studentName = uniqueStudentName("JPYC");

		await createStudentFromDemo(page, studentName);
		await completeDeposit(page, {
			chainName: "Base",
			amount: "5000",
			currency: "JPYC",
		});

		await expect(page.getByText("¥5,000.00", { exact: true })).toBeVisible();
		await expect(page.getByText("Deposit from Base")).toBeVisible();
	});

	test("opens the deposit workflow inline when payment power is insufficient", async ({
		page,
	}) => {
		const studentName = uniqueStudentName("Shortfall");

		await createStudentFromDemo(page, studentName);
		await page.getByRole("button", { name: "Add funds" }).click();

		await expect(page).toHaveURL(/\/dashboard$/);
		await expect(
			page.getByRole("heading", { name: "Deposit funds" }),
		).toBeVisible();
	});

	test("pays the current balance inline and preserves automatic swaps", async ({
		page,
	}) => {
		const studentName = uniqueStudentName("Payments");

		await createStudentFromDemo(page, studentName);
		await completeDeposit(page, {
			chainName: "Solana",
			amount: "22500",
			currency: "EURC",
		});

		await page.getByRole("button", { name: "Pay $22,500.00" }).click();
		await expect(
			page.getByRole("heading", { name: "Pay Meridian University" }),
		).toBeVisible();

		const panel = page.locator("aside");
		await expect(panel.getByText("Convert EURC to USDC")).toBeVisible();
		await panel.getByRole("button", { name: "Continue" }).click();
		await panel.getByRole("button", { name: "Continue" }).click();
		await panel.getByRole("button", { name: "Pay balance" }).click();

		await expect(
			panel.getByRole("heading", { name: "Payment final" }),
		).toBeVisible({ timeout: 10_000 });

		await panel.getByRole("button", { name: "Close" }).click();
		await expect(page).toHaveURL(/\/dashboard$/);
		await expect(page.getByText("Paid")).toBeVisible();
		await expect(page.getByText("Current Balance Payment")).toBeVisible();

		await page.goto("/university");
		await expect(
			page.getByRole("heading", { name: "Meridian University" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Incoming payments" }),
		).toBeVisible();
		await expect(page.getByText(studentName)).toBeVisible();
	});

	test("replaces an inactive draft workflow when another CTA is pressed", async ({
		page,
	}) => {
		const studentName = uniqueStudentName("Switch");

		await createStudentFromDemo(page, studentName);
		await completeDeposit(page, {
			chainName: "Base",
			amount: "22500",
			currency: "USDC",
		});

		await page.getByRole("button", { name: "Deposit" }).click();
		const panel = page.locator("aside");
		await panel.getByRole("button", { name: /Base/ }).click();
		await expect(
			panel.getByRole("heading", { name: "Select currency" }),
		).toBeVisible();

		await page.getByRole("button", { name: "Pay $22,500.00" }).click();
		await expect(
			page.getByRole("heading", { name: "Pay Meridian University" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Deposit funds" }),
		).toHaveCount(0);
	});

	test("stacks the workflow beneath the dashboard summary on mobile without overflow", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const studentName = uniqueStudentName("Mobile");

		await createStudentFromDemo(page, studentName);
		await page.getByRole("button", { name: "Deposit" }).click();

		const summaryButtonBox = await page
			.getByRole("button", { name: "Deposit" })
			.first()
			.boundingBox();
		const workflowHeadingBox = await page
			.getByRole("heading", { name: "Deposit funds" })
			.boundingBox();

		expect(summaryButtonBox).not.toBeNull();
		expect(workflowHeadingBox).not.toBeNull();
		expect(
			(workflowHeadingBox?.y ?? 0) > (summaryButtonBox?.y ?? 0),
		).toBeTruthy();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBeTruthy();
	});
});

function uniqueStudentName(prefix: string) {
	return `${prefix} Student ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createStudentFromDemo(page: Page, studentName: string) {
	await page.goto("/demo");
	await createStudent(page, studentName);
}

async function createStudent(page: Page, studentName: string) {
	await expect(
		page.getByRole("heading", { name: "Create your Arc wallet" }),
	).toBeVisible();

	await page.getByLabel("Student name").fill(studentName);
	await page.getByRole("button", { name: "Create wallet" }).click();

	await expect(
		page.getByRole("heading", { name: "Wallet ready" }),
	).toBeVisible();
	await expect(page.getByText(/^0x[a-f0-9]{40}$/)).toBeVisible();
	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/dashboard$/);
	await expect(page.getByText(studentName)).toBeVisible();
}

async function completeDeposit(
	page: Page,
	options: { chainName: string; amount: string; currency: string },
) {
	await page.getByRole("button", { name: "Deposit" }).click();
	await expect(
		page.getByRole("heading", { name: "Deposit funds" }),
	).toBeVisible();

	const panel = page.locator("aside");
	await panel
		.getByRole("button", { name: new RegExp(options.chainName) })
		.click();
	await panel.getByRole("button", { name: options.currency }).click();
	await panel.locator('input[type="number"]').fill(options.amount);
	await panel.getByRole("button", { name: "Continue" }).click();
	await panel.getByRole("button", { name: "Deposit funds" }).click();
	await expect(
		panel.getByRole("heading", { name: "Funds arrived" }),
	).toBeVisible({ timeout: 35_000 });
	await panel.getByRole("button", { name: "Close" }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
}
