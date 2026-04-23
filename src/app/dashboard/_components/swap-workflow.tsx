"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDemoSession } from "~/lib/demo-session";
import type { LiveSwapResponse } from "~/lib/live-demo";
import {
	STABLEFX_TOTAL_DURATION_MS,
	type StableFxQuoteSnapshot,
} from "~/lib/stablefx";
import { SwapOutcomeCard } from "./swap-outcome-card";
import { useStableFxQuote } from "./use-stablefx-quote";
import { WorkflowShell } from "./workflow-shell";
import { WorkflowStep } from "./workflow-step";
import { formatAmount } from "./workflow-utils";

type SwapWorkflowProps = {
	canClose: boolean;
	onClose: () => void;
	onLockChange: (locked: boolean) => void;
};

type SwapStage =
	| "input"
	| "review"
	| "processing_paused"
	| "processing_animating"
	| "done";

type LiveSwapStatus = "idle" | "running" | "failed";

type CompletedSwapState = {
	txHash: string | null;
	confirmationMs: number | null;
	amountOut: number | null;
};

const LIVE_UNPAUSE_TIMEOUT_MS = 12_000;

export function SwapWorkflow({
	canClose,
	onClose,
	onLockChange,
}: SwapWorkflowProps) {
	const { actions, selectors, session } = useDemoSession();
	const [stage, setStage] = useState<SwapStage>("input");
	const [currency, setCurrency] = useState<string | null>(null);
	const [amount, setAmount] = useState("");
	const [processingQuote, setProcessingQuote] =
		useState<StableFxQuoteSnapshot | null>(null);
	const [completedSwap, setCompletedSwap] = useState<CompletedSwapState | null>(
		null,
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [liveSwapStatus, setLiveSwapStatus] = useState<LiveSwapStatus>("idle");
	const [canUnpause, setCanUnpause] = useState(false);
	const [hasManuallyUnpaused, setHasManuallyUnpaused] = useState(false);

	const stageRef = useRef<SwapStage>("input");
	const hasFinalizedRef = useRef(false);
	const animationTimerRef = useRef<number | null>(null);
	const unpauseTimerRef = useRef<number | null>(null);
	const swapStartedAtRef = useRef<number>(0);

	const data = selectors.dashboard();
	const liveCapabilities = session?.liveCapabilities;
	const targetCurrency =
		currency === "USDC" ? "EURC" : currency != null ? "USDC" : "USDC";

	const swappableBalances = useMemo(
		() => (data?.balances ?? []).filter((balance) => balance.amount > 0),
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
		toCurrency: targetCurrency,
	});
	const activeQuote = processingQuote ?? stableFx.quote;
	const isLiveSwapEnabled =
		data?.student.walletMode === "circle_sca" &&
		liveCapabilities?.swap === true;
	const isSupportedLivePair =
		currency != null &&
		((currency === "USDC" && targetCurrency === "EURC") ||
			(currency === "EURC" && targetCurrency === "USDC"));
	const shouldUseLiveSwap = isLiveSwapEnabled && isSupportedLivePair;

	useEffect(() => {
		stageRef.current = stage;
	}, [stage]);

	useEffect(() => {
		return () => {
			if (animationTimerRef.current != null) {
				window.clearTimeout(animationTimerRef.current);
			}
			if (unpauseTimerRef.current != null) {
				window.clearTimeout(unpauseTimerRef.current);
			}
			onLockChange(false);
		};
	}, [onLockChange]);

	const clearAsyncTimers = () => {
		if (animationTimerRef.current != null) {
			window.clearTimeout(animationTimerRef.current);
			animationTimerRef.current = null;
		}

		if (unpauseTimerRef.current != null) {
			window.clearTimeout(unpauseTimerRef.current);
			unpauseTimerRef.current = null;
		}
	};

	const resetTransientState = () => {
		clearAsyncTimers();
		hasFinalizedRef.current = false;
		setCompletedSwap(null);
		setLiveSwapStatus("idle");
		setCanUnpause(false);
		setHasManuallyUnpaused(false);
	};

	const resetQuoteFlow = () => {
		setErrorMessage(null);
		setProcessingQuote(null);
		resetTransientState();
		stableFx.resetQuote();
	};

	const handleSelectCurrency = (nextCurrency: string) => {
		setCurrency(nextCurrency);
		setAmount("");
		setStage("input");
		resetQuoteFlow();
	};

	const handleContinue = () => {
		if (!selectedBalance || parsedAmount <= 0 || amountExceedsBalance) return;
		setErrorMessage(null);
		setStage("review");
	};

	const finalizeMockSwap = () => {
		if (!currency || !processingQuote || hasFinalizedRef.current) return;
		hasFinalizedRef.current = true;
		clearAsyncTimers();

		try {
			const result = actions.commitSwap({
				fromAmount: parsedAmount,
				fromCurrency: currency,
				quote: processingQuote,
				toCurrency: processingQuote.toCurrency,
			});

			setCompletedSwap({
				txHash: result.transaction.txHash,
				confirmationMs: result.transaction.confirmationMs,
				amountOut: result.transaction.toAmount,
			});
			setStage("done");
			onLockChange(false);
		} catch (error) {
			hasFinalizedRef.current = false;
			setStage("review");
			setErrorMessage(
				error instanceof Error ? error.message : "Swap could not be completed.",
			);
			onLockChange(false);
		}
	};

	const finalizeLiveSwap = (liveResult: LiveSwapResponse) => {
		if (!currency || !processingQuote || hasFinalizedRef.current) return;
		hasFinalizedRef.current = true;
		clearAsyncTimers();

		const parsedOutput =
			liveResult.amountOut != null
				? Number.parseFloat(liveResult.amountOut)
				: NaN;
		const resolvedAmountOut =
			Number.isFinite(parsedOutput) && parsedOutput > 0
				? parsedOutput
				: processingQuote.toAmount;
		const confirmationMs = Math.max(
			1,
			Math.round(performance.now() - swapStartedAtRef.current),
		);

		try {
			actions.commitLiveSwap({
				fromCurrency: currency,
				toCurrency: processingQuote.toCurrency,
				fromAmount: parsedAmount,
				toAmount: resolvedAmountOut,
				txHash: liveResult.txHash,
				confirmationMs,
				exchangeRate: resolvedAmountOut / parsedAmount,
			});

			setCompletedSwap({
				txHash: liveResult.txHash,
				confirmationMs,
				amountOut: resolvedAmountOut,
			});
			setStage("done");
			onLockChange(false);
		} catch (error) {
			hasFinalizedRef.current = false;
			setStage("review");
			setErrorMessage(
				error instanceof Error
					? error.message
					: "The live Arc swap could not be recorded.",
			);
			onLockChange(false);
		}
	};

	const beginStableFxAnimation = ({ manual }: { manual: boolean }) => {
		if (!processingQuote) return;

		setStage("processing_animating");
		setCanUnpause(false);
		if (manual) {
			setHasManuallyUnpaused(true);
		}

		if (animationTimerRef.current != null) {
			window.clearTimeout(animationTimerRef.current);
		}

		animationTimerRef.current = window.setTimeout(() => {
			if (!shouldUseLiveSwap) {
				finalizeMockSwap();
			}
		}, STABLEFX_TOTAL_DURATION_MS);
	};

	const runLiveSwap = async (lockedQuote: StableFxQuoteSnapshot) => {
		try {
			const response = await fetch("/api/demo/live/swap", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					tokenIn: lockedQuote.fromCurrency,
					tokenOut: lockedQuote.toCurrency,
					amountIn: parsedAmount.toFixed(2),
				}),
			});
			const payload = (await response.json()) as
				| LiveSwapResponse
				| { error?: string };

			if (!response.ok || !("txHash" in payload)) {
				throw new Error(
					"error" in payload
						? (payload.error ?? "The live Arc swap failed.")
						: "The live Arc swap failed.",
				);
			}

			finalizeLiveSwap(payload);
		} catch (error) {
			setLiveSwapStatus("failed");
			setCanUnpause(false);
			setStage("review");
			setErrorMessage(
				error instanceof Error
					? error.message
					: "The live Arc swap could not be started.",
			);
			onLockChange(false);
		}
	};

	const handleStartSwap = async () => {
		if (!currency || !selectedBalance) return;

		const lockedQuote = stableFx.lockQuote();
		if (!lockedQuote) {
			setErrorMessage("StableFX quote is still loading.");
			return;
		}

		setErrorMessage(null);
		resetTransientState();
		setProcessingQuote(lockedQuote);
		swapStartedAtRef.current = performance.now();
		onLockChange(true);

		if (!shouldUseLiveSwap) {
			setStage("processing_animating");
			beginStableFxAnimation({ manual: false });
			return;
		}

		setStage("processing_paused");
		setLiveSwapStatus("running");
		unpauseTimerRef.current = window.setTimeout(() => {
			if (
				stageRef.current === "processing_paused" &&
				!hasFinalizedRef.current
			) {
				setCanUnpause(true);
			}
		}, LIVE_UNPAUSE_TIMEOUT_MS);

		void runLiveSwap(lockedQuote);
	};

	const reviewStepState = stage === "review" ? "active" : "completed";
	const processingTitle =
		stage === "done"
			? "Swap complete"
			: stage === "processing_paused"
				? "Waiting for live Arc swap"
				: "Completing StableFX settlement";
	const processingSummary =
		stage === "done"
			? "Settled on Arc."
			: "StableFX flow paused while the live trade is submitted.";
	const reviewTitle =
		activeQuote && currency
			? `${formatCurrencyAmount(parsedAmount, currency)} to ${formatCurrencyAmount(
					activeQuote.toAmount,
					activeQuote.toCurrency,
				)}`
			: "Review swap";

	return (
		<WorkflowShell canClose={canClose} onClose={onClose} title="Swap funds">
			<WorkflowStep
				action={
					currency &&
					stage !== "processing_paused" &&
					stage !== "processing_animating" &&
					stage !== "done" ? (
						<button
							className="cursor-pointer text-text-secondary text-xs transition-colors hover:text-text"
							onClick={() => {
								setCurrency(null);
								setAmount("");
								setStage("input");
								resetQuoteFlow();
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
							No balance is available to swap.
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
									resetTransientState();
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
										resetTransientState();
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
									resetTransientState();
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
					title={reviewTitle}
				>
					<div className="space-y-4">
						{activeQuote ? (
							<SwapOutcomeCard
								context="standalone"
								fromAmount={parsedAmount}
								fromCurrency={currency}
								quote={activeQuote}
								status="pending"
								supportingLine={
									shouldUseLiveSwap
										? "Live Arc settlement example. This mirrors the onchain path StableFX enables at institutional scale."
										: undefined
								}
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
							disabled={!activeQuote}
							onClick={handleStartSwap}
							type="button"
						>
							Swap funds
						</button>
					</div>
				</WorkflowStep>
			) : null}

			{stage === "processing_paused" ||
			stage === "processing_animating" ||
			stage === "done" ? (
				<WorkflowStep
					action={
						stage === "processing_paused" && canUnpause ? (
							<button
								className="cursor-pointer text-text-secondary text-xs transition-colors hover:text-text"
								onClick={() => beginStableFxAnimation({ manual: true })}
								type="button"
							>
								Unpause
							</button>
						) : undefined
					}
					activeBadge="spinner"
					completedContent={
						activeQuote ? (
							<div className="space-y-4">
								<SwapOutcomeCard
									confirmationMs={completedSwap?.confirmationMs ?? undefined}
									context="standalone"
									fromAmount={parsedAmount}
									fromCurrency={currency ?? activeQuote.fromCurrency}
									linkLabel="View transaction"
									quote={activeQuote}
									status="complete"
									statusLine="Settled on Arc."
									supportingLine="Live Arc settlement example. This shows the onchain settlement path StableFX enables at institutional scale."
									toAmount={completedSwap?.amountOut ?? activeQuote.toAmount}
									toCurrency={activeQuote.toCurrency}
									txHash={completedSwap?.txHash}
								/>

								<button
									className="w-full cursor-pointer rounded-full bg-text py-3 font-medium text-bg transition-opacity hover:opacity-90"
									onClick={onClose}
									type="button"
								>
									Back to dashboard
								</button>
							</div>
						) : null
					}
					state={stage === "done" ? "completed" : "active"}
					stepLabel="Step 3"
					summary={processingSummary}
					title={processingTitle}
				>
					{activeQuote ? (
						<div className="space-y-4">
							<SwapOutcomeCard
								confirmationMs={
									stage === "done"
										? (completedSwap?.confirmationMs ?? undefined)
										: undefined
								}
								context="standalone"
								fromAmount={parsedAmount}
								fromCurrency={currency ?? activeQuote.fromCurrency}
								quote={activeQuote}
								status={
									stage === "processing_paused"
										? "paused"
										: stage === "done"
											? "complete"
											: "active"
								}
								statusLine={
									stage === "processing_paused"
										? "Preparing live Arc settlement."
										: stage === "done"
											? "Settled on Arc."
											: undefined
								}
								supportingLine={
									stage === "processing_paused"
										? "StableFX flow paused while the live trade is submitted."
										: stage === "processing_animating" && hasManuallyUnpaused
											? "StableFX resumed while the live Arc trade catches up."
											: stage === "done"
												? "Live Arc settlement example. This shows the onchain settlement path StableFX enables at institutional scale."
												: undefined
								}
								toAmount={
									stage === "done"
										? (completedSwap?.amountOut ?? activeQuote.toAmount)
										: activeQuote.toAmount
								}
								toCurrency={activeQuote.toCurrency}
								txHash={stage === "done" ? completedSwap?.txHash : undefined}
							/>

							{stage !== "done" ? (
								<div className="space-y-2 text-sm text-text-secondary">
									{liveSwapStatus === "running" ? (
										<p>StableFX is paused while Arc submits the live trade.</p>
									) : null}
								</div>
							) : null}
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
