"use client";

import { useEffect, useMemo, useState } from "react";
import {
	STABLEFX_TOTAL_DURATION_MS,
	type StableFxQuoteSnapshot,
} from "~/lib/stablefx";
import { api } from "~/trpc/react";
import { SwapOutcomeCard } from "./swap-outcome-card";
import { useStableFxQuote } from "./use-stablefx-quote";
import { WorkflowShell } from "./workflow-shell";
import { WorkflowStep } from "./workflow-step";
import { delay, formatAmount } from "./workflow-utils";

type SwapWorkflowProps = {
	canClose: boolean;
	onClose: () => void;
	onLockChange: (locked: boolean) => void;
};

type SwapStage = "input" | "review" | "processing" | "done";

type CompletedSwapState = {
	txHash: string | null;
	confirmationMs: number | null;
};

export function SwapWorkflow({
	canClose,
	onClose,
	onLockChange,
}: SwapWorkflowProps) {
	const utils = api.useUtils();
	const [stage, setStage] = useState<SwapStage>("input");
	const [currency, setCurrency] = useState<string | null>(null);
	const [amount, setAmount] = useState("");
	const [processingQuote, setProcessingQuote] =
		useState<StableFxQuoteSnapshot | null>(null);
	const [completedSwap, setCompletedSwap] = useState<CompletedSwapState | null>(
		null,
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const { data } = api.student.dashboard.useQuery(undefined, {
		refetchOnMount: "always",
	});
	const initiate = api.swap.initiate.useMutation();
	const confirm = api.swap.confirm.useMutation();

	const swappableBalances = useMemo(
		() =>
			(data?.balances ?? []).filter(
				(balance) => balance.currency !== "USDC" && balance.amount > 0,
			),
		[data?.balances],
	);
	const selectedBalance =
		swappableBalances.find((balance) => balance.currency === currency) ?? null;
	const parsedAmount = Number.parseFloat(amount) || 0;
	const amountExceedsBalance =
		selectedBalance != null && parsedAmount > selectedBalance.amount;
	const stableFx = useStableFxQuote({
		enabled: selectedBalance != null,
		fromAmount: parsedAmount,
		fromCurrency: currency,
		toCurrency: "USDC",
	});
	const activeQuote = processingQuote ?? stableFx.quote;

	useEffect(() => {
		return () => onLockChange(false);
	}, [onLockChange]);

	const handleSelectCurrency = (nextCurrency: string) => {
		setCurrency(nextCurrency);
		setAmount("");
		setStage("input");
		setCompletedSwap(null);
		setErrorMessage(null);
		setProcessingQuote(null);
		stableFx.resetQuote();
	};

	const handleContinue = () => {
		if (!selectedBalance || parsedAmount <= 0 || amountExceedsBalance) return;
		setErrorMessage(null);
		setStage("review");
	};

	const handleStartSwap = async () => {
		if (!currency || !selectedBalance) return;

		const lockedQuote = stableFx.lockQuote();
		if (!lockedQuote) {
			setErrorMessage("StableFX quote is still loading.");
			return;
		}

		setErrorMessage(null);
		setCompletedSwap(null);
		setProcessingQuote(lockedQuote);
		setStage("processing");
		onLockChange(true);

		try {
			const transaction = await initiate.mutateAsync({
				fromAmount: parsedAmount,
				fromCurrency: currency,
				quote: lockedQuote,
				toCurrency: "USDC",
			});

			await delay(STABLEFX_TOTAL_DURATION_MS);

			const completed = await confirm.mutateAsync({
				transactionId: transaction.id,
			});

			setCompletedSwap({
				txHash: completed.txHash,
				confirmationMs: completed.confirmationMs,
			});

			await Promise.all([
				utils.student.dashboard.invalidate(),
				utils.transaction.list.invalidate(),
			]);

			setStage("done");
			onLockChange(false);
		} catch (error) {
			setStage("review");
			setProcessingQuote(null);
			setCompletedSwap(null);
			setErrorMessage(
				error instanceof Error ? error.message : "Swap could not be completed.",
			);
			onLockChange(false);
		}
	};

	const reviewStepState = stage === "review" ? "active" : "completed";

	return (
		<WorkflowShell canClose={canClose} onClose={onClose} title="Swap funds">
			<WorkflowStep
				action={
					currency && stage !== "processing" && stage !== "done" ? (
						<button
							className="cursor-pointer text-text-secondary text-xs transition-colors hover:text-text"
							onClick={() => {
								setCurrency(null);
								setAmount("");
								setStage("input");
								setErrorMessage(null);
								setProcessingQuote(null);
								stableFx.resetQuote();
							}}
							type="button"
						>
							Edit
						</button>
					) : undefined
				}
				state={stage === "input" ? "active" : "completed"}
				stepLabel="Step 1"
				summary={
					currency && parsedAmount > 0 ? (
						<p className="text-sm text-text-secondary">
							{`${formatCurrencyAmount(parsedAmount, currency)} selected`}
						</p>
					) : undefined
				}
				title={currency ?? "Choose currency and amount"}
			>
				<div className="space-y-4">
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
						{swappableBalances.map((balance) => (
							<button
								className={`cursor-pointer rounded-2xl border px-4 py-4 text-left transition-colors ${
									currency === balance.currency
										? "border-text bg-text text-bg"
										: "border-border hover:bg-bg-secondary"
								}`}
								key={balance.currency}
								onClick={() => handleSelectCurrency(balance.currency)}
								type="button"
							>
								<div className="font-medium text-base">{balance.currency}</div>
								<div
									className={
										currency === balance.currency
											? "mt-1 text-bg/72 text-sm"
											: "mt-1 text-sm text-text-secondary"
									}
								>
									{`Available ${formatCurrencyAmount(balance.amount, balance.currency)}`}
								</div>
							</button>
						))}
					</div>

					{swappableBalances.length === 0 ? (
						<p className="text-sm text-text-secondary">
							No non-USDC balance is available to swap.
						</p>
					) : null}

					{selectedBalance ? (
						<>
							<input
								className="w-full rounded-3xl border border-border bg-bg px-4 py-4 text-4xl tabular-nums outline-none transition-colors focus:border-text"
								inputMode="decimal"
								onChange={(event) => {
									const nextAmount = event.target.value.replaceAll(",", "");
									if (nextAmount && !/^\d*\.?\d*$/.test(nextAmount)) {
										return;
									}

									setAmount(nextAmount);
									setErrorMessage(null);
									setProcessingQuote(null);
									stableFx.resetQuote();
								}}
								placeholder="0.00"
								type="text"
								value={formatAmountInputForDisplay(amount)}
							/>

							<div className="flex items-center justify-between gap-3 text-sm">
								<span className="text-text-secondary">
									{`Available ${formatCurrencyAmount(selectedBalance.amount, selectedBalance.currency)}`}
								</span>
								<button
									className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:bg-bg-secondary"
									onClick={() => {
										setAmount(selectedBalance.amount.toString());
										setErrorMessage(null);
										setProcessingQuote(null);
										stableFx.resetQuote();
									}}
									type="button"
								>
									Max balance
								</button>
							</div>

							{amountExceedsBalance ? (
								<p className="text-danger text-sm">
									Enter an amount within your available balance.
								</p>
							) : null}
						</>
					) : null}

					<button
						className="w-full cursor-pointer rounded-full bg-text py-3 font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
						disabled={
							!selectedBalance ||
							parsedAmount <= 0 ||
							amountExceedsBalance ||
							swappableBalances.length === 0
						}
						onClick={handleContinue}
						type="button"
					>
						Continue
					</button>
				</div>
			</WorkflowStep>

			{stage !== "input" && currency && parsedAmount > 0 ? (
				<WorkflowStep
					action={
						stage === "review" ? (
							<button
								className="cursor-pointer text-text-secondary text-xs transition-colors hover:text-text"
								onClick={() => {
									setStage("input");
									setErrorMessage(null);
									setProcessingQuote(null);
									stableFx.resetQuote();
								}}
								type="button"
							>
								Edit
							</button>
						) : undefined
					}
					state={reviewStepState}
					stepLabel="Step 2"
					summary={
						activeQuote ? (
							<p className="text-sm text-text-secondary">
								{`Reviewing ${formatCurrencyAmount(activeQuote.toAmount, activeQuote.toCurrency)}`}
							</p>
						) : undefined
					}
					title="Review swap"
				>
					<div className="space-y-4">
						{activeQuote ? (
							<SwapOutcomeCard
								context="standalone"
								fromAmount={parsedAmount}
								fromCurrency={currency}
								quote={activeQuote}
								status="pending"
								toAmount={activeQuote.toAmount}
								toCurrency={activeQuote.toCurrency}
							/>
						) : (
							<p className="text-sm text-text-secondary">
								StableFX is preparing your quote.
							</p>
						)}

						{errorMessage ? (
							<p className="text-danger text-sm">{errorMessage}</p>
						) : null}

						<button
							className="w-full cursor-pointer rounded-full bg-text py-3 font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
							disabled={!activeQuote || initiate.isPending || confirm.isPending}
							onClick={handleStartSwap}
							type="button"
						>
							Swap funds
						</button>
					</div>
				</WorkflowStep>
			) : null}

			{stage === "processing" || stage === "done" ? (
				<WorkflowStep
					activeBadge="spinner"
					completedContent={
						activeQuote ? (
							<div className="space-y-4">
								<SwapOutcomeCard
									context="standalone"
									confirmationMs={completedSwap?.confirmationMs ?? undefined}
									fromAmount={parsedAmount}
									fromCurrency={currency ?? activeQuote.fromCurrency}
									quote={activeQuote}
									status={stage === "done" ? "complete" : "active"}
									toAmount={activeQuote.toAmount}
									toCurrency={activeQuote.toCurrency}
									txHash={completedSwap?.txHash}
								/>

								{stage === "done" ? (
									<button
										className="w-full cursor-pointer rounded-full bg-text py-3 font-medium text-bg transition-opacity hover:opacity-90"
										onClick={onClose}
										type="button"
									>
										Back to dashboard
									</button>
								) : null}
							</div>
						) : null
					}
					state={stage === "processing" ? "active" : "completed"}
					stepLabel="Step 3"
					summary="Swap settled in your Remit wallet."
					title={stage === "done" ? "Swap complete" : "Processing swap"}
				>
					{activeQuote ? (
						<div className="space-y-4">
							<SwapOutcomeCard
								context="standalone"
								fromAmount={parsedAmount}
								fromCurrency={currency ?? activeQuote.fromCurrency}
								quote={activeQuote}
								status="active"
								toAmount={activeQuote.toAmount}
								toCurrency={activeQuote.toCurrency}
							/>
						</div>
					) : null}
				</WorkflowStep>
			) : null}
		</WorkflowShell>
	);
}

function formatAmountInputForDisplay(value: string) {
	if (!value) return "";

	const [whole, decimal] = value.split(".");
	const formattedWhole = (whole ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");

	return decimal == null ? formattedWhole : `${formattedWhole}.${decimal}`;
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
