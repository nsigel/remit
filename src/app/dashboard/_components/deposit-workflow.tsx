"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { ARC, CCTP_CHAINS, DEPOSIT_CURRENCIES } from "~/lib/constants";
import { api } from "~/trpc/react";
import { WorkflowShell } from "./workflow-shell";
import { WorkflowStep } from "./workflow-step";
import { delay, formatAmount } from "./workflow-utils";

type DepositWorkflowProps = {
	canClose: boolean;
	onClose: () => void;
	onLockChange: (locked: boolean) => void;
};

type DepositStage = "input" | "bridging" | "done";

export function DepositWorkflow({
	canClose,
	onClose,
	onLockChange,
}: DepositWorkflowProps) {
	const utils = api.useUtils();
	const [stage, setStage] = useState<DepositStage>("input");
	const [selectedChain, setSelectedChain] = useState<
		(typeof CCTP_CHAINS)[number] | null
	>(null);
	const [currency, setCurrency] = useState<
		(typeof DEPOSIT_CURRENCIES)[number]["symbol"] | null
	>(null);
	const [amount, setAmount] = useState("");
	const [amountConfirmed, setAmountConfirmed] = useState(false);
	const [search, setSearch] = useState("");
	const [currentBridgeStep, setCurrentBridgeStep] = useState(-1);
	const [completedTx, setCompletedTx] = useState<{
		txHash: string;
		blockNumber: number;
		confirmationMs: number;
	} | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const initiate = api.deposit.initiate.useMutation();
	const progress = api.deposit.progress.useMutation();

	const popularChains = CCTP_CHAINS.filter((chain) => chain.popular);
	const otherChains = CCTP_CHAINS.filter((chain) => !chain.popular);
	const filteredOther = search
		? otherChains.filter((chain) =>
				chain.name.toLowerCase().includes(search.toLowerCase()),
			)
		: otherChains;
	const selectedCurrency = DEPOSIT_CURRENCIES.find(
		(depositCurrency) => depositCurrency.symbol === currency,
	);
	const parsedAmount = Number.parseFloat(amount) || 0;
	const canReview =
		selectedChain != null &&
		currency != null &&
		parsedAmount > 0 &&
		amountConfirmed;
	const bridgeSteps = [
		`Approve on ${selectedChain?.name ?? "source chain"}`,
		`Burn on ${selectedChain?.name ?? "source chain"}`,
		"Circle attestation",
		"Mint on Arc",
	];

	useEffect(() => {
		return () => onLockChange(false);
	}, [onLockChange]);

	const resetAfter = useCallback(
		(callback: () => void) => {
			if (!canClose) return;
			callback();
		},
		[canClose],
	);

	const handleEditChain = () =>
		resetAfter(() => {
			setSelectedChain(null);
			setCurrency(null);
			setAmount("");
			setSearch("");
			setAmountConfirmed(false);
			setErrorMessage(null);
		});

	const handleEditCurrency = () =>
		resetAfter(() => {
			setCurrency(null);
			setAmount("");
			setAmountConfirmed(false);
			setErrorMessage(null);
		});

	const handleEditAmount = () =>
		resetAfter(() => {
			setAmountConfirmed(false);
			setErrorMessage(null);
		});

	const runBridge = useCallback(
		async (transactionId: string) => {
			const delays = [1500, 2000, 3000, 1000];

			for (let index = 0; index < bridgeSteps.length; index++) {
				await delay(delays[index] ?? 1000);
				const result = await progress.mutateAsync({ transactionId });
				setCurrentBridgeStep(index);

				if (
					result.status === "CONFIRMED" &&
					result.txHash &&
					result.blockNumber != null &&
					result.confirmationMs != null
				) {
					setCompletedTx({
						txHash: result.txHash,
						blockNumber: result.blockNumber,
						confirmationMs: result.confirmationMs,
					});
				}
			}

			await Promise.all([
				utils.student.dashboard.invalidate(),
				utils.transaction.list.invalidate(),
				utils.invoice.get.invalidate({ id: "current" }),
			]);
			setStage("done");
			onLockChange(false);
		},
		[
			bridgeSteps.length,
			onLockChange,
			progress,
			utils.invoice.get,
			utils.student.dashboard,
			utils.transaction.list,
		],
	);

	const handleStartDeposit = async () => {
		if (!selectedChain || !currency || parsedAmount <= 0) return;

		setErrorMessage(null);
		setStage("bridging");
		setCurrentBridgeStep(-1);
		setCompletedTx(null);
		onLockChange(true);

		try {
			const transaction = await initiate.mutateAsync({
				amount: parsedAmount,
				currency,
				sourceChainDomain: selectedChain.domain,
			});

			await runBridge(transaction.id);
		} catch (error) {
			setStage("input");
			setCurrentBridgeStep(-1);
			setCompletedTx(null);
			setErrorMessage(
				error instanceof Error
					? error.message
					: "Deposit could not be started.",
			);
			onLockChange(false);
		}
	};

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
				state={selectedChain ? "completed" : "active"}
				stepLabel="Step 1"
				summary={
					selectedChain ? (
						<p className="text-sm text-text-secondary">Source chain</p>
					) : undefined
				}
				title={selectedChain?.name ?? "Choose chain"}
			>
				<div className="space-y-4">
					<div className="grid gap-2">
						{popularChains.map((chain) => (
							<button
								className="flex cursor-pointer items-center justify-between rounded-2xl border border-border px-4 py-3 text-left transition-colors hover:bg-bg-secondary"
								key={chain.domain}
								onClick={() => {
									setSelectedChain(chain);
									setCurrency(null);
									setAmount("");
									setSearch("");
									setAmountConfirmed(false);
									setErrorMessage(null);
								}}
								type="button"
							>
								<span className="font-medium">{chain.name}</span>
							</button>
						))}
					</div>

					<div>
						<input
							className="w-full rounded-2xl border border-border bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-text"
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search chains"
							type="text"
							value={search}
						/>
						<div className="mt-3 space-y-1">
							{filteredOther.map((chain) => (
								<button
									className="w-full cursor-pointer rounded-2xl px-4 py-2.5 text-left text-sm transition-colors hover:bg-bg-secondary"
									key={chain.domain}
									onClick={() => {
										setSelectedChain(chain);
										setCurrency(null);
										setAmount("");
										setSearch("");
										setAmountConfirmed(false);
										setErrorMessage(null);
									}}
									type="button"
								>
									{chain.name}
								</button>
							))}
						</div>
					</div>
				</div>
			</WorkflowStep>

			{selectedChain ? (
				<WorkflowStep
					action={
						currency && stage === "input" ? (
							<button
								className="cursor-pointer text-text-secondary text-xs transition-colors hover:text-text"
								onClick={handleEditCurrency}
								type="button"
							>
								Edit
							</button>
						) : undefined
					}
					state={currency ? "completed" : "active"}
					stepLabel="Step 2"
					summary={
						selectedCurrency ? (
							<p className="text-sm text-text-secondary">
								{selectedCurrency.name}
							</p>
						) : undefined
					}
					title={selectedCurrency?.symbol ?? "Choose currency"}
				>
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
									setAmountConfirmed(false);
									setErrorMessage(null);
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
				</WorkflowStep>
			) : null}

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
					stepLabel="Step 3"
					summary={
						amountConfirmed ? (
							<p className="text-sm text-text-secondary">Deposit amount</p>
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
							min="0"
							onChange={(event) => {
								setAmount(event.target.value);
								setAmountConfirmed(false);
							}}
							placeholder="0.00"
							step="0.01"
							type="number"
							value={amount}
						/>

						<div className="flex flex-wrap gap-2">
							{[5000, 15000, 22500].map((preset) => (
								<button
									className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:bg-bg-secondary"
									key={preset}
									onClick={() => {
										setAmount(preset.toString());
										setAmountConfirmed(false);
									}}
									type="button"
								>
									${preset.toLocaleString()}
								</button>
							))}
						</div>

						{parsedAmount > 0 ? (
							<div className="space-y-2 border-border border-t pt-4 text-sm">
								<div className="flex justify-between gap-4">
									<span className="text-text-secondary">Source chain</span>
									<span>{selectedChain.name}</span>
								</div>
								<div className="flex justify-between gap-4 font-medium">
									<span>Arrives on Arc</span>
									<span>
										{formatAmount(parsedAmount)} {currency}
									</span>
								</div>
							</div>
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

			{canReview ? (
				<WorkflowStep
					state={stage === "input" ? "active" : "completed"}
					stepLabel="Step 4"
					summary={
						<div className="space-y-1">
							<div className="flex items-center justify-between gap-4">
								<span>Source chain</span>
								<span className="font-medium text-text">
									{selectedChain?.name}
								</span>
							</div>
							<div className="flex items-center justify-between gap-4">
								<span>Destination</span>
								<span className="font-medium text-text">Arc wallet</span>
							</div>
							<div className="flex items-center justify-between gap-4">
								<span>Deposit</span>
								<span className="font-medium text-text">
									{formatAmount(parsedAmount)} {currency}
								</span>
							</div>
						</div>
					}
					title="Review deposit"
				>
					<div className="space-y-4 text-sm">
						<div className="space-y-3 border-border border-y py-4">
							<div className="flex justify-between gap-4">
								<span className="text-text-secondary">From</span>
								<span>{selectedChain?.name}</span>
							</div>
							<div className="flex justify-between gap-4">
								<span className="text-text-secondary">Currency</span>
								<span>{currency}</span>
							</div>
							<div className="flex justify-between gap-4">
								<span className="text-text-secondary">Amount</span>
								<span>{formatAmount(parsedAmount)}</span>
							</div>
							<div className="flex justify-between gap-4">
								<span className="text-text-secondary">Destination</span>
								<span>Arc wallet</span>
							</div>
						</div>

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
					state={stage === "bridging" ? "active" : "completed"}
					stepLabel="Step 5"
					summary="All bridge milestones completed on Arc."
					title={stage === "bridging" ? "Deposit progress" : "Deposit complete"}
				>
					<div className="space-y-3">
						{bridgeSteps.map((label, index) => {
							const isDone = index <= currentBridgeStep;
							const isCurrent = index === currentBridgeStep + 1;

							return (
								<div
									className="flex items-center gap-3 border-border border-b py-2.5 last:border-b-0"
									key={label}
								>
									<span
										className={
											isDone
												? "flex h-5 w-5 flex-none items-center justify-center rounded-full bg-success text-bg"
												: isCurrent
													? "flex h-5 w-5 flex-none items-center justify-center rounded-full border border-text/15 bg-bg-secondary text-text"
													: "flex h-5 w-5 flex-none items-center justify-center rounded-full border border-border bg-bg text-text-secondary/70"
										}
									>
										{isDone ? (
											<Check className="h-3.5 w-3.5" />
										) : isCurrent ? (
											<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
										) : (
											<span className="h-2 w-2 rounded-full bg-current" />
										)}
									</span>
									<span>{label}</span>
								</div>
							);
						})}
					</div>
				</WorkflowStep>
			) : null}

			{stage === "done" && completedTx ? (
				<WorkflowStep state="active" stepLabel="Step 6" title="Funds arrived">
					<div className="space-y-4 text-sm">
						<div className="rounded-3xl bg-success/8 px-4 py-4">
							<div className="font-serif text-2xl">
								{formatAmount(parsedAmount)} {currency}
							</div>
							<p className="mt-2 text-text-secondary">Now on Arc.</p>
						</div>

						<div className="space-y-2">
							<div className="flex justify-between gap-4">
								<span className="text-text-secondary">Confirmed in</span>
								<span>{(completedTx.confirmationMs / 1000).toFixed(2)}s</span>
							</div>
							<div className="flex justify-between gap-4">
								<span className="text-text-secondary">Block</span>
								<span>#{completedTx.blockNumber.toLocaleString()}</span>
							</div>
							<div className="flex justify-between gap-4">
								<span className="text-text-secondary">Transaction</span>
								<a
									className="cursor-pointer truncate transition-colors hover:text-text"
									href={`${ARC.explorer}/tx/${completedTx.txHash}`}
									rel="noopener noreferrer"
									target="_blank"
								>
									{completedTx.txHash.slice(0, 14)}...
								</a>
							</div>
						</div>

						<button
							className="w-full cursor-pointer rounded-full bg-text py-3 font-medium text-bg transition-opacity hover:opacity-90"
							onClick={onClose}
							type="button"
						>
							Back to dashboard
						</button>
					</div>
				</WorkflowStep>
			) : null}
		</WorkflowShell>
	);
}
