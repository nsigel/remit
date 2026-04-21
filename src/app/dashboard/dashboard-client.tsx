"use client";

import { AnimatePresence } from "framer-motion";
import { Check, FastForward, PlusIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { DemoActiveEscrowPlan } from "~/lib/demo-model";
import { ARC } from "~/lib/constants";
import { useDemoSession } from "~/lib/demo-session";
import { getPaymentPower } from "~/lib/payment-plan";
import { useTheme } from "~/lib/theme";
import { ThemeToggle } from "../_components/theme-toggle";
import { DashboardHeader } from "./_components/dashboard-header";
import { DepositWorkflow } from "./_components/deposit-workflow";
import { FooterAttribution } from "./_components/footer-attribution";
import { HeroCard } from "./_components/hero-card";
import { PayWorkflow } from "./_components/pay-workflow";
import { SwapWorkflow } from "./_components/swap-workflow";
import {
	formatAmount,
	formatDate,
	formatDisplayAmount,
	getMinimumPayment,
	isAutoSwapDeposit,
	txLabel,
} from "./_components/workflow-utils";

function CircleLogo() {
	const { theme } = useTheme();
	return (
		<Image
			alt="Circle"
			className="block h-2.5 w-auto"
			height={10}
			src={
				theme === "dark" ? "/circle-logo-white.svg" : "/circle-logo-2021.svg"
			}
			unoptimized
			width={40}
		/>
	);
}

type ActiveWorkflow = "none" | "deposit" | "pay-current" | "swap";
type DemoStepState = "completed" | "current" | "upcoming";

/** Shared tap row: stable sizing for main summary CTA buttons. */
const DASHBOARD_CTA_ROW =
	"inline-flex w-full min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-medium leading-none";
const DASHBOARD_CTA_PRIMARY = `${DASHBOARD_CTA_ROW} bg-text text-bg transition-opacity hover:opacity-90`;

function TuitionColumnActions({
	canPayNow,
	totalDue,
	onOpenDeposit,
	onOpenPay,
}: {
	canPayNow: boolean;
	totalDue: number;
	onOpenDeposit: () => void;
	onOpenPay: () => void;
}) {
	if (!canPayNow) {
		return (
			<button
				className={DASHBOARD_CTA_PRIMARY}
				onClick={onOpenDeposit}
				type="button"
			>
				Add funds
			</button>
		);
	}

	return (
		<button className={DASHBOARD_CTA_PRIMARY} onClick={onOpenPay} type="button">
			Pay ${formatAmount(totalDue)}
		</button>
	);
}

function WalletDepositAction({
	isDepositActive,
	isSwapActive,
	onOpenDeposit,
	onOpenSwap,
}: {
	isDepositActive: boolean;
	isSwapActive: boolean;
	onOpenDeposit: () => void;
	onOpenSwap: () => void;
}) {
	const depositClass = isDepositActive
		? "inline-flex min-h-11 flex-[5] cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border bg-bg px-5 font-medium text-sm leading-none text-text transition-colors hover:bg-bg-secondary"
		: "inline-flex min-h-11 flex-[5] cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border bg-bg px-5 font-medium text-sm leading-none text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text";

	return (
		<div className="flex items-center gap-2">
			<button className={depositClass} onClick={onOpenDeposit} type="button">
				<PlusIcon className="h-3.5 w-3.5 shrink-0 opacity-90" />
				Deposit
			</button>
			<button
				aria-pressed={isSwapActive}
				className={`inline-flex min-h-11 flex-1 shrink-0 cursor-pointer items-center justify-center rounded-full border px-5 font-medium text-sm leading-none transition-colors ${
					isSwapActive
						? "border-text bg-text text-bg shadow-[0_10px_20px_rgba(10,10,10,0.14)] hover:opacity-90"
						: "border-border bg-bg text-text-secondary hover:bg-bg-secondary hover:text-text"
				}`}
				onClick={onOpenSwap}
				type="button"
			>
				Swap
			</button>
		</div>
	);
}

export function DashboardClient() {
	const router = useRouter();
	const { actions, hasSession, selectors, status } = useDemoSession();
	const [activeWorkflow, setActiveWorkflow] = useState<ActiveWorkflow>("none");
	const [workflowLocked, setWorkflowLocked] = useState(false);
	const [isResetting, setIsResetting] = useState(false);

	const data = selectors.dashboard();

	useEffect(() => {
		if (status !== "ready" || hasSession || isResetting) return;
		router.replace("/demo");
	}, [hasSession, isResetting, router, status]);

	if (status !== "ready") {
		return (
			<main className="flex min-h-dvh items-center justify-center">
				<span className="text-text-secondary">Loading...</span>
			</main>
		);
	}

	if (!data) {
		return null;
	}

	const { student, balances, invoices, transactions } = data;
	const paymentPower = getPaymentPower(balances, "USDC");
	const openStatements = invoices.filter(
		(invoice) => invoice.status === "UNPAID",
	);
	const totalDue = openStatements.reduce(
		(sum, invoice) => sum + invoice.amount,
		0,
	);
	const coveragePercent =
		totalDue > 0
			? Math.min(100, Math.max(0, Math.round((paymentPower / totalDue) * 100)))
			: 100;
	const shortfallAmount = Math.max(totalDue - paymentPower, 0);
	const nextDueDate = openStatements[0]?.dueDate;
	const minimumPayment = getMinimumPayment(totalDue);
	const canPayNow = totalDue > 0 && paymentPower >= totalDue;
	const workflowOpen = activeWorkflow !== "none";
	const isDepositFlowActive = activeWorkflow === "deposit";
	const contentWidthClass = workflowOpen
		? "lg:max-w-[880px] lg:flex-1"
		: "lg:mx-auto lg:max-w-[880px]";
	/** Step 5 = demo flow finished (nothing due → step 4 checked off). */
	const currentDemoStep =
		totalDue === 0
			? 5
			: activeWorkflow === "deposit"
				? 2
				: activeWorkflow === "swap"
					? 3
					: canPayNow
						? 4
						: 2;
	const activeEscrowPlan = data.activeEscrowPlan;
	const handleAdvancePaymentPlan = () => {
		try {
			actions.advancePaymentPlanInstallment();
			toast.success(
				"Your payment was processed automatically from escrow for installment.",
				{
					icon: <Check className="h-3.5 w-3.5" />,
				},
			);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "The next installment could not be processed.",
			);
		}
	};

	const openWorkflow = (workflow: ActiveWorkflow) => {
		if (workflowLocked) return;
		setActiveWorkflow(workflow);
	};

	const closeWorkflow = () => {
		if (workflowLocked && activeWorkflow !== "pay-current") return;
		setActiveWorkflow("none");
	};

	if (activeWorkflow === "pay-current") {
		return (
			<main className="min-h-dvh overflow-x-clip">
				<DashboardHeader
					rightSlot={
						<>
							<span className="hidden text-sm text-text-secondary sm:inline">
								{student.name}
							</span>
							<ThemeToggle />
							<button
								className="cursor-pointer text-sm text-text-secondary transition-colors hover:text-danger"
								onClick={() => {
									setIsResetting(true);
									actions.reset();
									window.location.assign("/");
								}}
								type="button"
							>
								Reset
							</button>
						</>
					}
				/>

				<PayWorkflow
					canClose={!workflowLocked}
					onClose={closeWorkflow}
					onLockChange={setWorkflowLocked}
					onOpenDeposit={() => openWorkflow("deposit")}
				/>
			</main>
		);
	}

	return (
		<main className="min-h-dvh overflow-x-clip">
			<DashboardHeader
				rightSlot={
					<>
						<span className="hidden text-sm text-text-secondary sm:inline">
							{student.name}
						</span>
						<ThemeToggle />
						<button
							className="cursor-pointer text-sm text-text-secondary transition-colors hover:text-danger"
							onClick={() => {
								setIsResetting(true);
								actions.reset();
								window.location.assign("/");
							}}
							type="button"
						>
							Reset
						</button>
					</>
				}
			/>

			<div className="mx-auto max-w-[1380px] px-5 py-7 sm:px-8 sm:py-10">
				<div className="flex flex-col gap-8 lg:flex-row lg:items-start">
					<div className={`w-full ${contentWidthClass}`}>
						<div className="space-y-8">
							<section>
								<HeroCard
									fromCity="International"
									university={student.university.name}
								/>
							</section>

							<section>
								<DemoFlowSection currentStep={currentDemoStep} />
							</section>

							<section className="border-border border-t pt-7">
								{activeEscrowPlan ? (
									<ActivePaymentPlanBanner
										accountBalance={paymentPower}
										balanceDue={totalDue}
										escrowPlan={activeEscrowPlan}
										onAdvanceInstallment={handleAdvancePaymentPlan}
									/>
								) : null}
								<div className="rounded-4xl border border-border bg-bg-secondary/50 px-5 py-5 sm:px-6 sm:py-6">
									<div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
										<section className="flex min-w-0 flex-col">
											<div className="flex items-center gap-2 text-md text-text-secondary">
												Remit balance
											</div>
											<div className="mt-2 font-serif text-4xl tabular-nums leading-none sm:text-[3.25rem]">
												${formatAmount(paymentPower)}
											</div>
											<div className="mt-5">
												<div
													aria-label="Balance coverage"
													aria-valuemax={100}
													aria-valuemin={0}
													aria-valuenow={coveragePercent}
													className="h-2 overflow-hidden rounded-full bg-bg"
													role="progressbar"
												>
													<div
														className="h-full rounded-full bg-text/80 transition-[width]"
														style={{ width: `${coveragePercent}%` }}
													/>
												</div>
												<div className="mt-2 flex items-center justify-between gap-2 text-text-secondary text-xs">
													<span className="tabular-nums">{`${coveragePercent}% of $${formatAmount(totalDue)} covered`}</span>
													{coveragePercent < 100 ? (
														<span className="tabular-nums">{`Short $${formatAmount(shortfallAmount)}`}</span>
													) : null}
												</div>
											</div>
											<div className=" pt-5">
												<WalletDepositAction
													isDepositActive={activeWorkflow === "deposit"}
													isSwapActive={activeWorkflow === "swap"}
													onOpenDeposit={() => openWorkflow("deposit")}
													onOpenSwap={() => openWorkflow("swap")}
												/>
												<div className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
													<div
														aria-hidden="true"
														className="inline-block h-1.5 w-1.5 rounded-full bg-text"
													/>
													Live FX via StableFX
													<span className="mx-0.5">&middot;</span>
													<CircleLogo />
												</div>
											</div>
										</section>

										<section className="flex min-w-0 flex-col">
											<div className="text-md text-text-secondary">
												Amount due
											</div>
											<div className="mt-2 font-serif text-4xl tabular-nums leading-none sm:text-[3.25rem]">
												${formatAmount(totalDue)}
											</div>
											<div className="mt-2 space-y-1 text-sm text-text-secondary">
												{openStatements.length > 0 ? (
													<>
														<div>Due {formatDate(nextDueDate)}</div>
														<div>
															Minimum payment ${formatAmount(minimumPayment)}
														</div>
													</>
												) : (
													<div>Nothing open</div>
												)}
											</div>
											<div className="mt-aut pt-5">
												{openStatements.length > 0 ? (
													<TuitionColumnActions
														canPayNow={canPayNow}
														onOpenDeposit={() => openWorkflow("deposit")}
														onOpenPay={() => openWorkflow("pay-current")}
														totalDue={totalDue}
													/>
												) : null}
											</div>
										</section>
									</div>
								</div>
							</section>

							<section className="border-border border-t pt-7">
								<div className="flex items-baseline justify-between gap-4">
									<h2 className="font-serif text-3xl">Statements</h2>
									<span className="text-sm text-text-secondary">
										{openStatements.length > 0
											? `${openStatements.length} open`
											: "All paid"}
									</span>
								</div>

								<div
									className={`mt-5 divide-y divide-border ${
										isDepositFlowActive
											? "overflow-hidden rounded-[1.25rem] border border-border bg-bg-secondary/45"
											: "border-border border-y"
									}`}
								>
									{invoices.map((invoice) => (
										<StatementRow
											invoice={invoice}
											key={invoice.id}
											secondary={isDepositFlowActive}
										/>
									))}
								</div>
							</section>

							{transactions.length > 0 ? (
								<section className="border-border border-t pt-7">
									<div className="mb-4 flex items-baseline justify-between gap-4">
										<h2 className="font-serif text-2xl">Recent activity</h2>
										<Link
											className="cursor-pointer text-sm text-text-secondary transition-colors hover:text-text"
											href="/dashboard/history"
										>
											See all
										</Link>
									</div>

									<div className="divide-y divide-border border-border border-y">
										{transactions.map((tx) => (
											<div
												className="flex items-center justify-between gap-6 py-3"
												key={tx.id}
											>
												<div>
													<div className="font-medium text-sm">
														{txLabel(
															tx.type,
															tx.sourceChain,
															tx.fromCurrency,
															tx.toCurrency,
														)}
													</div>
													<TransactionMeta tx={tx} />
												</div>
												<div className="text-right tabular-nums">
													<div
														className={
															tx.type === "DEPOSIT" ? "text-success" : ""
														}
													>
														{getTransactionAmountPrefix(tx)}
														{formatDisplayAmount(
															getTransactionDisplayAmount(tx),
															getTransactionDisplayCurrency(tx),
														)}
													</div>
													<div className="text-text-secondary text-xs">
														{getTransactionDisplayCurrency(tx)}
													</div>
												</div>
											</div>
										))}
									</div>
								</section>
							) : null}

							<section className="border-border border-t pt-5">
								<FooterAttribution />
							</section>
						</div>
					</div>

					<AnimatePresence mode="wait">
						{activeWorkflow === "deposit" ? (
							<DepositWorkflow
								canClose={!workflowLocked}
								key="deposit"
								onClose={closeWorkflow}
								onLockChange={setWorkflowLocked}
							/>
						) : null}
						{activeWorkflow === "swap" ? (
							<SwapWorkflow
								canClose={!workflowLocked}
								key="swap"
								onClose={closeWorkflow}
								onLockChange={setWorkflowLocked}
							/>
						) : null}
					</AnimatePresence>
				</div>
			</div>
		</main>
	);
}

