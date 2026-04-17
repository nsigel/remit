import type { PaymentPlan, PaymentPlanStep } from "~/lib/payment-plan";

export type PaymentStepStatus =
	| "ready"
	| "queued"
	| "processing"
	| "applied"
	| "confirmed";

export type PaymentFlowStep = {
	key: string;
	kind: "wallet" | "swap" | "payment";
	title: string;
	detail: string;
	confirmationMs?: number | null;
	txHash?: string | null;
	blockNumber?: number | null;
};

export function getMinimumPayment(totalDue: number) {
	if (totalDue <= 0) return 0;
	return Math.min(totalDue, Math.max(50, totalDue * 0.1));
}

export function formatDate(date?: Date) {
	if (!date) return "N/A";
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function formatAmount(n: number): string {
	return n.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

export function formatBalance(amount: number, currency: string) {
	if (currency === "USDC") return `$${formatAmount(amount)} USDC`;
	if (currency === "EURC") return `€${formatAmount(amount)} EURC`;
	return `${formatAmount(amount)} ${currency}`;
}

export function txLabel(
	type: string,
	sourceChain?: string | null,
	fromCurrency?: string | null,
	toCurrency?: string | null,
): string {
	if (type === "DEPOSIT") return `Deposit from ${sourceChain ?? "unknown"}`;
	if (type === "SWAP") return `Swap ${fromCurrency} to ${toCurrency}`;
	return "Current Balance Payment";
}

export function buildPaymentPreviewSteps(
	paymentPlan: PaymentPlan,
	universityName: string,
): PaymentFlowStep[] {
	const steps: PaymentFlowStep[] = paymentPlan.steps.map(
		(step: PaymentPlanStep, index) => {
			if (step.kind === "wallet") {
				return {
					key: `wallet-${index}`,
					kind: "wallet",
					title: `Use existing ${step.currency} in Remit`,
					detail: `${formatBalance(step.amount, step.currency)} on Arc.`,
				};
			}

			return {
				key: `swap-${index}`,
				kind: "swap",
				title: `Convert ${step.fromCurrency} to ${step.toCurrency}`,
				detail: `${formatBalance(step.fromAmount, step.fromCurrency)} to ${formatBalance(step.toAmount, step.toCurrency)}.`,
			};
		},
	);

	steps.push({
		key: "payment-final",
		kind: "payment",
		title: `Send ${formatBalance(
			paymentPlan.statementAmount,
			paymentPlan.targetCurrency,
		)} to ${universityName}`,
		detail: "Final on Arc.",
	});

	return steps;
}

export function buildCompletedPaymentSteps(
	paymentPlan: PaymentPlan,
	universityName: string,
	swaps: Array<{
		txHash: string | null;
		blockNumber: number | null;
		confirmationMs: number | null;
	}>,
	payment: {
		txHash: string | null;
		blockNumber: number | null;
		confirmationMs: number | null;
	},
): PaymentFlowStep[] {
	const steps = buildPaymentPreviewSteps(paymentPlan, universityName);
	let swapIndex = 0;

	return steps.map((step) => {
		if (step.kind === "swap") {
			const swap = swaps[swapIndex++];
			return {
				...step,
				txHash: swap?.txHash,
				blockNumber: swap?.blockNumber,
				confirmationMs: swap?.confirmationMs,
			};
		}

		if (step.kind === "payment") {
			return {
				...step,
				txHash: payment.txHash,
				blockNumber: payment.blockNumber,
				confirmationMs: payment.confirmationMs,
			};
		}

		return step;
	});
}

export function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
