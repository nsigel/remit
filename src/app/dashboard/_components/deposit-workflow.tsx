"use client";

import { ArrowUpDown, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
	ARC,
	CCTP_CHAINS,
	DEPOSIT_CURRENCIES,
	FX_RATES,
} from "~/lib/constants";
import {
	getDepositFlowDurationMs,
	STABLEFX_TOTAL_DURATION_MS,
	type StableFxQuoteSnapshot,
} from "~/lib/stablefx";
import { useTheme } from "~/lib/theme";
import { api } from "~/trpc/react";
import { DepositOutcomeCard } from "./deposit-outcome-card";
import { useStableFxQuote } from "./use-stablefx-quote";
import { WorkflowShell } from "./workflow-shell";
import { WorkflowStep } from "./workflow-step";
import { delay, formatAmount } from "./workflow-utils";

type NetworkChainTile =
	| { domain: number; icon: string }
	| { domain: number; arcLogo: true };

type DepositWorkflowProps = {
	canClose: boolean;
	onClose: () => void;
	onLockChange: (locked: boolean) => void;
};

type DepositStage = "input" | "processing" | "done";
type ProgressStatus = "pending" | "active" | "complete";

type CompletedTxState = {
	txHash: string;
	confirmationMs: number;
};

const RECOMMENDED_DEPOSIT_USDC_AMOUNTS = [5000, 15000, 22500] as const;

const NETWORK_ICON_GRID: NetworkChainTile[] = [
	{ icon: "/networks/Solana.svg", domain: 10 },
	{ domain: ARC.cctpDomain, arcLogo: true },
	{ icon: "/networks/HyperEVM.svg", domain: 19 },
	{ icon: "/networks/Base.svg", domain: 6 },
	{ icon: "/networks/Ethereum.svg", domain: 0 },
	{ icon: "/networks/Arbitrum.svg", domain: 3 },
	{ icon: "/networks/Optimism.svg", domain: 2 },
	{ icon: "/networks/Polygon.svg", domain: 7 },
];

function isArcNetworkTile(
	entry: NetworkChainTile,
): entry is { domain: number; arcLogo: true } {
	return "arcLogo" in entry && entry.arcLogo;
}

type RemitWalletLabelProps = {
	arcIconSrc: string;
	className?: string;
};

function RemitWalletLabel({ arcIconSrc, className }: RemitWalletLabelProps) {
	return (
		<span className={className ?? "inline-flex items-center gap-1.5"}>
			<span>Remit wallet</span>
			<Image
				alt=""
				aria-hidden
				className="shrink-0"
				height={14}
				src={arcIconSrc}
				unoptimized
				width={14}
			/>
		</span>
	);
}