function DemoFlowSection({ currentStep }: { currentStep: number }) {
	return (
		<div className="relative grid grid-cols-2 gap-2 sm:grid-cols-4">
			{DEMO_FLOW_STEPS.map((step) => (
				<DemoStepCard
					key={step.step}
					state={
						step.step < currentStep
							? "completed"
							: step.step === currentStep
								? "current"
								: "upcoming"
					}
					step={step}
				/>
			))}
		</div>
	);
}

function ActivePaymentPlanBanner({
	accountBalance,
	balanceDue,
	escrowPlan,
	onAdvanceInstallment,
}: {
	accountBalance: number;
	balanceDue: number;
	escrowPlan: DemoActiveEscrowPlan;
	onAdvanceInstallment: () => void;
}) {
	const totalInstallments = escrowPlan.installments.length;
	const completedInstallments = escrowPlan.nextInstallmentIndex;
	const escrowFunds = Math.max(
		escrowPlan.remainingPrincipal + escrowPlan.interestAccrued,
		0,
	);

	return (
		<div className="mb-3 flex items-start justify-between gap-3 rounded-[1.15rem] border border-border bg-bg px-4 py-3">
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<p className="font-medium text-sm">Payment plan is active</p>
					<button
						aria-label="Advance to next payment date"
						className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text"
						onClick={onAdvanceInstallment}
						type="button"
					>
						<FastForward className="h-3.5 w-3.5" />
					</button>
				</div>
				<p className="mt-0.5 text-text-secondary text-xs">
					Your payments are processed automatically through escrow.
				</p>
				<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
					<span>
						Due{" "}
						<span className="font-medium tabular-nums">
							${formatAmount(balanceDue)}
						</span>
					</span>
					<span>
						Account{" "}
						<span className="font-medium tabular-nums">
							${formatAmount(accountBalance)}
						</span>
					</span>
					<span>
						Escrow{" "}
						<span className="font-medium tabular-nums">
							${formatAmount(escrowFunds)}
						</span>
					</span>
				</div>
				<div className="mt-2 flex items-center gap-1.5">
					{escrowPlan.installments.map((installment, index) => (
						<span
							aria-hidden
							className={`h-1.5 w-1.5 rounded-full ${
								index < completedInstallments
									? "bg-text"
									: installment.status === "PROCESSED"
										? "bg-text"
										: "bg-border"
							}`}
							key={installment.id}
						/>
					))}
					<span className="ml-1 text-[11px] text-text-secondary">
						{completedInstallments} of {totalInstallments} installments
					</span>
				</div>
			</div>
			<div className="shrink-0">
				<span className="inline-flex rounded-full bg-success/12 px-2.5 py-1 font-medium text-[11px] text-success">
					Interest earned +${formatAmount(escrowPlan.interestAccrued)}
				</span>
			</div>
		</div>
	);
}

