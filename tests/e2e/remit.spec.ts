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
		await expect(page.getByRole("button", { name: "Deposit" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Add funds" })).toBeVisible();
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
		await expect(
			panel.getByRole("heading", { name: "Choose currency" }),
		).toBeVisible();
		await panel.getByRole("button", { name: "EURC" }).click();
		await panel.locator('input[type="number"]').fill("5000");
		await panel.getByRole("button", { name: "Continue" }).click();
		await expect(
			panel.getByText("Deposit in original currency", { exact: true }),
		).toBeVisible();
		await panel.getByRole("button", { name: "Deposit funds" }).click();

		await expect(panel.getByText("CCTP Bridge")).toBeVisible();
		await expect(
			panel.getByText("StableFX Swap", { exact: true }),
		).toBeVisible();
		await expect(panel.getByText(/1 EURC =/)).toBeVisible();
		await expect(
			panel.getByRole("heading", { name: "Deposit complete" }),
		).toBeVisible({ timeout: 35_000 });
		await expect(
			panel.getByRole("heading", { name: "Funds arrived" }),
		).toHaveCount(0);
		await expect(panel.getByText("Saved against bank FX")).toBeVisible();
		await expect(panel.getByText("View transaction")).toBeVisible();

		await panel.getByRole("button", { name: "Close" }).click();
		await expect(page).toHaveURL(/\/dashboard$/);
		await expect(page.getByText("Deposit from Base")).toBeVisible();
		await expect(page.getByText("Settled in USDC via StableFX")).toBeVisible();
		await expect(page.getByText(/\+\$\d{1,3}(,\d{3})*\.\d{2}/)).toBeVisible();
	});

	test("credits a JPYC deposit into wallet balances when swap is opted out", async ({
		page,
	}) => {
		const studentName = uniqueStudentName("JPYC");

		await createStudentFromDemo(page, studentName);
		await completeDeposit(page, {
			chainName: "Base",
			amount: "5000",
			currency: "JPYC",
			depositInOriginalCurrency: true,
		});

		await expect(
			page.locator("main").getByText("¥5,000", { exact: true }).first(),
		).toBeVisible();
		await expect(page.getByText("Deposit from Base")).toBeVisible();
	});

	test("skips the swap option for USDC deposits", async ({ page }) => {
		const studentName = uniqueStudentName("USDC");

		await createStudentFromDemo(page, studentName);
		await page.getByRole("button", { name: "Deposit" }).click();
		await expect(
			page.getByRole("heading", { name: "Deposit funds" }),
		).toBeVisible();

		const panel = page.locator("aside");
		await panel.getByRole("button", { name: /Base/ }).click();
		await panel.getByRole("button", { name: "USDC" }).click();
		await panel.locator('input[type="number"]').fill("5000");
		await panel.getByRole("button", { name: "Continue" }).click();
		await expect(
			panel.getByText("Deposit in original currency", { exact: true }),
		).toHaveCount(0);
		await panel.getByRole("button", { name: "Deposit funds" }).click();
		await expect(panel.getByText("StableFX Swap", { exact: true })).toHaveCount(
			0,
		);
		await expect(
			panel.getByRole("heading", { name: "Deposit complete" }),
		).toBeVisible({ timeout: 35_000 });
	});

	test("uses the Arc credit step before StableFX on Arc-source deposits", async ({
		page,
	}) => {
		const studentName = uniqueStudentName("Arc");

		await createStudentFromDemo(page, studentName);
		await page.getByRole("button", { name: "Deposit" }).click();
		const panel = page.locator("aside");
		await panel.getByRole("button", { name: /Arc/ }).click();
		await panel.getByRole("button", { name: "EURC" }).click();
		await panel.locator('input[type="number"]').fill("100");
		await panel.getByRole("button", { name: "Continue" }).click();
		await panel.getByRole("button", { name: "Deposit funds" }).click();
		await expect(panel.getByText("Arc Credit")).toBeVisible();
		await expect(
			panel.getByText("StableFX Swap", { exact: true }),
		).toBeVisible();
		await expect(
			panel.getByRole("heading", { name: "Deposit complete" }),
		).toBeVisible({ timeout: 35_000 });
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
			depositInOriginalCurrency: true,
		});

		await expect(
			page.getByRole("button", { name: "Pay $22,500.00" }),
		).toBeVisible();
		await page.getByRole("button", { name: "Pay $22,500.00" }).click();
		await expect(
			page.getByRole("heading", { name: "Pay Meridian University" }),
		).toBeVisible();

		const panel = page.locator("aside");
		await expect(
			panel.getByRole("heading", { name: "Automatic conversion" }),
		).toBeVisible();
		await expect(panel.getByRole("button", { name: "Confirm payment" })).toBeVisible();
		await panel.getByRole("button", { name: "Confirm payment" }).click();

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
			panel.getByRole("heading", { name: "Choose currency" }),
		).toBeVisible();

		await page.getByRole("button", { name: "Pay $22,500.00" }).click();
		await expect(
			page.getByRole("heading", { name: "Pay Meridian University" }),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Deposit funds" }),
		).toHaveCount(0);
	});

	test("pays the current balance in one step when already funded in USDC", async ({
		page,
	}) => {
		const studentName = uniqueStudentName("USDCPay");

		await createStudentFromDemo(page, studentName);
		await completeDeposit(page, {
			chainName: "Base",
			amount: "22500",
			currency: "USDC",
		});

		await page.getByRole("button", { name: "Pay $22,500.00" }).click();
		const panel = page.locator("aside");

		await expect(
			panel.getByRole("heading", { name: "Automatic conversion" }),
		).toHaveCount(0);
		await expect(panel.getByText("Using existing balance")).toBeVisible();
		await panel.getByRole("button", { name: "Confirm payment" }).click();

		await expect(
			panel.getByRole("heading", { name: "Payment final" }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("keeps the standalone swap workflow available for manual conversions", async ({
		page,
	}) => {
		const studentName = uniqueStudentName("ManualSwap");

		await createStudentFromDemo(page, studentName);
		await completeDeposit(page, {
			chainName: "Base",
			amount: "500",
			currency: "EURC",
			depositInOriginalCurrency: true,
		});

		await page.getByRole("button", { name: "Swap" }).click();
		const panel = page.locator("aside");

		await expect(page.getByRole("heading", { name: "Swap funds" })).toBeVisible();
		await expect(panel.getByRole("button", { name: "EURC" })).toBeVisible();
		await panel.locator('input[type="text"]').fill("100");
		await panel.getByRole("button", { name: "Continue" }).click();
		await panel.getByRole("button", { name: "Swap funds" }).click();

		await expect(
			panel.getByRole("heading", { name: "Swap complete" }),
		).toBeVisible({ timeout: 10_000 });
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
		page.getByRole("heading", { name: "Create your Remit wallet" }),
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
	options: {
		chainName: string;
		amount: string;
		currency: string;
		depositInOriginalCurrency?: boolean;
	},
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
	if (options.depositInOriginalCurrency) {
		await panel
			.getByText("Deposit in original currency", { exact: true })
			.click();
	}
	await panel.getByRole("button", { name: "Deposit funds" }).click();
	await expect(
		panel.getByRole("heading", { name: "Deposit complete" }),
	).toBeVisible({ timeout: 35_000 });
	await panel.getByRole("button", { name: "Close" }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
}
