"use client";

import Link from "next/link";
import { ARC } from "~/lib/constants";
import { useDemoSession } from "~/lib/demo-session";
import { BrandLockup } from "../_components/brand-lockup";
import { ThemeToggle } from "../_components/theme-toggle";

export function UniversityClient() {
	const { selectors } = useDemoSession();
	const data = selectors.university();

	return (
		<main className="min-h-dvh">
			<header className="flex items-center justify-between border-border border-b px-8 py-6">
				<Link className="cursor-pointer" href="/">
					<BrandLockup />
				</Link>
				<div className="flex items-center gap-6">
					<span className="text-sm text-text-secondary">University View</span>
					<ThemeToggle />
				</div>
			</header>

			<div className="mx-auto max-w-4xl px-8 py-12">
				{!data ? (
					<div className="py-16 text-center">
						<h1 className="mb-4 font-serif text-3xl">
							No incoming tuition yet
						</h1>
						<p className="mb-6 text-text-secondary">
							Run the student payment flow to populate settlement activity.
						</p>
						<Link
							className="inline-block cursor-pointer bg-text px-6 py-2.5 font-medium text-bg transition-opacity hover:opacity-90"
							href="/demo"
						>
							Start student demo
						</Link>
					</div>
				) : (
					<>
						<div className="mb-12">
							<h1 className="mb-1 font-serif text-3xl">
								{data.university.name}
							</h1>
							<p className="text-sm text-text-secondary">
								{data.university.walletAddress.slice(0, 10)}...
								{data.university.walletAddress.slice(-4)}
							</p>
						</div>

						<div className="mb-12 grid grid-cols-2 gap-8 sm:grid-cols-4">
							<Stat
								label="USDC settled"
								value={`$${formatAmount(data.stats.totalReceived)}`}
							/>
							<Stat
								label="Final payments"
								value={data.stats.paymentCount.toString()}
							/>
							<Stat
								label="Students served"
								value={data.stats.studentCount.toString()}
							/>
							<Stat
								label="Avg finality"
								value={
									data.stats.avgConfirmationMs > 0
										? `${(data.stats.avgConfirmationMs / 1000).toFixed(2)}s`
										: "—"
								}
							/>
						</div>

						<div className="mb-6 flex gap-8 text-sm text-text-secondary">
							<span>{data.stats.paidInvoices} paid statements</span>
							<span>{data.stats.unpaidInvoices} outstanding statements</span>
						</div>

						{data.payments.length > 0 ? (
							<section>
								<h2 className="mb-4 font-serif text-2xl">Incoming payments</h2>
								<div className="divide-y divide-border">
									{data.payments.map((payment) => (
										<div
											className="flex items-center justify-between py-4"
											key={payment.id}
										>
											<div>
												<div className="font-medium">
													{payment.student.name}
												</div>
												<div className="text-sm text-text-secondary">
													{payment.confirmationMs != null &&
														`${(payment.confirmationMs / 1000).toFixed(2)}s`}
													{payment.txHash && (
														<>
															{" · "}
															<a
																className="cursor-pointer transition-colors hover:text-text"
																href={`${ARC.explorer}/tx/${payment.txHash}`}
																rel="noopener noreferrer"
																target="_blank"
															>
																{payment.txHash.slice(0, 10)}...
															</a>
														</>
													)}
												</div>
											</div>
											<div className="text-right">
												<div className="tabular-nums">
													${formatAmount(payment.amount)}
												</div>
												<div className="text-success text-xs">Final</div>
											</div>
										</div>
									))}
								</div>
							</section>
						) : (
							<p className="text-text-secondary">No payments received yet.</p>
						)}

						<div className="mt-12 text-center text-sm text-text-secondary">
							Arc finality averages{" "}
							{(data.stats.avgConfirmationMs / 1000).toFixed(2)}s; ACH/wire
							typically takes 1-5 business days.
						</div>
					</>
				)}
			</div>
		</main>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<div className="mb-1 text-sm text-text-secondary">{label}</div>
			<div className="font-serif text-2xl">{value}</div>
		</div>
	);
}

function formatAmount(n: number): string {
	return n.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}