export function DepositWorkflow({
	canClose,
	onClose,
	onLockChange,
}: DepositWorkflowProps) {
	const utils = api.useUtils();
	const { theme } = useTheme();
	const [stage, setStage] = useState<DepositStage>("input");
	const [selectedChain, setSelectedChain] = useState<
		(typeof CCTP_CHAINS)[number] | null
	>(null);
	const [currency, setCurrency] = useState<
		(typeof DEPOSIT_CURRENCIES)[number]["symbol"] | null
	>(null);
	const [amount, setAmount] = useState("");
	const [amountConfirmed, setAmountConfirmed] = useState(false);
	const [depositInOriginalCurrency, setDepositInOriginalCurrency] =
		useState(false);
	const [swapStatus, setSwapStatus] = useState<ProgressStatus>("pending");
	const [processingQuote, setProcessingQuote] =
		useState<StableFxQuoteSnapshot | null>(null);
	const [completedTx, setCompletedTx] = useState<CompletedTxState | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const initiate = api.deposit.initiate.useMutation();
	const progress = api.deposit.progress.useMutation();

	const selectedCurrency = DEPOSIT_CURRENCIES.find(
		(depositCurrency) => depositCurrency.symbol === currency,
	);
	const parsedAmount = Number.parseFloat(amount) || 0;
	const canReview =
		selectedChain != null &&
		currency != null &&
		parsedAmount > 0 &&
		amountConfirmed;
	const extraNetworkCount = CCTP_CHAINS.length - NETWORK_ICON_GRID.length;
	const arcFullLogoSrc =
		theme === "dark" ? "/Arc_Full_Logo_White.svg" : "/Arc_Full_Logo_Navy.svg";
	const arcIconSrc =
		theme === "dark" ? "/Arc_Icon_White.svg" : "/Arc_Icon_Navay.svg";
	const isArcSource =
		selectedChain != null && selectedChain.domain === ARC.cctpDomain;
	const shouldOfferSwap = currency != null && currency !== "USDC";
	const autoSwap = shouldOfferSwap && !depositInOriginalCurrency;
	const stableFx = useStableFxQuote({
		enabled: shouldOfferSwap,
		fromAmount: parsedAmount,
		fromCurrency: currency,
	});
	const reviewQuote = autoSwap ? stableFx.quote : null;
	const activeQuote = processingQuote ?? reviewQuote;
	const [now, setNow] = useState(() => Date.now());
	const settledAmount =
		activeQuote?.toAmount ?? (parsedAmount > 0 ? parsedAmount : 0);
	const settledCurrency = activeQuote?.toCurrency ?? currency ?? "USDC";
	const recommendedDepositAmounts = RECOMMENDED_DEPOSIT_USDC_AMOUNTS.map(
		(targetUsdcAmount) =>
			convertFromUsdcTarget({
				targetUsdcAmount,
				depositCurrency: currency ?? "USDC",
			}),
	);
	const expectedDurationMs = getDepositFlowDurationMs({
		arcNative: isArcSource,
		autoSwap,
	});
	const refreshCountdownSeconds =
		autoSwap && stableFx.nextRefreshAt != null && !stableFx.isRefreshing
			? Math.max(0, Math.ceil((stableFx.nextRefreshAt - now) / 1000))
			: null;

	useEffect(() => {
		if (!autoSwap || stableFx.nextRefreshAt == null || stableFx.isRefreshing) {
			return;
		}

		const intervalId = window.setInterval(() => {
			setNow(Date.now());
		}, 250);

		return () => window.clearInterval(intervalId);
	}, [autoSwap, stableFx.isRefreshing, stableFx.nextRefreshAt]);

	useEffect(() => {
		return () => onLockChange(false);
	}, [onLockChange]);

	const resetStepState = () => {
		setAmountConfirmed(false);
		setDepositInOriginalCurrency(false);
		setErrorMessage(null);
		setProcessingQuote(null);
		stableFx.resetQuote();
	};

	const handleEditChain = () => {
		if (!canClose) return;
		setSelectedChain(null);
		setCurrency(null);
		setAmount("");
		resetStepState();
	};

	const handleEditAmount = () => {
		if (!canClose) return;
		setAmountConfirmed(false);
		setErrorMessage(null);
		setProcessingQuote(null);
		stableFx.resetQuote();
	};

	const handleStartDeposit = async () => {
		if (!selectedChain || !currency || parsedAmount <= 0) return;

		const lockedQuote = autoSwap ? stableFx.lockQuote() : null;
		if (autoSwap && !lockedQuote) {
			setErrorMessage("StableFX quote is still loading.");
			return;
		}

		setErrorMessage(null);
		setCompletedTx(null);
		setProcessingQuote(lockedQuote);
		setStage("processing");
		setSwapStatus(autoSwap ? "pending" : "complete");
		onLockChange(true);

		try {
			const transaction = await initiate.mutateAsync({
				amount: parsedAmount,
				autoSwap,
				currency,
				settlementCurrency: autoSwap ? "USDC" : currency,
				sourceChainDomain: selectedChain.domain,
				swapQuote: lockedQuote ?? undefined,
			});

			const finalTx = await runBridge({
				arcNative: isArcSource,
				progress,
				transactionId: transaction.id,
			});

			if (finalTx.txHash && finalTx.confirmationMs != null) {
				setCompletedTx({
					txHash: finalTx.txHash,
					confirmationMs: finalTx.confirmationMs,
				});
			}

			if (autoSwap && lockedQuote) {
				setSwapStatus("active");
				await delay(STABLEFX_TOTAL_DURATION_MS);
				setSwapStatus("complete");
			}

			await Promise.all([
				utils.student.dashboard.invalidate(),
				utils.transaction.list.invalidate(),
				utils.invoice.get.invalidate(
					{ id: "current" },
					{ refetchType: "none" },
				),
			]);

			setStage("done");
			onLockChange(false);
		} catch (error) {
			setStage("input");
			setSwapStatus("pending");
			setCompletedTx(null);
			setProcessingQuote(null);
			stableFx.resetQuote();
			setErrorMessage(
				error instanceof Error
					? error.message
					: "Deposit could not be started.",
			);
			onLockChange(false);
		}
	};

	const outcomeStatus: ProgressStatus = autoSwap
		? stage === "done"
			? "complete"
			: swapStatus === "active"
				? "active"
				: "pending"
		: stage === "done"
			? "complete"
			: "active";

	const depositOutcomeCard =
		selectedChain && currency ? (
			<DepositOutcomeCard
				arrivalAmount={settledAmount}
				arrivalCurrency={settledCurrency}
				autoSwap={autoSwap}
				confirmationMs={completedTx?.confirmationMs}
				depositAmount={parsedAmount}
				depositCurrency={currency}
				quote={activeQuote}
				sourceChainName={selectedChain.name}
				status={outcomeStatus}
				txHash={completedTx?.txHash}
			/>
		) : null;

	const depositResolutionContent =
		stage !== "input" ? (
			<div className="space-y-4">
				{depositOutcomeCard}

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
		) : null;

	return (
		<WorkflowShell canClose={canClose} onClose={onClose} title="Deposit funds">
			<WorkflowStep
				action={
					selectedChain && stage === "input" ? (
						<button
							className="cursor-pointer text-text-secondary text-xs transition-colors hover:text-text"
							onClick={handleEditChain}
							type="button"
						>
							Edit
						</button>
					) : undefined
				}
				state={selectedChain && currency ? "completed" : "active"}
				stepLabel="Step 1"
				summary={
					selectedChain && selectedCurrency ? (
						<p className="text-sm text-text-secondary">
							{`${selectedChain.name} · ${selectedCurrency.symbol}`}
						</p>
					) : undefined
				}
				title={
					selectedChain && selectedCurrency
						? `${selectedChain.name} · ${selectedCurrency.symbol}`
						: "Choose source and currency"
				}
			>
				<div className="space-y-5">
					<div>
						<div className="mb-3 text-sm text-text-secondary">From</div>
						<div className="grid grid-cols-3 gap-2">
							{NETWORK_ICON_GRID.map((entry) => {
								const chain = CCTP_CHAINS.find(
									(item) => item.domain === entry.domain,
								);
								if (!chain) return null;

								const isSelected = selectedChain?.domain === entry.domain;
								const isArc = isArcNetworkTile(entry);
								const iconSrc = isArc ? arcFullLogoSrc : entry.icon;

								return (
									<button
										className={`flex aspect-square cursor-pointer items-center justify-center rounded-lg border p-2 transition-colors hover:bg-bg-secondary ${
											isSelected
												? "border-text ring-2 ring-text"
												: "border-border"
										}`}
										key={entry.domain}
										onClick={() => {
											setSelectedChain(chain);
											setAmount("");
											resetStepState();
										}}
										type="button"
									>
										<Image
											alt={chain.name}
											className={
												isArc
													? "max-h-9 w-auto max-w-full object-contain object-center"
													: "max-h-full max-w-full object-contain"
											}
											height={isArc ? 68 : 48}
											src={iconSrc}
											unoptimized
											width={isArc ? 200 : 48}
										/>
									</button>
								);
							})}
							{extraNetworkCount > 0 ? (
								<div
									aria-hidden
									className="flex aspect-square items-center justify-center rounded-lg border border-border bg-bg-secondary font-medium text-md text-text-secondary"
									title={`${extraNetworkCount} more networks`}
								>
									+{extraNetworkCount}
								</div>
							) : null}
						</div>
					</div>

					<div className="border-border border-t pt-4">
						<div className="mb-3 text-sm text-text-secondary">Deposit</div>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
							{DEPOSIT_CURRENCIES.map((depositCurrency) => (
								<button
									className={`cursor-pointer rounded-2xl border px-4 py-4 text-left transition-colors ${
										currency === depositCurrency.symbol
											? "border-text bg-text text-bg"
											: "border-border hover:bg-bg-secondary"
									}`}
									key={depositCurrency.symbol}
									onClick={() => {
										setCurrency(depositCurrency.symbol);
										setAmount("");
										resetStepState();
									}}
									type="button"
								>
									<div className="font-medium text-base">
										{depositCurrency.symbol}
									</div>
									<div
										className={
											currency === depositCurrency.symbol
												? "mt-1 text-bg/72 text-sm"
												: "mt-1 text-sm text-text-secondary"
										}
									>
										{depositCurrency.name}
									</div>
								</button>
							))}
						</div>
					</div>
				</div>
			</WorkflowStep>

			{selectedChain && currency ? (
				<WorkflowStep
					action={
						amountConfirmed && stage === "input" ? (
							<button
								className="cursor-pointer text-text-secondary text-xs transition-colors hover:text-text"
								onClick={handleEditAmount}
								type="button"
							>
								Edit
							</button>
						) : undefined
					}
					state={amountConfirmed ? "completed" : "active"}
					stepLabel="Step 2"
					summary={
						amountConfirmed ? (
							<p className="text-sm text-text-secondary">
								{formatCurrencyAmount(parsedAmount, currency)}
							</p>
						) : undefined
					}
					title={
						amountConfirmed && currency
							? `${formatAmount(parsedAmount)} ${currency}`
							: "Enter amount"
					}
				>
					<div className="space-y-4">
						<input
							className="w-full rounded-3xl border border-border bg-bg px-4 py-4 text-4xl tabular-nums outline-none transition-colors focus:border-text"
							inputMode="decimal"
							onChange={(event) => {
								const nextAmount = event.target.value.replaceAll(",", "");
								if (nextAmount && !/^\d*\.?\d*$/.test(nextAmount)) {
									return;
								}

								setAmount(nextAmount);
								setAmountConfirmed(false);
								setProcessingQuote(null);
								stableFx.resetQuote();
							}}
							placeholder="0.00"
							type="text"
							value={formatAmountInputForDisplay(amount)}
						/>

						<div className="flex flex-wrap gap-2">
							{recommendedDepositAmounts.map((preset, index) => (
								<button
									className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:bg-bg-secondary"
									key={RECOMMENDED_DEPOSIT_USDC_AMOUNTS[index]}
									onClick={() => {
										setAmount(preset.toString());
										setAmountConfirmed(false);
										setProcessingQuote(null);
										stableFx.resetQuote();
									}}
									type="button"
								>
									{formatCurrencyAmount(preset, currency)}
								</button>
							))}
						</div>

						{parsedAmount > 0 ? (
							<p className="border-border border-t pt-4 text-sm text-text-secondary">
								{`From ${selectedChain.name} into `}
								<RemitWalletLabel
									arcIconSrc={arcIconSrc}
									className="inline-flex items-center gap-1.5 font-medium text-text"
								/>
							</p>
						) : null}

						<button
							className="w-full cursor-pointer rounded-full bg-text py-3 font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
							disabled={parsedAmount <= 0}
							onClick={() => {
								setAmountConfirmed(true);
								setErrorMessage(null);
							}}
							type="button"
						>
							Continue
						</button>
					</div>
				</WorkflowStep>
			) : null}

			{canReview && currency ? (
				<WorkflowStep
					state={stage === "input" ? "active" : "completed"}
					stepLabel="Step 3"
					title="Review deposit"
				>
					<div className="space-y-4 text-sm">
						<div className="rounded-[1.6rem] border border-border bg-bg px-4 py-5 sm:px-5">
							<div className="flex items-start justify-between gap-4">
								<p className="font-serif text-2xl text-text leading-none">
									Swapping with StableFX
								</p>
								{autoSwap ? (
									<RateRefreshIndicator
										countdownSeconds={refreshCountdownSeconds}
										isRefreshing={stableFx.isRefreshing}
									/>
								) : null}
							</div>

							<div className="mt-5">
								{autoSwap ? (
									<div className="space-y-3">
										<ReviewCurrencyLeg
											amount={parsedAmount}
											currency={currency}
											label="You send"
										/>
										<div className="flex justify-center">
											<div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-secondary text-text">
												<ArrowUpDown className="h-4 w-4" strokeWidth={1.8} />
											</div>
										</div>
										<ReviewCurrencyLeg
											amount={settledAmount}
											currency={settledCurrency}
											label="You receive"
										/>
									</div>
								) : (
									<ReviewCurrencyLeg
										amount={settledAmount}
										currency={settledCurrency}
										label="Arrives as"
									/>
								)}
							</div>

							<div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-border border-t pt-4 text-sm text-text-secondary">
								<span>{`About ${(expectedDurationMs / 1000).toFixed(1)}s`}</span>
								{autoSwap && reviewQuote ? (
									<span>{formatRate(reviewQuote)}</span>
								) : null}
								{!autoSwap ? (
									<span>
										{isArcSource ? "Direct Arc credit" : "Arc settlement"}
									</span>
								) : null}
							</div>
						</div>

						{shouldOfferSwap ? (
							<label className="flex cursor-pointer items-start gap-3 rounded-[1.35rem] border border-border bg-bg px-4 py-4">
								<input
									checked={depositInOriginalCurrency}
									className="mt-1 h-4 w-4 accent-[var(--fg)]"
									onChange={(event) =>
										setDepositInOriginalCurrency(event.target.checked)
									}
									type="checkbox"
								/>
								<span className="block">
									<span className="block font-medium text-base text-text">
										Deposit in original currency
									</span>
									<span className="mt-1 block text-sm text-text-secondary">
										Wait for a better rate.
									</span>
								</span>
							</label>
						) : null}

						{errorMessage ? (
							<p className="text-danger">{errorMessage}</p>
						) : null}

						<button
							className="w-full cursor-pointer rounded-full bg-text py-3 font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
							disabled={initiate.isPending || progress.isPending}
							onClick={handleStartDeposit}
							type="button"
						>
							{initiate.isPending ? "Starting deposit..." : "Deposit funds"}
						</button>
					</div>
				</WorkflowStep>
			) : null}

			{stage !== "input" ? (
				<WorkflowStep
					activeBadge="spinner"
					completedContent={depositResolutionContent}
					state={stage === "processing" ? "active" : "completed"}
					stepLabel="Step 4"
					summary="Deposit settled."
					title={
						stage === "processing" ? "Deposit in motion" : "Deposit complete"
					}
				>
					{depositResolutionContent}
				</WorkflowStep>
			) : null}
		</WorkflowShell>
	);
}

