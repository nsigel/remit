"use client";

import { useEffect, useState } from "react";
import {
	buildStableFxQuoteSeries,
	buildStableFxQuoteSnapshot,
	STABLEFX_REVIEW_REFRESH_MS,
	STABLEFX_REVIEW_REFRESH_SPINNER_MS,
	type StableFxQuoteSnapshot,
} from "~/lib/stablefx";

export function useStableFxQuote({
	fromCurrency,
	toCurrency = "USDC",
	fromAmount,
	enabled = true,
}: {
	fromCurrency: string | null;
	toCurrency?: string;
	fromAmount: number;
	enabled?: boolean;
}) {
	const isSupported =
		enabled &&
		fromCurrency != null &&
		toCurrency != null &&
		fromCurrency !== toCurrency &&
		fromAmount > 0;

	const [quoteIndex, setQuoteIndex] = useState(0);
	const [lockedQuote, setLockedQuote] = useState<StableFxQuoteSnapshot | null>(
		null,
	);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
	const quoteKey = `${fromCurrency ?? "none"}:${toCurrency}:${fromAmount.toFixed(2)}`;

	const baseQuote =
		isSupported && fromCurrency
			? buildStableFxQuoteSnapshot({
					fromCurrency,
					toCurrency,
					fromAmount,
				})
			: null;
	const series = baseQuote
		? buildStableFxQuoteSeries({ snapshot: baseQuote })
		: [];
	const quote =
		lockedQuote ??
		(series.length > 0 ? series[quoteIndex % series.length] : null);

	useEffect(() => {
		void quoteKey;
		setQuoteIndex(0);
		setLockedQuote(null);
		setIsRefreshing(false);
		setNextRefreshAt(
			isSupported ? Date.now() + STABLEFX_REVIEW_REFRESH_MS : null,
		);
	}, [isSupported, quoteKey]);

	useEffect(() => {
		if (!isSupported || lockedQuote || series.length <= 1) {
			setIsRefreshing(false);
			setNextRefreshAt(null);
			return;
		}

		let refreshTimeoutId: number | null = null;
		let resolveTimeoutId: number | null = null;
		let cancelled = false;

		const scheduleRefresh = () => {
			setNextRefreshAt(Date.now() + STABLEFX_REVIEW_REFRESH_MS);

			refreshTimeoutId = window.setTimeout(() => {
				if (cancelled) return;
				setIsRefreshing(true);

				resolveTimeoutId = window.setTimeout(() => {
					if (cancelled) return;
					setQuoteIndex((current) => (current + 1) % series.length);
					setIsRefreshing(false);
					scheduleRefresh();
				}, STABLEFX_REVIEW_REFRESH_SPINNER_MS);
			}, STABLEFX_REVIEW_REFRESH_MS);
		};

		scheduleRefresh();

		return () => {
			cancelled = true;
			if (refreshTimeoutId != null) window.clearTimeout(refreshTimeoutId);
			if (resolveTimeoutId != null) window.clearTimeout(resolveTimeoutId);
		};
	}, [isSupported, lockedQuote, series.length]);

	return {
		quote,
		series,
		isSupported,
		lockedQuote,
		isRefreshing,
		nextRefreshAt,
		refreshIntervalMs: STABLEFX_REVIEW_REFRESH_MS,
		lockQuote: () => {
			if (!quote) return null;
			setLockedQuote(quote);
			return quote;
		},
		resetQuote: () => {
			setQuoteIndex(0);
			setLockedQuote(null);
		},
	};
}
