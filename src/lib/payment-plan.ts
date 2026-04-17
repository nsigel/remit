import { FX_RATES, STABLEFX_SPREAD } from "~/lib/constants";

const PAYMENT_EPSILON = 0.000001;

export type PaymentBalance = {
	currency: string;
	amount: number;
};

export type PaymentPlanStep =
	| {
			kind: "wallet";
			currency: string;
			amount: number;
	  }
	| {
			kind: "swap";
			fromCurrency: string;
			toCurrency: string;
			fromAmount: number;
			toAmount: number;
			effectiveRate: number;
			spread: number;
	  };

export type PaymentPlan = {
	targetCurrency: string;
	statementAmount: number;
	availableTargetAmount: number;
	paymentPower: number;
	canPay: boolean;
	shortfall: number;
	steps: PaymentPlanStep[];
};

export function buildPaymentPlan(
	balances: PaymentBalance[],
	statementAmount: number,
	targetCurrency = "USDC",
): PaymentPlan {
	const normalizedBalances = balances.filter(
		(balance) => balance.amount > PAYMENT_EPSILON,
	);
	const paymentPower = getPaymentPower(normalizedBalances, targetCurrency);
	const availableTargetAmount = getBalanceAmount(
		normalizedBalances,
		targetCurrency,
	);

	let remaining = statementAmount;
	const steps: PaymentPlanStep[] = [];

	if (availableTargetAmount > PAYMENT_EPSILON) {
		const amount = Math.min(availableTargetAmount, statementAmount);
		steps.push({
			kind: "wallet",
			currency: targetCurrency,
			amount: normalizeAmount(amount),
		});
		remaining -= amount;
	}

	const swapCandidates = normalizedBalances
		.filter((balance) => balance.currency !== targetCurrency)
		.map((balance) => ({
			...balance,
			effectiveRate: getEffectiveRate(balance.currency, targetCurrency),
		}))
		.filter(
			(balance): balance is PaymentBalance & { effectiveRate: number } =>
				balance.effectiveRate != null &&
				balance.effectiveRate > PAYMENT_EPSILON,
		)
		.sort((a, b) => b.amount * b.effectiveRate - a.amount * a.effectiveRate);

	for (const balance of swapCandidates) {
		if (remaining <= PAYMENT_EPSILON) break;

		const totalReceivable = balance.amount * balance.effectiveRate;
		const toAmount = Math.min(remaining, totalReceivable);
		const usesFullBalance = totalReceivable - toAmount <= PAYMENT_EPSILON;
		const fromAmount = usesFullBalance
			? balance.amount
			: toAmount / balance.effectiveRate;

		steps.push({
			kind: "swap",
			fromCurrency: balance.currency,
			toCurrency: targetCurrency,
			fromAmount: normalizeAmount(fromAmount),
			toAmount: normalizeAmount(toAmount),
			effectiveRate: balance.effectiveRate,
			spread: STABLEFX_SPREAD,
		});

		remaining -= toAmount;
	}

	const normalizedRemaining = remaining <= PAYMENT_EPSILON ? 0 : remaining;

	return {
		targetCurrency,
		statementAmount: normalizeAmount(statementAmount),
		availableTargetAmount: normalizeAmount(availableTargetAmount),
		paymentPower: normalizeAmount(paymentPower),
		canPay: normalizedRemaining <= PAYMENT_EPSILON,
		shortfall: normalizeAmount(Math.max(normalizedRemaining, 0)),
		steps,
	};
}

export function getPaymentPower(
	balances: PaymentBalance[],
	targetCurrency = "USDC",
): number {
	return normalizeAmount(
		balances.reduce((total, balance) => {
			const rate = getEffectiveRate(balance.currency, targetCurrency);
			if (rate == null) return total;
			return total + balance.amount * rate;
		}, 0),
	);
}

export function getEffectiveRate(
	fromCurrency: string,
	toCurrency: string,
): number | null {
	if (fromCurrency === toCurrency) {
		return 1;
	}

	const fromRate = FX_RATES[fromCurrency];
	const toRate = FX_RATES[toCurrency];

	if (fromRate == null || toRate == null) {
		return null;
	}

	return (fromRate / toRate) * (1 - STABLEFX_SPREAD);
}

function getBalanceAmount(balances: PaymentBalance[], currency: string) {
	return balances.find((balance) => balance.currency === currency)?.amount ?? 0;
}

function normalizeAmount(amount: number) {
	return Number(amount.toFixed(6));
}