async function runBridge({
	arcNative,
	progress,
	transactionId,
}: {
	arcNative: boolean;
	progress: ReturnType<typeof api.deposit.progress.useMutation>;
	transactionId: string;
}) {
	if (arcNative) {
		const arcPairDelays = [400, 500, 400, 500];
		let result: Awaited<ReturnType<typeof progress.mutateAsync>> | null = null;

		for (let visualStep = 0; visualStep < 2; visualStep++) {
			await delay(arcPairDelays[visualStep * 2] ?? 400);
			result = await progress.mutateAsync({ transactionId });
			await delay(arcPairDelays[visualStep * 2 + 1] ?? 500);
			result = await progress.mutateAsync({ transactionId });
		}

		if (!result) {
			throw new Error("Arc credit did not return a transaction.");
		}

		return result;
	}

	const cctpDelays = [250, 250, 3000, 1000];
	let result: Awaited<ReturnType<typeof progress.mutateAsync>> | null = null;

	for (let index = 0; index < 4; index++) {
		await delay(cctpDelays[index] ?? 1000);
		result = await progress.mutateAsync({ transactionId });
	}

	if (!result) {
		throw new Error("Bridge progress did not return a transaction.");
	}

	return result;
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

function formatAmountInputForDisplay(value: string) {
	if (!value) return "";

	const [rawIntegerPart = "", fractionalPart] = value.split(".");
	const integerPart = rawIntegerPart === "" ? "0" : rawIntegerPart;
	const formattedIntegerPart = Number.parseInt(integerPart, 10).toLocaleString(
		"en-US",
	);

	if (fractionalPart == null) {
		return formattedIntegerPart;
	}

	return `${formattedIntegerPart}.${fractionalPart}`;
}

function convertFromUsdcTarget({
	targetUsdcAmount,
	depositCurrency,
}: {
	targetUsdcAmount: number;
	depositCurrency: string;
}) {
	const rateToUsdc = FX_RATES[depositCurrency];
	if (rateToUsdc == null || rateToUsdc <= 0) {
		return targetUsdcAmount;
	}

	const convertedAmount = targetUsdcAmount / rateToUsdc;
	if (depositCurrency === "JPYC") {
		return Math.round(convertedAmount);
	}

	return Number(convertedAmount.toFixed(2));
}

function formatRate(quote: StableFxQuoteSnapshot) {
	return `1 ${quote.fromCurrency} = ${quote.rate.toLocaleString("en-US", {
		minimumFractionDigits: 4,
		maximumFractionDigits: 4,
	})} ${quote.toCurrency}`;
}

function ReviewCurrencyLeg({
	amount,
	currency,
	label,
}: {
	amount: number;
	currency: string;
	label: string;
}) {
	const iconSrc = getStablecoinIconSrc(currency);

	return (
		<div className="flex items-center justify-between gap-4 rounded-[1.2rem] bg-bg-secondary/70 px-4 py-4">
			<div>
				<div className="text-sm text-text-secondary">{label}</div>
				<div className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-1.5 text-sm text-text">
					{iconSrc ? (
						<Image
							alt=""
							aria-hidden
							className="h-4 w-4 shrink-0"
							height={16}
							src={iconSrc}
							unoptimized
							width={16}
						/>
					) : null}
					<span className="font-medium">{currency}</span>
				</div>
			</div>
			<div className="text-right font-serif text-[2rem] text-text leading-none sm:text-[2.3rem]">
				{formatCurrencyAmount(amount, currency)}
			</div>
		</div>
	);
}

function RateRefreshIndicator({
	countdownSeconds,
	isRefreshing,
}: {
	countdownSeconds: number | null;
	isRefreshing: boolean;
}) {
	return (
		<div className="flex min-h-8 min-w-8 items-center justify-center rounded-full px-2.5 text-text-secondary text-xs">
			{isRefreshing ? (
				<LoaderCircle className="h-3.5 w-3.5 animate-spin text-text" />
			) : (
				<span>{countdownSeconds ?? 0}s</span>
			)}
		</div>
	);
}

function getStablecoinIconSrc(currency: string) {
	if (currency === "USDC") return "/usdc.svg";
	if (currency === "EURC") return "/eurc.svg";
	if (currency === "JPYC") return "/jpyc.svg";

	return null;
}
