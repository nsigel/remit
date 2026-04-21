import { expect, type Page, test } from "@playwright/test";

const DEFAULT_STUDENT_NAME = "Student";

test.describe("Remit demo session", () => {
	test("onboarding creates a student and persists the same-tab session across refresh", async ({
		page,
	}) => {
		const studentName = DEFAULT_STUDENT_NAME;

		await page.goto("/");
		await page.getByRole("link", { name: "Start Student Demo" }).click();
		await createStudent(page);
		await completeDeposit(page, {
			amount: "5000",
			chainName: "Base",
			currency: "USDC",
		});

		await expect(page).toHaveURL(/\/dashboard$/);
		await expect(page.getByText(studentName)).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Statements" }),
		).toBeVisible();
		await expect(page.getByText("Fall 2026 Tuition")).toBeVisible();
		await expect(page.getByText("Deposit from Base")).toBeVisible();

		await page.reload();

		await expect(page).toHaveURL(/\/dashboard$/);
		await expect(page.getByText(studentName)).toBeVisible();
		await expect(page.getByText("Deposit from Base")).toBeVisible();
		await expect(page.getByText("Fall 2026 Housing")).toBeVisible();

		await page.goto("/");
		await expect(page).toHaveURL(/\/dashboard$/);
	});

	test("deposit completion updates the dashboard and activity history", async ({
		page,
	}) => {
		await createStudentFromDemo(page);
		await completeDeposit(page, {
			amount: "5000",
			chainName: "Base",
			currency: "EURC",
		});

		await expect(page.getByText("Deposit from Base")).toBeVisible();
		await expect(page.getByText("Settled in USDC via StableFX")).toBeVisible();

		await page.goto("/dashboard/history");
		await expect(page).toHaveURL(/\/dashboard\/history$/);
		await expect(page.getByText("Deposit from Base")).toBeVisible();
		await expect(page.getByText("Settled in USDC via StableFX")).toBeVisible();
	});

	test("manual swap updates the available wallet route and history", async ({
		page,
	}) => {
		await createStudentFromDemo(page);
		await completeDeposit(page, {
			amount: "5000",
			chainName: "Base",
			currency: "EURC",
			keepOriginalCurrency: true,
		});

		await page.getByRole("button", { name: "Swap" }).click();
		const swapPanel = page.locator("aside");
		await expect(
			swapPanel.getByRole("heading", { name: "Swap funds" }),
		).toBeVisible();
		await swapPanel.getByRole("button", { name: "EURC" }).click();
		await swapPanel.locator('input[placeholder="0.00"]').fill("5000");
		await swapPanel.getByRole("button", { name: "Continue" }).click();
		await swapPanel.getByRole("button", { name: "Swap funds" }).click();
		await expect(swapPanel.getByText("Swap complete")).toBeVisible({
			timeout: 15_000,
		});
		await swapPanel.getByRole("button", { name: "Back to dashboard" }).click();

		await expect(page.getByText("Swap EURC to USDC")).toBeVisible();

		await page.getByRole("button", { name: "Swap" }).click();
		const emptySwapPanel = page.locator("aside");
		await expect(
			emptySwapPanel.getByRole("button", { name: "EURC" }),
		).toHaveCount(0);
		await emptySwapPanel.getByRole("button", { name: "Close" }).click();

		await page.goto("/dashboard/history");
		await expect(page.getByText("Swap EURC to USDC")).toBeVisible();
	});

	test("paying the current balance marks statements paid and surfaces the payment on the university view", async ({
		page,
	}) => {
		const studentName = DEFAULT_STUDENT_NAME;

		await createStudentFromDemo(page);
		await completeDeposit(page, {
			amount: "22500",
			chainName: "Base",
			currency: "EURC",
			keepOriginalCurrency: true,
		});

		await page.getByRole("button", { name: "Pay $22,500.00" }).click();
		await page.getByRole("button", { name: "Continue" }).click();
		await expect(page.getByText("Sending to USC")).toBeVisible();
		await page.getByRole("button", { name: "Confirm payment" }).click();
		await expect(
			page.getByRole("button", { name: "Back to dashboard" }),
		).toBeVisible();
		await page.getByRole("button", { name: "Back to dashboard" }).click();

		await expect(
			page.getByRole("heading", { name: "Statements" }),
		).toBeVisible();
		await expect(page.getByText("All paid")).toBeVisible();
		await expect(page.getByText("Current Balance Payment")).toBeVisible();

		await page.goto("/university");
		await expect(page.getByRole("heading", { name: "USC" })).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Incoming payments" }),
		).toBeVisible();
		await expect(page.getByText(studentName)).toBeVisible();
	});

	test("active payment plan banner advances installments and credits final interest", async ({
		page,
	}) => {
		await createStudentFromDemo(page);
		await completeDeposit(page, {
			amount: "22500",
			chainName: "Base",
			currency: "USDC",
		});

		await page.getByRole("button", { name: "Pay $22,500.00" }).click();
		await page.getByRole("button", { name: "Continue" }).click();
		await page
			.getByRole("button", { name: "Commit $22,500.00 to escrow" })
			.click();
		await expect(page.getByText("Payment plan escrow is live")).toBeVisible();
		await page.getByRole("button", { name: "Back to dashboard" }).click();

		await expect(page.getByText("Payment plan is active")).toBeVisible();
		await expect(page.getByText("0 of 4 installments")).toBeVisible();
		await page
			.getByRole("button", { name: "Advance to next payment date" })
			.click();
		await expect(
			page.getByText(
				"Your payment was processed automatically from escrow for installment.",
			),
		).toBeVisible();
		await expect(page.getByText("1 of 4 installments")).toBeVisible();
		await expect(page.getByText("Due $16,875.00")).toBeVisible();

		for (let index = 0; index < 3; index += 1) {
			await page
				.getByRole("button", { name: "Advance to next payment date" })
				.click();
		}

		await expect(page.getByText("Payment plan is active")).toHaveCount(0);
		await expect(page.getByText("$127.00")).toBeVisible();
	});

	test("reset clears the demo session and returns the user to the landing page", async ({
		page,
	}) => {
		const studentName = DEFAULT_STUDENT_NAME;

		await createStudentFromDemo(page);
		await expect(page.getByText(studentName)).toBeVisible();

		await page.getByRole("button", { name: "Reset" }).click();
		await expect(page).toHaveURL(/\/$/);
		await expect(
			page.getByRole("link", { name: "Start Student Demo" }),
		).toBeVisible();

		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/demo$/);
	});

	test("a brand-new browser context starts empty", async ({
		browser,
		page,
	}) => {
		const studentName = DEFAULT_STUDENT_NAME;

		await createStudentFromDemo(page);
		await expect(page.getByText(studentName)).toBeVisible();

		const freshContext = await browser.newContext();
		const freshPage = await freshContext.newPage();

		try {
			await freshPage.goto("/dashboard");
			await expect(freshPage).toHaveURL(/\/demo$/);
		} finally {
			await freshContext.close();
		}
	});
});