function StatementRow({
	invoice,
	secondary = false,
}: {
	invoice: {
		id: string;
		description: string;
		dueDate: Date;
		amount: number;
		status: string;
	};
	secondary?: boolean;
}) {
	return (
		<div
			className={`flex items-center justify-between gap-6 py-4 ${
				secondary ? "px-4 sm:px-5" : ""
			}`}
		>
			<div>
				<div className="font-medium">{invoice.description}</div>
				<div className="mt-1 text-sm text-text-secondary">
					Due {formatDate(invoice.dueDate)}
				</div>
			</div>
			<div className="flex items-center gap-4">
				<span className="font-serif text-2xl tabular-nums">
					${formatAmount(invoice.amount)}
				</span>
				<span
					className={`rounded-full px-2.5 py-1 font-medium text-xs ${
						invoice.status === "PAID"
							? "bg-success/12 text-success"
							: "bg-bg-secondary text-text-secondary"
					}`}
				>
					{invoice.status === "PAID" ? "Paid" : "Open"}
				</span>
			</div>
		</div>
	);
}

function TransactionMeta({
	tx,
}: {
	tx: {
		type: string;
		txHash?: string | null;
		confirmationMs?: number | null;
		fromCurrency?: string | null;
		toCurrency?: string | null;
		toAmount?: number | null;
	};
}) {
	const autoSwapDeposit = isAutoSwapDeposit(tx);

	return (
		<div className="mt-1 grid gap-1 text-text-secondary text-xs">
			{autoSwapDeposit ? <div>Settled in USDC via StableFX</div> : null}
			<div className="flex flex-wrap items-center gap-2">
				{autoSwapDeposit ? (
					<>
						<span>
							{tx.fromCurrency} → {tx.toCurrency}
						</span>
						<span aria-hidden className="h-3 w-px bg-border" />
					</>
				) : null}
				{tx.confirmationMs != null ? (
					<span>{(tx.confirmationMs / 1000).toFixed(1)}s</span>
				) : null}
				{tx.txHash ? (
					<>
						{tx.confirmationMs != null ? (
							<span aria-hidden className="h-3 w-px bg-border" />
						) : null}
						<a
							className="cursor-pointer transition-colors hover:text-text"
							href={`${ARC.explorer}/tx/${tx.txHash}`}
							rel="noopener noreferrer"
							target="_blank"
						>
							{tx.txHash.slice(0, 10)}...
						</a>
					</>
				) : null}
			</div>
		</div>
	);
}

