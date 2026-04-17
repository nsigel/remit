"use client";

import { AnimatePresence } from "framer-motion";
import { Check, ChevronRight, PlusIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ARC, STABLEFX_SPREAD } from "~/lib/constants";
import { getPaymentPower } from "~/lib/payment-plan";
import { SESSION_COOKIE_NAME } from "~/lib/session-constants";
import { api } from "~/trpc/react";
import { ThemeToggle } from "../_components/theme-toggle";
import { DashboardHeader } from "./_components/dashboard-header";
import { DepositWorkflow } from "./_components/deposit-workflow";
import { PayWorkflow } from "./_components/pay-workflow";
import {
	formatAmount,
	formatDate,
	getMinimumPayment,
	txLabel,
} from "./_components/workflow-utils";

type ActiveWorkflow = "none" | "deposit" | "pay-current";
type DemoStepState = "completed" | "current" | "upcoming";

/** Shared tap row: same min height and padding for primary vs secondary CTAs in the summary grid. */
const DASHBOARD_CTA_ROW =
	"mt-4 inline-flex w-full min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-medium leading-none";
const DASHBOARD_CTA_PRIMARY = `${DASHBOARD_CTA_ROW} bg-text text-bg transition-opacity hover:opacity-90`;
const DASHBOARD_CTA_SECONDARY_QUIET = `${DASHBOARD_CTA_ROW} border border-border bg-bg text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text`;
const DASHBOARD_CTA_SECONDARY = `${DASHBOARD_CTA_ROW} border border-border bg-bg text-text transition-colors hover:bg-bg-secondary`;