async function createStudentFromDemo(page: Page) {
	await page.goto("/demo");
	await createStudent(page);
}

async function createStudent(page: Page) {
	await expect(page.getByText("Wallet ready")).toBeVisible();
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
	await expect(page.getByText(DEFAULT_STUDENT_NAME)).toBeVisible();
}

async function completeDeposit(
	page: Page,
	options: {
		amount: string;
		chainName: string;
		currency: "USDC" | "EURC" | "JPYC";
		keepOriginalCurrency?: boolean;
	},
) {
	await page.getByRole("button", { name: "Deposit" }).click();

	const panel = page.locator("aside");
	await expect(
		panel.getByRole("heading", { name: "Deposit funds" }),
	).toBeVisible();
	await panel.getByRole("button", { name: options.currency }).click();
	await panel
		.getByRole("button", { name: new RegExp(options.chainName) })
		.click();
	await panel.getByRole("button", { name: "Continue" }).click();
	await panel.locator('input[placeholder="0.00"]').fill(options.amount);
	await panel.getByRole("button", { name: "Continue" }).last().click();

	if (options.keepOriginalCurrency) {
		await panel.getByLabel(new RegExp(`Keep as ${options.currency}`)).check();
	}

	await panel.getByRole("button", { name: "Deposit funds" }).click();
	await expect(panel.getByText("Deposit complete")).toBeVisible({
		timeout: 20_000,
	});
	await panel.getByRole("button", { name: "Back to dashboard" }).click();
	await expect(panel).toHaveCount(0);
}