function getTransactionDisplayAmount(tx: {
	type: string;
	amount: number;
	currency: string;
	toAmount?: number | null;
	toCurrency?: string | null;
	fromCurrency?: string | null;
}) {
	if (tx.type === "SWAP" && tx.toAmount != null) return tx.toAmount;
	if (isAutoSwapDeposit(tx)) return tx.toAmount ?? tx.amount;
	return tx.amount;
}

function getTransactionDisplayCurrency(tx: {
	type: string;
	currency: string;
	toCurrency?: string | null;
	fromCurrency?: string | null;
	toAmount?: number | null;
}) {
	if (tx.type === "SWAP") return tx.toCurrency ?? tx.currency;
	if (isAutoSwapDeposit(tx)) return tx.toCurrency ?? tx.currency;
	return tx.currency;
}

function getTransactionAmountPrefix(tx: { type: string }) {
	if (tx.type === "DEPOSIT") return "+";
	if (tx.type === "PAYMENT") return "-";
	return "";
}

const DEMO_FLOW_STEPS = [
	{
		step: 1,
		title: "Wallet ready",
		description: "No seed phrase.",
		completedTitle: "Wallet ready",
	},
	{
		step: 2,
		title: "Deposit funds",
		description: "From 27+ chains.",
		completedTitle: "Funds received",
	},
	{
		step: 3,
		title: "Funding path",
		description: "Auto-swap via StableFX.",
		completedTitle: "Route confirmed",
	},
	{
		step: 4,
		title: "Pay tuition",
		description: "Under 1 second.",
		completedTitle: "Tuition paid",
	},
] as const;

