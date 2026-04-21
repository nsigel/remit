import { FX_RATES, STABLEFX_SPREAD } from "./constants";

export const STABLEFX_BENCHMARK_SPREAD = 0.051;
export const STABLEFX_REVIEW_REFRESH_MS = 5000;
export const STABLEFX_REVIEW_REFRESH_SPINNER_MS = 700;
export const STABLEFX_REVIEW_VARIANCE_BPS = 14;

export const STABLEFX_PHASE_DURATIONS_MS = {
	querying: 500,
	rateReveal: 500,
	conversion: 1000,
	savingsReveal: 500,
} as const;

export const STABLEFX_TOTAL_DURATION_MS = Object.values(
	STABLEFX_PHASE_DURATIONS_MS,
).reduce((total, duration) => total + duration, 0);

export type StableFxQuoteSnapshot = {
	fromCurrency: string;
	toCurrency: string;
	fromAmount: number;
	rate: number;
	toAmount: number;
	spread: number;
	benchmarkSpread: number;
	savedAmount: number;
};

export function getStableFxBaseRate(
	fromCurrency: string,
	toCurrency: string,
): number | null {
	const fromRate = FX_RATES[fromCurrency];
	const toRate = FX_RATES[toCurrency];

	if (fromRate == null || toRate == null) {
		return null;
	}

	return fromRate / toRate;
}

export function getStableFxGuaranteedRate(
	fromCurrency: string,
	toCurrency: string,
	varianceBps = STABLEFX_REVIEW_VARIANCE_BPS,
): number | null {
	const baseRate = getStableFxBaseRate(fromCurrency, toCurrency);
	if (baseRate == null) return null;

	const quotedRate = normalizeNumber(baseRate * (1 - STABLEFX_SPREAD), 6);
	const minimumRate = floorNumber(quotedRate * (1 - varianceBps / 10_000), 6);

	return minimumRate > 0 ? minimumRate : null;
}

export function buildStableFxQuoteSnapshot({
	fromCurrency,
	toCurrency,
	fromAmount,
}: {
	fromCurrency: string;
	toCurrency: string;
	fromAmount: number;
}): StableFxQuoteSnapshot | null {
	const baseRate = getStableFxBaseRate(fromCurrency, toCurrency);
	if (baseRate == null) return null;

	const rate = normalizeNumber(baseRate * (1 - STABLEFX_SPREAD), 6);
	const traditionalRate = normalizeNumber(
		baseRate * (1 - STABLEFX_BENCHMARK_SPREAD),
		6,
	);
	const toAmount = normalizeNumber(fromAmount * rate, 6);
	const traditionalToAmount = normalizeNumber(fromAmount * traditionalRate, 6);
	const savedAmount = normalizeNumber(toAmount - traditionalToAmount, 6);

	return {
		fromCurrency,
		toCurrency,
		fromAmount: normalizeNumber(fromAmount, 6),
		rate,
		toAmount,
		spread: STABLEFX_SPREAD,
		benchmarkSpread: STABLEFX_BENCHMARK_SPREAD,
		savedAmount,
	};
}

export function buildStableFxQuoteSeries({
	snapshot,
	steps = 7,
	varianceBps = STABLEFX_REVIEW_VARIANCE_BPS,
}: {
	snapshot: StableFxQuoteSnapshot;
	steps?: number;
	varianceBps?: number;
}): StableFxQuoteSnapshot[] {
	const safeSteps = Math.max(1, steps);
	const seed = buildSeed(
		`${snapshot.fromCurrency}:${snapshot.toCurrency}:${snapshot.fromAmount.toFixed(2)}`,
	);

	return Array.from({ length: safeSteps }, (_, index) => {
		if (index === safeSteps - 1) {
			return snapshot;
		}

		const progress = safeSteps === 1 ? 1 : index / (safeSteps - 1);
		const seededWave = Math.sin(seed + index * 1.73);
		const taper = 1 - progress;
		const bpsOffset = seededWave * varianceBps * taper;
		const adjustedRate = normalizeNumber(
			snapshot.rate * (1 + bpsOffset / 10_000),
			6,
		);
		const adjustedToAmount = normalizeNumber(
			snapshot.fromAmount * adjustedRate,
			6,
		);
		const traditionalToAmount = normalizeNumber(
			snapshot.fromAmount *
				(snapshot.rate / (1 - snapshot.spread)) *
				(1 - snapshot.benchmarkSpread),
			6,
		);

		return {
			...snapshot,
			rate: adjustedRate,
			toAmount: adjustedToAmount,
			savedAmount: normalizeNumber(adjustedToAmount - traditionalToAmount, 6),
		};
	});
}

export function getDepositFlowDurationMs({
	arcNative,
	autoSwap,
}: {
	arcNative: boolean;
	autoSwap: boolean;
}) {
	if (arcNative) {
		return autoSwap ? 4300 : 1800;
	}

	return autoSwap ? 7000 : 4500;
}

export function getBridgeDurationMs({
	arcNative,
	autoSwap,
}: {
	arcNative: boolean;
	autoSwap: boolean;
}) {
	const totalDuration = getDepositFlowDurationMs({ arcNative, autoSwap });
	return autoSwap ? totalDuration - STABLEFX_TOTAL_DURATION_MS : totalDuration;
}

function buildSeed(value: string) {
	let hash = 0;
	for (let index = 0; index < value.length; index++) {
		hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
	}
	return hash / 1000;
}

function normalizeNumber(value: number, digits: number) {
	return Number(value.toFixed(digits));
}

function floorNumber(value: number, digits: number) {
	const multiplier = 10 ** digits;
	return Math.floor(value * multiplier) / multiplier;
}
