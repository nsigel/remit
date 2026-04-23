"use client";

import { ARC } from "~/lib/constants";
import type { StableFxQuoteSnapshot } from "~/lib/stablefx";
import { SwapOutcomeCard } from "./swap-outcome-card";
import { formatAmount } from "./workflow-utils";

type DepositOutcomeCardProps = {
	status: "pending" | "active" | "complete";
	depositAmount: number;
	depositCurrency: string;
	arrivalAmount: number;
	arrivalCurrency: string;
	sourceChainName: string;
	autoSwap: boolean;
	quote?: StableFxQuoteSnapshot | null;
	confirmationMs?: number;
	txHash?: string | null;
};

export function DepositOutcomeCard({
	status,
	depositAmount,
	depositCurrency,
	arrivalAmount,
	arrivalCurrency,
	sourceChainName,
	autoSwap,
	quote,
	confirmationMs,
	txHash,
}: DepositOutcomeCardProps) {
	if (autoSwap && quote) {
		return (
			<SwapOutcomeCard
				confirmationMs={confirmationMs}
				context="deposit"
				fromAmount={depositAmount}
				fromCurrency={depositCurrency}
				quote={quote}
				sourceChainName={sourceChainName}
				status={status}
				toAmount={arrivalAmount}
				toCurrency={arrivalCurrency}
				txHash={txHash}
			/>
		);
	}

	return (
		<div
			className={`rounded-[1.6rem] border px-4 py-4 sm:px-5 ${
				status === "complete"
					? "border-success/15 bg-success/8"
					: "border-text/10 bg-bg"
			}`}
		>
			<p className="text-sm text-text-secondary">
				{status === "complete"
					? `Now in your Remit wallet as ${arrivalCurrency}.`
					: "On the way to your Remit wallet."}
			</p>

			<div className="mt-3 font-serif text-[2.65rem] text-text leading-none sm:text-[2.9rem]">
				{formatCurrencyAmount(arrivalAmount, arrivalCurrency)}
			</div>

			<p className="mt-3 max-w-md text-sm text-text-secondary">
				{`${formatCurrencyAmount(depositAmount, depositCurrency)} from ${sourceChainName}, depositing directly into your Remit wallet.`}
			</p>

			{status === "complete" && (confirmationMs != null || txHash) ? (
				<div className="mt-4 flex flex-wrap items-center gap-3 border-text/6 border-t pt-4 text-sm">
					{confirmationMs != null ? (
						<div className="flex items-center gap-2">
							<span className="text-text-secondary">Confirmed in</span>
							<span className="font-medium text-text">
								{`${(confirmationMs / 1000).toFixed(1)}s`}
							</span>
						</div>
					) : null}
					{confirmationMs != null && txHash ? (
						<span aria-hidden className="h-4 w-px bg-border" />
					) : null}
					{txHash ? (
						<a
							className="font-medium text-text transition-colors hover:text-text-secondary"
							href={`${ARC.explorer}/tx/${txHash}`}
							rel="noopener noreferrer"
							target="_blank"
						>
							View transaction
						</a>
					) : null}
				</div>
			) : null}
		</div>
	);
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