function TuitionColumnActions({
	currentDemoStep,
	paymentPower,
	totalDue,
	onOpenDeposit,
	onOpenPay,
}: {
	currentDemoStep: number;
	paymentPower: number;
	totalDue: number;
	onOpenDeposit: () => void;
	onOpenPay: () => void;
}) {
	if (currentDemoStep === 2) {
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

	if (currentDemoStep === 3) {
		const pct =
			totalDue > 0
				? Math.min(100, Math.round((paymentPower / totalDue) * 1000) / 10)
				: 0;
		return (
			<div className="mt-4 space-y-2">
				<div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
					<span className="text-text-secondary">Tuition coverage</span>
					<span className="text-text tabular-nums">
						${formatAmount(paymentPower)} of ${formatAmount(totalDue)}
					</span>
				</div>
				<div
					aria-valuemax={100}
					aria-valuemin={0}
					aria-valuenow={Math.round(pct)}
					className="h-2 overflow-hidden rounded-full bg-bg-secondary"
					role="progressbar"
				>
					<div
						className="h-full rounded-full bg-text/80 transition-[width]"
						style={{ width: `${pct}%` }}
					/>
				</div>
				<p className="text-text-secondary text-xs leading-snug">
					{`About ${pct}% of tuition covered in spending power.`}
				</p>
			</div>
		);
	}

	return (
		<button className={DASHBOARD_CTA_PRIMARY} onClick={onOpenPay} type="button">
			Pay ${formatAmount(totalDue)}
		</button>
	);
}

function WalletDepositAction({
	currentDemoStep,
	onOpenDeposit,
	onOpenPay,
}: {
	currentDemoStep: number;
	onOpenDeposit: () => void;
	onOpenPay: () => void;
}) {
	if (currentDemoStep === 2) {
		return (
			<button
				className={DASHBOARD_CTA_SECONDARY_QUIET}
				onClick={onOpenDeposit}
				type="button"
			>
				<PlusIcon className="h-4 w-4 shrink-0 opacity-90" />
				Deposit
			</button>
		);
	}

	if (currentDemoStep === 3) {
		return (
			<button
				className={DASHBOARD_CTA_PRIMARY}
				onClick={onOpenPay}
				type="button"
			>
				Swap to USDC
			</button>
		);
	}

	return (
		<button
			className={DASHBOARD_CTA_SECONDARY}
			onClick={onOpenDeposit}
			type="button"
		>
			<PlusIcon className="h-4 w-4 shrink-0 opacity-90" />
			Deposit on any chain
		</button>
	);
}

export function DashboardClient() {
	const router = useRouter();
	const [activeWorkflow, setActiveWorkflow] = useState<ActiveWorkflow>("none");
	const [workflowLocked, setWorkflowLocked] = useState(false);

	const { data, isLoading } = api.student.dashboard.useQuery(undefined, {
		refetchOnMount: "always",
	});
	const reset = api.student.reset.useMutation({
		onSuccess: () => {
			// biome-ignore lint/suspicious/noDocumentCookie: Reset has to clear the client-visible session cookie until the server-side mutation response is fixed.
			document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
			router.push("/");
		},
	});

	if (isLoading || !data) {
		return (
			<main className="flex min-h-dvh items-center justify-center">
				<span className="text-text-secondary">Loading...</span>
			</main>
		);
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
	const nextDueDate = openStatements[0]?.dueDate;
	const minimumPayment = getMinimumPayment(totalDue);
	const canPayCurrentBalance = totalDue > 0 && paymentPower >= totalDue;
	const hasFxBalance = balances.some(
		(balance) => balance.currency !== "USDC" && balance.amount > 0,
	);
	const workflowOpen = activeWorkflow !== "none";
	const contentWidthClass = workflowOpen
		? "lg:max-w-[880px] lg:flex-1"
		: "lg:mx-auto lg:max-w-[880px]";
	const currentDemoStep = canPayCurrentBalance ? 4 : hasFxBalance ? 3 : 2;
	const orderedWalletBalances = [...balances].sort((a, b) => {
		const order = ["USDC", "EURC", "JPYC"];
		const aIndex = order.indexOf(a.currency);
		const bIndex = order.indexOf(b.currency);
		if (aIndex === -1 && bIndex === -1) {
			return a.currency.localeCompare(b.currency);
		}
		if (aIndex === -1) return 1;
		if (bIndex === -1) return -1;
		return aIndex - bIndex;
	});

	const openWorkflow = (workflow: ActiveWorkflow) => {
		if (workflowLocked) return;
		setActiveWorkflow(workflow);
	};

	const closeWorkflow = () => {
		if (workflowLocked) return;
		setActiveWorkflow("none");
	};

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
							onClick={() => reset.mutate()}
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
							<section className="pt-4">
								<DemoFlowSection currentStep={currentDemoStep} />
							</section>

							<section className="border-border border-t pt-7">
								<div className="rounded-[2rem] border border-border bg-bg-secondary/50 px-5 py-5 sm:px-6 sm:py-6">
									<div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
										<section className="min-w-0">
											<div className="text-sm text-text-secondary">
												Account balance
											</div>
											<div className="mt-2 font-serif text-4xl tabular-nums leading-none sm:text-[3.25rem]">
												${formatAmount(paymentPower)}
											</div>
											<div className="mt-2 text-sm text-text-secondary">
												Available to pay tuition
											</div>
										</section>

										<section className="min-w-0">
											<div className="text-sm text-text-secondary">
												Amount due
											</div>
											<div className="mt-2 font-serif text-4xl tabular-nums leading-none sm:text-[3.25rem]">
												${formatAmount(totalDue)}
											</div>
											<div className="mt-2 text-sm text-text-secondary">
												{openStatements.length > 0
													? `Due ${formatDate(nextDueDate)} • Minimum payment $${formatAmount(minimumPayment)}`
													: "Nothing open"}
											</div>
											{openStatements.length > 0 ? (
												<TuitionColumnActions
													currentDemoStep={currentDemoStep}
													onOpenDeposit={() => openWorkflow("deposit")}
													onOpenPay={() => openWorkflow("pay-current")}
													paymentPower={paymentPower}
													totalDue={totalDue}
												/>
											) : null}
										</section>
									</div>

									<div className="mt-6 border-border border-t pt-5">
										<div className="flex items-center justify-between gap-4">
											<h2 className="font-serif text-[1.7rem] leading-none">
												Wallet breakdown
											</h2>
											<button
												className="inline-flex items-center gap-1 font-serif text-accent text-md italic tracking-wide transition-opacity hover:opacity-80"
												type="button"
											>
												How stablecoins work
												<ChevronRight className="h-4 w-4" />
											</button>
										</div>

										<div className="mt-4 grid gap-x-6 sm:grid-cols-3">
											<WalletBalanceRow
												amount={paymentPower}
												currency="REMIT"
												label="Remit balance"
											/>
											{orderedWalletBalances.map((balance) => (
												<WalletBalanceRow
													amount={balance.amount}
													currency={balance.currency}
													key={balance.currency}
													label={balance.currency}
												/>
											))}
										</div>
										<WalletDepositAction
											currentDemoStep={currentDemoStep}
											onOpenDeposit={() => openWorkflow("deposit")}
											onOpenPay={() => openWorkflow("pay-current")}
										/>
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

								<div className="mt-5 divide-y divide-border border-border border-y">
									{invoices.map((invoice) => (
										<StatementRow invoice={invoice} key={invoice.id} />
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
													<div className="text-text-secondary text-xs">
														{tx.confirmationMs != null &&
															`${(tx.confirmationMs / 1000).toFixed(2)}s`}
														{tx.txHash ? (
															<>
																{" "}
																&middot;{" "}
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
												<div className="text-right tabular-nums">
													<div
														className={
															tx.type === "DEPOSIT" ? "text-success" : ""
														}
													>
														{tx.type === "DEPOSIT"
															? "+"
															: tx.type === "PAYMENT"
																? "-"
																: ""}
														$
														{formatAmount(
															tx.type === "SWAP" && tx.toAmount
																? tx.toAmount
																: tx.amount,
														)}
													</div>
													<div className="text-text-secondary text-xs">
														{tx.type === "SWAP" ? tx.toCurrency : tx.currency}
													</div>
												</div>
											</div>
										))}
									</div>
								</section>
							) : null}
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
						{activeWorkflow === "pay-current" ? (
							<PayWorkflow
								canClose={!workflowLocked}
								key="pay-current"
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
	const currentStepMeta = getCurrentDemoStepMeta(currentStep);

	return (
		<div className="space-y-5">
			<div className="rounded-[2rem] border border-border bg-bg-secondary/80 px-6 py-6 sm:px-7 sm:py-7">
				<div className="max-w-2xl">
					<h2 className="font-serif text-3xl leading-none sm:text-5xl">
						{currentStepMeta.title}
					</h2>
					<p className="mt-3 max-w-xl text-base text-text-secondary sm:text-lg">
						{currentStepMeta.description}
					</p>
				</div>
			</div>

			<div className="grid gap-3 lg:grid-cols-4">
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
		</div>
	);
}

function StatementRow({
	invoice,
}: {
	invoice: {
		id: string;
		description: string;
		dueDate: Date;
		amount: number;
		status: string;
	};
}) {
	return (
		<div className="flex items-center justify-between gap-6 py-4">
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

function WalletBalanceRow({
	amount,
	currency,
	label,
}: {
	amount: number;
	currency: string;
	label: string;
}) {
	return (
		<div className="flex items-center justify-between gap-4 border-border border-t py-3 first:border-t-0">
			<div className="flex min-w-0 items-center gap-3">
				<span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-bg">
					<Image
						alt=""
						aria-hidden
						height={20}
						src={currencyLogoMap[currency] ?? "/Arc_Icon_Navay.svg"}
						style={{ height: "auto" }}
						width={20}
					/>
				</span>
				<span className="truncate text-sm text-text-secondary">{label}</span>
			</div>
			<div className="font-serif text-[1.65rem] text-text tabular-nums leading-none">
				{formatWalletAmount(amount, currency)}
			</div>
		</div>
	);
}

const currencyLogoMap: Record<string, string> = {
	EURC: "/eurc.svg",
	JPYC: "/jpyc.svg",
	USDC: "/usdc.svg",
};

function formatWalletAmount(amount: number, currency: string) {
	const formatted =
		amount === 0
			? formatAmount(0)
			: Math.round(amount).toLocaleString("en-US", {
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				});
	if (currency === "REMIT") return `$${formatted}`;
	if (currency === "USDC") return `$${formatted}`;
	if (currency === "EURC") return `€${formatted}`;
	if (currency === "JPYC") return `¥${formatted}`;
	return `${formatted}`;
}

const DEMO_FLOW_STEPS = [
	{
		step: 1,
		title: "Create wallet",
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
		title: "Swap FX",
		description: "0.1% spread.",
		completedTitle: "FX routed",
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
			className={`rounded-[1.35rem] border px-5 py-5 transition-colors ${
				isCurrent
					? "border-text bg-bg shadow-[0_16px_32px_rgba(10,10,10,0.08)]"
					: isCompleted
						? "border-border bg-bg-secondary/45"
						: "border-border bg-bg"
			}`}
		>
			<div className="flex h-full flex-col gap-3">
				<div className="flex items-start gap-4">
					<span
						className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full ${
							isCompleted
								? "border border-text bg-text text-bg"
								: isCurrent
									? "border border-text bg-bg text-text"
									: "border border-border bg-bg text-text-secondary"
						}`}
					>
						{isCompleted ? (
							<Check className="h-3.5 w-3.5" />
						) : (
							<span className="font-medium text-sm leading-none">
								{step.step}
							</span>
						)}
					</span>
					<div className="min-w-0 pt-0.5">
						<div className="font-serif text-[1.55rem] leading-[1.05] sm:text-[1.8rem]">
							{label}
						</div>
					</div>
				</div>
				<div
					className={`pl-12 text-sm leading-snug ${
						isCurrent ? "text-text" : "text-text-secondary"
					}`}
				>
					{detail}
				</div>
			</div>
		</div>
	);
}

function getCurrentDemoStepMeta(currentStep: number) {
	if (currentStep === 4) {
		return {
			action: "Pay your university.",
			title: "Pay tuition on Arc",
			description: "Send USDC to your university and settle instantly on Arc.",
		};
	}

	if (currentStep === 3) {
		return {
			action: "Swap into USDC.",
			title: "Swap stablecoins into USDC",
			description: `Convert local stablecoins into USDC with StableFX at a ${(STABLEFX_SPREAD * 100).toFixed(1)}% spread.`,
		};
	}

	return {
		action: "Deposit funds.",
		title: "Deposit from any chain",
		description:
			"Receive any stablecoin across 27+ chains in your Remit wallet.",
	};
}