function DemoStepCard({
	step,
	state,
}: {
	step: (typeof DEMO_FLOW_STEPS)[number];
	state: DemoStepState;
}) {
	const label =
		state === "completed" && step.completedTitle
			? step.completedTitle
			: step.title;
	const detail = step.description;
	const isCompleted = state === "completed";
	const isCurrent = state === "current";

	return (
		<div
			className={`relative z-1 rounded-[1.35rem] border px-3.5 py-3 transition-all sm:px-4 sm:py-3.5 ${
				isCurrent
					? "border-text bg-bg shadow-md"
					: isCompleted
						? "border-border bg-bg-secondary/45"
						: "border-border bg-bg"
			}`}
		>
			<div
				className={`inline-flex h-[26px] w-[26px] items-center justify-center rounded-full transition-all ${
					isCompleted
						? "bg-text text-bg"
						: isCurrent
							? "border-[1.5px] border-text bg-bg text-text"
							: "border-[1.5px] border-border bg-bg text-text-secondary"
				}`}
			>
				{isCompleted ? (
					<Check className="h-[11px] w-[11px]" />
				) : (
					<span className="text-[11px] font-medium leading-none">
						{step.step}
					</span>
				)}
			</div>
			<div
				className={`mt-2 text-[13px] leading-[1.2] ${
					isCompleted
						? "text-text-secondary"
						: isCurrent
							? "font-semibold text-text"
							: "text-text-secondary"
				}`}
			>
				{label}
			</div>
			<div
				className={`mt-1 text-[11px] leading-snug ${
					isCurrent ? "text-text-secondary" : "text-text-secondary/60"
				}`}
			>
				{detail}
			</div>
		</div>
	);
}
