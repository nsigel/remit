"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ARC } from "~/lib/constants";
import {
	STABLEFX_PHASE_DURATIONS_MS,
	type StableFxQuoteSnapshot,
} from "~/lib/stablefx";
import { formatAmount } from "./workflow-utils";

type SwapOutcomeCardProps = {
	status: "pending" | "active" | "complete";
	fromAmount: number;
	fromCurrency: string;
	toAmount: number;
	toCurrency: string;
	quote: StableFxQuoteSnapshot;
	confirmationMs?: number;
	txHash?: string | null;
	context?: "standalone" | "deposit";
	sourceChainName?: string;
};

type SwapPhase = "querying" | "rate" | "conversion" | "savings";

export function SwapOutcomeCard({
	status,
	fromAmount,
	fromCurrency,
	toAmount,
	toCurrency,
	quote,
	confirmationMs,
	txHash,
	context = "standalone",
	sourceChainName,
}: SwapOutcomeCardProps) {
	const [phase, setPhase] = useState<SwapPhase>("savings");
	const showConfirmedMetrics =
		context === "standalone" || status === "complete";

	useEffect(() => {
		if (status !== "active") {
			setPhase("savings");
			return;
		}

		setPhase("querying");

		const rateTimer = window.setTimeout(() => {
			setPhase("rate");
		}, STABLEFX_PHASE_DURATIONS_MS.querying);
		const conversionTimer = window.setTimeout(() => {
			setPhase("conversion");
		}, STABLEFX_PHASE_DURATIONS_MS.querying +
			STABLEFX_PHASE_DURATIONS_MS.rateReveal);
		const savingsTimer = window.setTimeout(
			() => {
				setPhase("savings");
			},
			STABLEFX_PHASE_DURATIONS_MS.querying +
				STABLEFX_PHASE_DURATIONS_MS.rateReveal +
				STABLEFX_PHASE_DURATIONS_MS.conversion,
		);

		return () => {
			window.clearTimeout(rateTimer);
			window.clearTimeout(conversionTimer);
			window.clearTimeout(savingsTimer);
		};
	}, [status]);

	return (
		<div
			className={`rounded-[1.6rem] border px-4 py-4 sm:px-5 ${
				status === "complete"
					? "border-success/15 bg-success/8"
					: "border-text/10 bg-bg"
			}`}
		>
			<motion.p
				animate={{ opacity: 1, y: 0 }}
				className="text-sm text-text-secondary"
				initial={{ opacity: 0.7, y: 2 }}
				key={`${status}-${phase}`}
				transition={{ duration: 0.18, ease: "easeOut" }}
			>
				{buildStatusLine({ context, phase, status, toCurrency })}
			</motion.p>

			<div className="mt-3 font-serif text-[2.65rem] text-text leading-none sm:text-[2.9rem]">
				{formatCurrencyAmount(toAmount, toCurrency)}
			</div>

			<p className="mt-3 max-w-md text-sm text-text-secondary">
				{buildSupportingLine({
					context,
					fromAmount,
					fromCurrency,
					sourceChainName,
					toCurrency,
				})}
			</p>

			{showConfirmedMetrics ? (
				<div className="mt-4 space-y-3 border-text/6 border-t pt-4">
					<motion.div
						animate={{
							opacity: status === "active" && phase !== "savings" ? 0.55 : 1,
							y: status === "active" && phase !== "savings" ? 3 : 0,
						}}
						transition={{ duration: 0.22, ease: "easeOut" }}
					>
						<MetricRow
							label="Confirmed in"
							value={
								confirmationMs != null
									? `${(confirmationMs / 1000).toFixed(1)}s`
									: `${(
											(STABLEFX_PHASE_DURATIONS_MS.querying +
												STABLEFX_PHASE_DURATIONS_MS.rateReveal +
												STABLEFX_PHASE_DURATIONS_MS.conversion +
												STABLEFX_PHASE_DURATIONS_MS.savingsReveal) /
												1000
										).toFixed(1)}s`
							}
						/>
					</motion.div>
					<motion.div
						animate={{
							opacity: status === "active" && phase !== "savings" ? 0.55 : 1,
							y: status === "active" && phase !== "savings" ? 3 : 0,
						}}
						transition={{ duration: 0.22, ease: "easeOut" }}
					>
						<MetricRow
							emphasize
							label="Saved vs bank"
							value={`$${formatAmount(quote.savedAmount)}`}
						/>
					</motion.div>
				</div>
			) : null}

			<div className="mt-4 space-y-3 border-text/6 border-t pt-4">
				<div className="flex items-center justify-between gap-4 text-text-secondary text-xs">
					<span>Rate</span>
					<span className="text-right">
						{formatRate(quote.rate, quote.fromCurrency, quote.toCurrency)}
					</span>
				</div>
				{status === "complete" && txHash ? (
					<a
						className="inline-flex text-sm text-text transition-colors hover:text-text-secondary"
						href={`${ARC.explorer}/tx/${txHash}`}
						rel="noopener noreferrer"
						target="_blank"
					>
						View transaction
					</a>
				) : null}
			</div>
		</div>
	);
}

