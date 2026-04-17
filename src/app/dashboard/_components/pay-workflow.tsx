"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { ARC } from "~/lib/constants";
import { buildPaymentPlan } from "~/lib/payment-plan";
import { api } from "~/trpc/react";
import { WorkflowShell } from "./workflow-shell";
import { WorkflowStep } from "./workflow-step";
import {
	buildCompletedPaymentSteps,
	buildPaymentPreviewSteps,
	delay,
	formatAmount,
	formatDate,
	type PaymentFlowStep,
	type PaymentStepStatus,
} from "./workflow-utils";

type PayWorkflowProps = {
	canClose: boolean;
	onClose: () => void;
	onLockChange: (locked: boolean) => void;
};

type Stage = "preview" | "processing" | "receipt";

export function PayWorkflow({
	canClose,
	onClose,
	onLockChange,
}: PayWorkflowProps) {
	const utils = api.useUtils();
	const [stage, setStage] = useState<Stage>("preview");
	const [reviewConfirmed, setReviewConfirmed] = useState(false);
	const [pathConfirmed, setPathConfirmed] = useState(false);
	const [stepStatuses, setStepStatuses] = useState<
		Record<string, PaymentStepStatus>
	>({});
	const [result, setResult] = useState<{
		steps: PaymentFlowStep[];
		paymentTxHash: string | null;
		paymentBlockNumber: number | null;
		totalConfirmationMs: number;
	} | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const { data, error, isLoading } = api.invoice.get.useQuery(
		{ id: "current" },
		{
			enabled: stage !== "receipt",
			retry: false,
		},
	);
	const pay = api.invoice.pay.useMutation();

	useEffect(() => {
		return () => onLockChange(false);
	}, [onLockChange]);

	if (isLoading) {
		return (
			<WorkflowShell
				canClose={canClose}
				onClose={onClose}
				title="Pay Meridian University"
			>
				<div className="rounded-3xl bg-bg-secondary px-5 py-8 text-center text-text-secondary">
					Loading current balance...
				</div>
			</WorkflowShell>
		);
	}

	if (error || !data) {
		return (
			<WorkflowShell
				canClose={canClose}
				onClose={onClose}
				title="Pay Meridian University"
			>
				<div className="rounded-3xl bg-bg-secondary px-5 py-8">
					<p className="text-danger">
						{error?.message ?? "No current balance is available."}
					</p>
				</div>
			</WorkflowShell>
		);
	}

	const { invoice, balances } = data;
	const paymentPlan = buildPaymentPlan(
		balances,
		invoice.amount,
		invoice.currency,
	);
	const previewSteps = buildPaymentPreviewSteps(
		paymentPlan,
		invoice.university.name,
	);
	const actionCount =
		paymentPlan.steps.filter((step) => step.kind !== "wallet").length + 1;

	const handlePay = async () => {
		if (!paymentPlan.canPay || pay.isPending) return;

		setStage("processing");
		setErrorMessage(null);
		onLockChange(true);

		try {
			const response = await pay.mutateAsync({ invoiceId: "current" });
			const completedSteps = buildCompletedPaymentSteps(
				response.paymentPlan,
				invoice.university.name,
				response.swaps,
				response.payment,
			);

			setStepStatuses(
				Object.fromEntries(
					completedSteps.map((step) => [
						step.key,
						step.kind === "wallet" ? "applied" : "queued",
					]),
				),
			);

			for (const step of completedSteps) {
				if (step.kind === "wallet") continue;

				setStepStatuses((current) => ({
					...current,
					[step.key]: "processing",
				}));

				await delay(step.confirmationMs ?? 400);

				setStepStatuses((current) => ({
					...current,
					[step.key]: "confirmed",
				}));
			}

			setResult({
				steps: completedSteps,
				paymentTxHash: response.payment.txHash,
				paymentBlockNumber: response.payment.blockNumber,
				totalConfirmationMs: completedSteps.reduce(
					(total, step) => total + (step.confirmationMs ?? 0),
					0,
				),
			});

			await Promise.all([
				utils.student.dashboard.invalidate(),
				utils.invoice.get.invalidate({ id: "current" }),
				utils.invoice.list.invalidate(),
				utils.transaction.list.invalidate(),
			]);

			setStage("receipt");
			onLockChange(false);
		} catch (mutationError) {
			setErrorMessage(
				mutationError instanceof Error
					? mutationError.message
					: "Payment could not be completed.",
			);
			setStage("preview");
			setStepStatuses({});
			onLockChange(false);
		}
	};

	return (
		<WorkflowShell
			canClose={canClose}
			onClose={onClose}
			title={`Pay ${invoice.university.name}`}
		>
			<WorkflowStep
				action={
					reviewConfirmed && stage === "preview" ? (
						<button
							className="cursor-pointer text-text-secondary text-xs transition-colors hover:text-text"
							onClick={() => {
								setReviewConfirmed(false);
								setPathConfirmed(false);
							}}
							type="button"
						>
							Edit
						</button>
					) : undefined
				}
				state={reviewConfirmed || stage !== "preview" ? "completed" : "active"}
				stepLabel="Step 1"
				summary={
					<div className="space-y-1">
						<div className="flex items-center justify-between gap-4">
							<span>Current balance</span>
							<span className="font-medium text-text">
								${formatAmount(invoice.amount)}
							</span>
						</div>
						<div className="flex items-center justify-between gap-4">
							<span>Statements</span>
							<span className="font-medium text-text">
								{invoice.statementCount}
							</span>
						</div>
					</div>
				}
				title="Review balance"
			>
				<div className="space-y-4 text-sm">
					<div>
						<div className="font-serif text-4xl">
							${formatAmount(invoice.amount)}
						</div>
						<p className="mt-2 text-text-secondary">{invoice.description}</p>
					</div>

					<div className="space-y-2 border-border border-y py-4">
						<div className="flex justify-between gap-4">
							<span className="text-text-secondary">Due date</span>
							<span>{formatDate(invoice.dueDate)}</span>
						</div>
						<div className="flex justify-between gap-4">
							<span className="text-text-secondary">Statements</span>
							<span>{invoice.statementCount}</span>
						</div>
					</div>

					<button
						className="w-full cursor-pointer rounded-full bg-text py-3 font-medium text-bg transition-opacity hover:opacity-90"
						onClick={() => setReviewConfirmed(true)}
						type="button"
					>
						Review funding
					</button>
				</div>
			</WorkflowStep>

			{reviewConfirmed || stage !== "preview" ? (
				<WorkflowStep
					action={
						pathConfirmed && stage === "preview" ? (
							<button
								className="cursor-pointer text-text-secondary text-xs transition-colors hover:text-text"
								onClick={() => setPathConfirmed(false)}
								type="button"
							>
								Edit
							</button>
						) : undefined
					}
					state={pathConfirmed || stage !== "preview" ? "completed" : "active"}
					stepLabel="Step 2"
					summary={`Funding path ready with ${actionCount} ${
						actionCount === 1 ? "action" : "actions"
					}.`}
					title="Review funding path"
				>
					<div className="space-y-4">
						<div className="space-y-3 border-border border-y py-4">
							{previewSteps.map((step) => (
								<FlowActionRow
									key={step.key}
									stage="preview"
									status="ready"
									step={step}
								/>
							))}
						</div>

						{!paymentPlan.canPay ? (
							<p className="text-danger text-sm">
								Need ${formatAmount(paymentPlan.shortfall)} more in payment
								power.
							</p>
						) : null}

						<button
							className="w-full cursor-pointer rounded-full bg-text py-3 font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
							disabled={!paymentPlan.canPay}
							onClick={() => setPathConfirmed(true)}
							type="button"
						>
							Continue
						</button>
					</div>
				</WorkflowStep>
			) : null}

			{pathConfirmed || stage !== "preview" ? (
				<WorkflowStep
					state={stage === "preview" ? "active" : "completed"}
					stepLabel="Step 3"
					summary={`Confirmed ${actionCount} ${
						actionCount === 1 ? "action" : "actions"
					} for ${invoice.university.name}.`}
					title="Confirm payment"
				>
					<div className="space-y-4 text-sm">
						<div className="space-y-2 border-border border-y py-4">
							<div className="flex justify-between gap-4">
								<span className="text-text-secondary">University</span>
								<span>{invoice.university.name}</span>
							</div>
							<div className="flex justify-between gap-4">
								<span className="text-text-secondary">Network actions</span>
								<span>{actionCount}</span>
							</div>
							<div className="flex justify-between gap-4">
								<span className="text-text-secondary">Arc fee</span>
								<span>{ARC.networkFee} each</span>
							</div>
						</div>

						{errorMessage ? (
							<p className="text-danger">{errorMessage}</p>
						) : null}

						<button
							className="w-full cursor-pointer rounded-full bg-text py-3 font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
							disabled={
								!paymentPlan.canPay || pay.isPending || stage === "processing"
							}
							onClick={handlePay}
							type="button"
						>
							{stage === "processing" ? "Processing payment..." : "Pay balance"}
						</button>
					</div>
				</WorkflowStep>
			) : null}

			{stage !== "preview" ? (
				<WorkflowStep
					state={stage === "processing" ? "active" : "completed"}
					stepLabel="Step 4"
					summary="All on-chain actions confirmed."
					title={
						stage === "processing" ? "Processing actions" : "Actions complete"
					}
				>
					<div className="space-y-3 border-border border-y py-4">
						{(result?.steps ?? previewSteps).map((step) => (
							<FlowActionRow
								key={step.key}
								stage={stage}
								status={stepStatuses[step.key] ?? "ready"}
								step={step}
							/>
						))}
					</div>
				</WorkflowStep>
			) : null}

			{stage === "receipt" && result ? (
				<WorkflowStep state="active" stepLabel="Step 5" title="Payment final">
					<div className="space-y-4 text-sm">
						<div className="rounded-3xl bg-success/8 px-4 py-4">
							<div className="font-serif text-3xl">
								${formatAmount(invoice.amount)}
							</div>
							<p className="mt-2 text-text-secondary">
								{invoice.university.name} received the funds on Arc in{" "}
								{(result.totalConfirmationMs / 1000).toFixed(2)}s.
							</p>
						</div>

						<div className="space-y-2">
							<div className="flex justify-between gap-4">
								<span className="text-text-secondary">Status</span>
								<span className="font-medium text-success">Final</span>
							</div>
							<div className="flex justify-between gap-4">
								<span className="text-text-secondary">Network actions</span>
								<span>{actionCount}</span>
							</div>
							{result.paymentTxHash ? (
								<div className="flex justify-between gap-4">
									<span className="text-text-secondary">
										Payment transaction
									</span>
									<a
										className="cursor-pointer truncate transition-colors hover:text-text"
										href={`${ARC.explorer}/tx/${result.paymentTxHash}`}
										rel="noopener noreferrer"
										target="_blank"
									>
										{result.paymentTxHash.slice(0, 14)}...
									</a>
								</div>
							) : null}
							{result.paymentBlockNumber != null ? (
								<div className="flex justify-between gap-4">
									<span className="text-text-secondary">Payment block</span>
									<span>#{result.paymentBlockNumber.toLocaleString()}</span>
								</div>
							) : null}
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

function FlowActionRow({
	stage,
	status,
	step,
}: {
	stage: Stage;
	status: PaymentStepStatus;
	step: PaymentFlowStep;
}) {
	const isComplete =
		stage === "receipt" || status === "confirmed" || status === "applied";
	const isCurrent = status === "processing";

	return (
		<div className="border-border border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0">
			<div className="flex items-start gap-3">
				<span className={rowStatusIconClassName(status, stage)}>
					{isComplete ? (
						<Check className="h-3.5 w-3.5" />
					) : isCurrent ? (
						<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
					) : (
						<span className="h-2 w-2 rounded-full bg-current" />
					)}
				</span>
				<div className="min-w-0 flex-1">
					<div className="font-medium leading-tight">{step.title}</div>
					<div className="mt-0.5 text-sm text-text-secondary">{step.detail}</div>
				</div>
			</div>

			{step.txHash && status === "confirmed" ? (
				<div className="mt-2 ml-8 flex flex-wrap items-center gap-3 text-text-secondary text-xs">
					<a
						className="cursor-pointer transition-colors hover:text-text"
						href={`${ARC.explorer}/tx/${step.txHash}`}
						rel="noopener noreferrer"
						target="_blank"
					>
						{step.txHash.slice(0, 14)}...
					</a>
					{step.blockNumber != null ? (
						<span>Block #{step.blockNumber.toLocaleString()}</span>
					) : null}
					{step.confirmationMs != null ? (
						<span>{(step.confirmationMs / 1000).toFixed(2)}s</span>
					) : null}
				</div>
			) : null}
		</div>
	);
}

function rowStatusIconClassName(status: PaymentStepStatus, stage: Stage) {
	if (stage === "receipt" || status === "confirmed" || status === "applied") {
		return "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-success text-bg";
	}
	if (status === "processing") {
		return "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border border-text/15 bg-bg-secondary text-text";
	}
	return "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border border-border bg-bg text-text-secondary/70";
}
