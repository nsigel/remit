"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ARC } from "~/lib/constants";
import { useDemoSession } from "~/lib/demo-session";
import { ThemeToggle } from "../../_components/theme-toggle";
import { DashboardHeader } from "../_components/dashboard-header";
import {
	formatDisplayAmount,
	isAutoSwapDeposit,
	txLabel,
} from "../_components/workflow-utils";

type Filter = "all" | "DEPOSIT" | "PAYMENT" | "SWAP";

export default function HistoryPage() {
	const router = useRouter();
	const { hasSession, selectors, status } = useDemoSession();
	const [filter, setFilter] = useState<Filter>("all");

	useEffect(() => {
		if (status !== "ready" || hasSession) return;
		router.replace("/demo");
	}, [hasSession, router, status]);

	const transactions =
		filter === "all" ? selectors.transactions() : selectors.transactions(filter);

	const filters: { label: string; value: Filter }[] = [
		{ label: "All", value: "all" },
		{ label: "Deposits", value: "DEPOSIT" },
		{ label: "Payments", value: "PAYMENT" },
		{ label: "Swaps", value: "SWAP" },
	];

	if (status !== "ready") {
		return (
			<main className="flex min-h-dvh items-center justify-center">
				<span className="text-text-secondary">Loading...</span>
			</main>
		);
	}

	if (!hasSession) {
		return null;
	}

	return (
		<main className="min-h-dvh">
			<DashboardHeader rightSlot={<ThemeToggle />} />

			<div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
				<h1 className="mb-6 font-serif text-3xl">Activity</h1>

				<div className="mb-8 flex gap-2">
					{filters.map((f) => (
						<button
							className={`cursor-pointer border px-3 py-1.5 text-sm transition-colors ${
								filter === f.value
									? "border-text bg-text text-bg"
									: "border-border hover:bg-bg-secondary"
							}`}
							key={f.value}
							onClick={() => setFilter(f.value)}
							type="button"
						>
							{f.label}
						</button>
					))}
				</div>

				{transactions.length === 0 ? (
					<p className="text-text-secondary">No activity yet.</p>
				) : (
					<div className="divide-y divide-border">
						{transactions.map((tx) => (
							<div
								className="flex items-center justify-between py-4"
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
									<div className="mt-1 grid gap-1 text-text-secondary text-xs">
										{isAutoSwapDeposit(tx) ? (
											<div>Settled in USDC via StableFX</div>
										) : null}
										<div className="flex flex-wrap items-center gap-2">
											<span>
												{new Date(tx.createdAt).toLocaleDateString("en-US", {
													month: "short",
													day: "numeric",
													hour: "numeric",
													minute: "2-digit",
												})}
											</span>
											{isAutoSwapDeposit(tx) ? (
												<>
													<span aria-hidden className="h-3 w-px bg-border" />
													<span>
														{tx.fromCurrency} → {tx.toCurrency}
													</span>
												</>
											) : null}
											{tx.confirmationMs != null ? (
												<>
													<span aria-hidden className="h-3 w-px bg-border" />
													<span>{(tx.confirmationMs / 1000).toFixed(1)}s</span>
												</>
											) : null}
											{tx.txHash ? (
												<>
													<span aria-hidden className="h-3 w-px bg-border" />
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
								</div>
								<div className="text-right tabular-nums">
									<div
										className={
											tx.type === "DEPOSIT"
												? "text-success"
												: tx.type === "PAYMENT"
													? ""
													: "text-text-secondary"
										}
									>
										{tx.type === "DEPOSIT"
											? "+"
											: tx.type === "PAYMENT"
												? "-"
												: ""}
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
				)}
			</div>
		</main>
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