function MetricRow({
	label,
	value,
	emphasize = false,
}: {
	label: string;
	value: string;
	emphasize?: boolean;
}) {
	return (
		<div className="flex items-baseline justify-between gap-4">
			<span className="text-sm text-text-secondary">{label}</span>
			<span
				className={`text-right font-medium ${
					emphasize ? "text-success" : "text-text"
				}`}
			>
				{value}
			</span>
		</div>
	);
}

function buildStatusLine({
	phase,
	status,
	toCurrency,
	context,
}: {
	phase: SwapPhase;
	status: SwapOutcomeCardProps["status"];
	toCurrency: string;
	context: SwapOutcomeCardProps["context"];
}) {
	if (status === "complete") {
		return `Now in your Remit wallet as ${toCurrency}.`;
	}

	if (status === "pending") {
		return `Expected in your Remit wallet as ${toCurrency}.`;
	}

	if (phase === "querying") {
		return "StableFX is checking the route.";
	}

	if (phase === "rate") {
		return "StableFX locked your rate.";
	}

	if (phase === "conversion") {
		return `StableFX is settling into ${toCurrency}.`;
	}

	if (context === "deposit") {
		return "StableFX is waiting for deposit confirmation.";
	}

	return "StableFX has confirmed your savings.";
}

function buildSupportingLine({
	context,
	fromAmount,
	fromCurrency,
	sourceChainName,
	toCurrency,
}: {
	context: SwapOutcomeCardProps["context"];
	fromAmount: number;
	fromCurrency: string;
	sourceChainName?: string;
	toCurrency: string;
}) {
	if (context === "deposit") {
		return `${formatCurrencyAmount(fromAmount, fromCurrency)} from ${sourceChainName ?? "your source chain"}, converting into ${toCurrency} for your Remit wallet.`;
	}

	return `${formatCurrencyAmount(fromAmount, fromCurrency)} from your Remit wallet, converting into ${toCurrency}.`;
}

function formatCurrencyAmount(amount: number, currency: string) {
	if (currency === "USDC") return `$${formatAmount(amount)}`;
	if (currency === "EURC") return `€${formatAmount(amount)}`;
	if (currency === "JPYC") {
		return `¥${Math.round(amount).toLocaleString("en-US", {
			maximumFractionDigits: 0,
		})}`;
	}

	return `${formatAmount(amount)} ${currency}`;
}

function formatRate(rate: number, fromCurrency: string, toCurrency: string) {
	return `1 ${fromCurrency} = ${rate.toLocaleString("en-US", {
		minimumFractionDigits: 4,
		maximumFractionDigits: 4,
	})} ${toCurrency}`;
}
