"use client";

import { ArrowLeft, ArrowRight, Check, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ARC } from "~/lib/constants";
import type { PayCurrentBalanceResult } from "~/lib/demo-model";
import { useDemoSession } from "~/lib/demo-session";
import { buildPaymentPlan } from "~/lib/payment-plan";
import { formatAmount, formatDate } from "./workflow-utils";

type DemoEscrowYieldProductId = "usyc" | "aave" | "none";
type DemoEscrowPlanId = "full" | "two-installments" | "four-installments";

type DemoEscrowPlan = {
  planId: DemoEscrowPlanId;
  planLabel: string;
  planSubtitle: string;
  perReleaseLabel: string;
  dateLabel: string;
  totalCommitment: number;
  yieldProductId: DemoEscrowYieldProductId;
  yieldProductLabel: string;
  yieldApy: number;
  projectedYield: number;
  releaseSchedule: Array<{
    label: string;
    date: Date;
    amount: number;
  }>;
};

type PayWorkflowProps = {
  canClose: boolean;
  onClose: () => void;
  onOpenDeposit: () => void;
  onLockChange: (locked: boolean) => void;
};

type FlowScreen = 1 | 2 | 3;
type PaymentChoice = "full" | "plan" | "custom";
type EscrowPlanOption = {
  id: DemoEscrowPlanId;
  title: string;
  subtitle: string;
  perReleaseLabel: string;
  dateLabel: string;
  yieldByProduct: Record<DemoEscrowYieldProductId, number>;
  schedule: Array<{
    label: string;
    date: Date;
    amount: number;
  }>;
};
type YieldProductOption = {
  id: DemoEscrowYieldProductId;
  title: string;
  description: string;
  apy: number;
  riskLabel: string;
  riskTone: string;
};
type CompletedEscrowState = {
  escrowPlan: DemoEscrowPlan;
  txHash: string | null;
  confirmationMs: number | null;
  universityName: string;
};

type InvoiceSummary = {
  amount: number;
  currency: string;
  dueDate: Date;
  statementCount: number;
  statements: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: Date;
  }>;
  university: {
    name: string;
  };
};

const YIELD_PRODUCTS: YieldProductOption[] = [
  {
    id: "usyc",
    title: "USYC · Tokenized US Treasuries",
    description: "Short-term US government debt.",
    apy: 3.18,
    riskLabel: "Low risk",
    riskTone:
      "bg-[#e7f3df] text-[#55733b] dark:bg-[#24331d] dark:text-[#b6d59d]",
  },
  {
    id: "aave",
    title: "Aave V3",
    description: "Decentralized lending market with variable rate.",
    apy: 5.14,
    riskLabel: "Protocol risk",
    riskTone:
      "bg-[#f6ead7] text-[#8f6933] dark:bg-[#3a2a14] dark:text-[#e8c48a]",
  },
];

export function PayWorkflow({
  canClose,
  onClose,
  onOpenDeposit,
  onLockChange,
}: PayWorkflowProps) {
  const { actions, selectors } = useDemoSession();
  const dashboard = selectors.dashboard();
  const [screen, setScreen] = useState<FlowScreen>(1);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("plan");
  const [customAmountInput, setCustomAmountInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedPayment, setCompletedPayment] =
    useState<PayCurrentBalanceResult | null>(null);
  const [completedEscrow, setCompletedEscrow] =
    useState<CompletedEscrowState | null>(null);
  const data = selectors.currentBalance();
  const [selectedEscrowPlanId, setSelectedEscrowPlanId] =
    useState<DemoEscrowPlanId>("four-installments");
  const [selectedYieldId, setSelectedYieldId] =
    useState<DemoEscrowYieldProductId>("usyc");

  useEffect(() => {
    return () => onLockChange(false);
  }, [onLockChange]);

  const fallbackDueDate = new Date();
  const escrowSourceAmount = data?.invoice.amount ?? 0;
  const escrowDueDate = data?.invoice.dueDate ?? fallbackDueDate;
  const firstReleaseDate = useMemo(() => {
    const nextDate = new Date(escrowDueDate);
    nextDate.setDate(nextDate.getDate() - 1);
    return nextDate;
  }, [escrowDueDate]);
  const escrowPlanOptions = useMemo(
    () => buildEscrowPlanOptions(escrowSourceAmount, firstReleaseDate),
    [firstReleaseDate, escrowSourceAmount],
  );
  const [defaultEscrowPlan] = escrowPlanOptions;
  const [defaultYieldProduct] = YIELD_PRODUCTS;

  if (!data) {
    if (screen === 3 && completedEscrow) {
      return (
        <PaymentFlowFrame
          canGoBack={false}
          onBack={onClose}
          showHeader={false}
          stepLabel="Completed"
        >
          <EscrowPlanCompletedScreen
            completedEscrow={completedEscrow}
            onBackToDashboard={onClose}
          />
        </PaymentFlowFrame>
      );
    }
    if (screen === 3 && completedPayment) {
      return (
        <PaymentFlowFrame
          canGoBack={false}
          onBack={onClose}
          showHeader={false}
          stepLabel="Completed"
        >
          <PaymentCompletedScreen
            invoice={completedPayment.invoice}
            onBackToDashboard={onClose}
            payment={completedPayment.payment}
          />
        </PaymentFlowFrame>
      );
    }

    return (
      <PaymentFlowFrame
        canGoBack={canClose}
        onBack={onClose}
        stepLabel="Payment unavailable"
      >
        <div className="rounded-[1.6rem] border border-border px-5 py-8 text-danger">
          No current balance is available.
        </div>
      </PaymentFlowFrame>
    );
  }

  const invoice = data.invoice as InvoiceSummary;
  const parsedCustomAmount = Number(customAmountInput);
  const customAmount =
    customAmountInput.trim().length > 0 && Number.isFinite(parsedCustomAmount)
      ? parsedCustomAmount
      : null;
  const selectedAmount =
    paymentChoice === "custom" ? (customAmount ?? 0) : invoice.amount;
  const paymentPlan = buildPaymentPlan(
    data.balances,
    selectedAmount,
    invoice.currency,
  );
  const remainingAfterPayment = Math.max(
    paymentPlan.paymentPower - selectedAmount,
    0,
  );
  const customAmountError =
    paymentChoice !== "custom"
      ? null
      : customAmountInput.trim().length === 0
        ? "Enter an amount."
        : customAmount == null || customAmount <= 0
          ? "Enter an amount greater than $0.00."
          : customAmount > invoice.amount
            ? "Amount cannot exceed the current balance."
            : null;
  const canContinue =
    paymentChoice === "full" ||
    paymentChoice === "plan" ||
    (paymentChoice === "custom" && customAmountError == null);
  if (!defaultEscrowPlan || !defaultYieldProduct) {
    return null;
  }
  const selectedEscrowPlan =
    escrowPlanOptions.find((plan) => plan.id === selectedEscrowPlanId) ??
    defaultEscrowPlan;
  const selectedYield =
    YIELD_PRODUCTS.find((product) => product.id === selectedYieldId) ??
    defaultYieldProduct;
  const projectedYield =
    selectedEscrowPlan.yieldByProduct[selectedYield.id] ?? 0;
  const escrowPlanDetails = buildEscrowPlanDetails({
    projectedYield,
    selectedPlan: selectedEscrowPlan,
    selectedYield,
    totalCommitment: invoice.amount,
  });

  const handleBack = () => {
    if (!canClose || isSubmitting) return;
    if (screen === 1) {
      onClose();
      return;
    }
    if (screen === 3) {
      onClose();
      return;
    }
    setErrorMessage(null);
    setScreen(1);
  };

  const handleContinue = () => {
    if (!canContinue) return;
    setErrorMessage(null);
    setScreen(2);
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;

    if (!paymentPlan.canPay) {
      onOpenDeposit();
      return;
    }

    setErrorMessage(null);
    onLockChange(true);
    setIsSubmitting(true);

    try {
      const result = actions.payCurrentBalance(selectedAmount);
      setCompletedPayment(result);
      onLockChange(false);
      setIsSubmitting(false);
      setScreen(3);
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : "Payment could not be completed.",
      );
      onLockChange(false);
      setIsSubmitting(false);
    }
  };

  const handleCommitEscrow = async () => {
    if (isSubmitting) return;

    setErrorMessage(null);
    onLockChange(true);
    setIsSubmitting(true);

    try {
      const result = actions.createPaymentPlanEscrow({
        amount: invoice.amount,
        currency: invoice.currency,
        planId: escrowPlanDetails.planId,
        planLabel: escrowPlanDetails.planLabel,
        planSubtitle: escrowPlanDetails.planSubtitle,
        projectedYield: escrowPlanDetails.projectedYield,
        yieldProductId: escrowPlanDetails.yieldProductId,
        yieldProductLabel: escrowPlanDetails.yieldProductLabel,
        yieldApy: escrowPlanDetails.yieldApy,
        releaseSchedule: escrowPlanDetails.releaseSchedule.map((item) => ({
          label: item.label,
          date: item.date,
          amount: item.amount,
        })),
      });

      setCompletedEscrow({
        escrowPlan: escrowPlanDetails,
        txHash: result.txHash,
        confirmationMs: result.confirmationMs,
        universityName: invoice.university.name,
      });
      onLockChange(false);
      setIsSubmitting(false);
      setScreen(3);
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : "Escrow could not be created.",
      );
      onLockChange(false);
      setIsSubmitting(false);
    }
  };

  return (
    <PaymentFlowFrame
      canGoBack={screen !== 3 && canClose && !isSubmitting}
      onBack={handleBack}
      showHeader={screen !== 3}
      stepLabel={
        screen === 1
          ? "Step 1 of 2"
          : screen === 2
            ? "Step 2 of 2"
            : "Completed"
      }
    >
      {screen === 1 ? (
        <PaymentSelectionScreen
          availableAmount={paymentPlan.paymentPower}
          canContinue={canContinue}
          customAmountError={customAmountError}
          customAmountInput={customAmountInput}
          invoice={invoice}
          onContinue={handleContinue}
          onCustomAmountChange={setCustomAmountInput}
          onSelectChoice={setPaymentChoice}
          paymentChoice={paymentChoice}
        />
      ) : screen === 2 && paymentChoice === "plan" ? (
        <EscrowPlanSetupScreen
          errorMessage={errorMessage}
          invoice={invoice}
          isSubmitting={isSubmitting}
          onCommitEscrow={handleCommitEscrow}
          onSelectPlan={setSelectedEscrowPlanId}
          onSelectYield={setSelectedYieldId}
          projectedYield={projectedYield}
          selectedPlan={selectedEscrowPlan}
          selectedYield={selectedYield}
          studentName={dashboard?.student.name ?? ""}
        />
      ) : screen === 2 ? (
        <PaymentConfirmScreen
          amount={selectedAmount}
          canPay={paymentPlan.canPay}
          errorMessage={errorMessage}
          invoice={invoice}
          isSubmitting={isSubmitting}
          onConfirm={handleConfirm}
          paymentPower={paymentPlan.paymentPower}
          remainingAfterPayment={remainingAfterPayment}
        />
      ) : completedEscrow ? (
        <EscrowPlanCompletedScreen
          completedEscrow={completedEscrow}
          onBackToDashboard={onClose}
        />
      ) : completedPayment ? (
        <PaymentCompletedScreen
          invoice={completedPayment.invoice}
          onBackToDashboard={onClose}
          payment={completedPayment.payment}
        />
      ) : null}
    </PaymentFlowFrame>
  );
}

function EscrowPlanSetupScreen({
  errorMessage,
  invoice,
  isSubmitting,
  onCommitEscrow,
  onSelectPlan,
  onSelectYield,
  projectedYield,
  selectedPlan,
  selectedYield,
  studentName,
}: {
  errorMessage: string | null;
  invoice: InvoiceSummary;
  isSubmitting: boolean;
  onCommitEscrow: () => void;
  onSelectPlan: (planId: DemoEscrowPlanId) => void;
  onSelectYield: (yieldId: DemoEscrowYieldProductId) => void;
  projectedYield: number;
  selectedPlan: EscrowPlanOption;
  selectedYield: YieldProductOption;
  studentName: string;
}) {
  const planOptions = buildEscrowPlanOptions(
    invoice.amount,
    getFirstReleaseDate(invoice.dueDate),
  );

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <p className="text-sm text-text-secondary">
          {studentName ? `${studentName} · ` : ""}
          {invoice.university.name}
        </p>
        <h1 className="font-serif text-[clamp(2.3rem,6vw,3.6rem)] leading-[0.92] tracking-[-0.04em]">
          Remit payment plan
        </h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Lock the full semester balance in smart contract escrow, release each
          payment on schedule, and keep idle funds earning yield on Arc until
          they are due.
        </p>
      </section>

      <EscrowSectionCard index={1} title="Escrow summary">
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-sm text-text-secondary">
                Committing to escrow
              </div>
              <div className="mt-1 font-serif text-[2rem] leading-none tracking-[-0.04em]">
                ${formatAmount(invoice.amount)} USDC
              </div>
            </div>
            <div className="text-right text-xs text-text-secondary">
              Due {formatDate(invoice.dueDate)}
            </div>
          </div>
          <div className="border-border border-t pt-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-sm text-text-secondary">
                  Projected yield
                </div>
                <div className="mt-1 font-serif text-[1.7rem] leading-none tracking-[-0.04em]">
                  +${formatProjectedDollars(projectedYield)}
                </div>
              </div>
              <div className="text-right text-xs text-text-secondary">
                {selectedYield.title.split(" · ")[0]} at{" "}
                {selectedYield.apy.toFixed(2)}% APY
              </div>
            </div>
          </div>
        </div>
      </EscrowSectionCard>

      <EscrowSectionCard index={2} title="1. Select installments">
        <div className="space-y-3">
          <p className="text-xs text-text-secondary">
            Pick the number of scheduled tuition releases.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {planOptions.map((plan) => {
              const isSelected = plan.id === selectedPlan.id;
              return (
                <button
                  aria-pressed={isSelected}
                  className={`cursor-pointer rounded-2xl border px-3 py-3 text-left transition-colors ${
                    isSelected
                      ? "border-text bg-bg shadow-[0_10px_30px_rgba(10,10,10,0.06)]"
                      : "border-border bg-bg-secondary/40 hover:bg-bg-secondary"
                  }`}
                  key={plan.id}
                  onClick={() => onSelectPlan(plan.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[0.95rem] font-medium">
                        {plan.title}
                      </div>
                      <div className="mt-0.5 text-[11px] text-text-secondary">
                        {plan.subtitle}
                      </div>
                    </div>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? "border-[#3872e0] text-[#3872e0]"
                          : "border-border text-transparent"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                    </span>
                  </div>
                  <div className="mt-3 font-serif text-[1.6rem] leading-none tracking-[-0.04em]">
                    {plan.perReleaseLabel}
                  </div>
                  <div className="mt-1 text-[11px] text-text-secondary">
                    {plan.dateLabel}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-border border-t pt-2">
            <div className="mb-2 text-[11px] text-text-secondary">Schedule</div>
            <div className="space-y-1.5 text-sm">
              {selectedPlan.schedule.map((item) => (
                <div
                  className="flex items-center justify-between gap-4"
                  key={item.label}
                >
                  <div className="text-text-secondary">
                    {item.label} · {formatEscrowDate(item.date)}
                  </div>
                  <div className="tabular-nums">
                    ${formatAmount(item.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </EscrowSectionCard>

      <EscrowSectionCard index={3} title="2. Select yield source">
        <div className="space-y-2.5">
          {YIELD_PRODUCTS.map((product) => {
            const isSelected = product.id === selectedYield.id;
            const productProjectedYield =
              selectedPlan.yieldByProduct[product.id] ?? 0;
            return (
              <button
                aria-pressed={isSelected}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? "border-text bg-bg shadow-[0_10px_30px_rgba(10,10,10,0.06)]"
                    : "border-border bg-bg-secondary/35 hover:bg-bg-secondary"
                }`}
                key={product.id}
                onClick={() => onSelectYield(product.id)}
                type="button"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    isSelected
                      ? "border-[#3872e0] text-[#3872e0]"
                      : "border-border text-transparent"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-current" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{product.title}</div>
                  <div className="mt-0.5 text-[12px] text-text-secondary">
                    {product.description}
                  </div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${product.riskTone}`}
                    >
                      {product.riskLabel}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium tabular-nums">
                    {product.apy.toFixed(2)}% APY
                  </div>
                  <div className="text-[12px] text-text-secondary">
                    {productProjectedYield > 0
                      ? `+$${formatProjectedDollars(productProjectedYield)} projected`
                      : "$0 projected"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </EscrowSectionCard>

      {errorMessage ? (
        <p className="text-sm text-danger">{errorMessage}</p>
      ) : null}

      <button
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.8rem] bg-text px-6 text-base text-bg transition-opacity hover:opacity-92 disabled:opacity-35"
        disabled={isSubmitting}
        onClick={onCommitEscrow}
        type="button"
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Committing to escrow
          </>
        ) : (
          `Commit $${formatAmount(invoice.amount)} to escrow`
        )}
      </button>
      <p className="px-1 text-center text-sm text-text-secondary">
        Your tuition remains scheduled with the university while idle funds can
        earn up to ${formatProjectedDollars(projectedYield)} before release.
      </p>
    </div>
  );
}

function EscrowPlanCompletedScreen({
  completedEscrow,
  onBackToDashboard,
}: {
  completedEscrow: CompletedEscrowState;
  onBackToDashboard: () => void;
}) {
  const { escrowPlan } = completedEscrow;
  return (
    <div className="flex min-h-full items-center justify-center py-6 sm:py-10">
      <div className="w-full max-w-[720px] space-y-4">
        <div className="rounded-3xl border border-border bg-[linear-gradient(145deg,rgba(22,163,74,0.08),transparent_65%)] px-5 py-6 sm:px-6">
          <div className="flex items-center gap-2 text-success">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-white">
              <Check className="h-4 w-4" />
            </span>
            <span className="font-medium">Payment plan escrow is live</span>
          </div>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-sm text-text-secondary">
                Committed balance
              </div>
              <div className="mt-1 font-serif text-[2.6rem] leading-none tracking-[-0.04em]">
                ${formatAmount(escrowPlan.totalCommitment)}
              </div>
            </div>
            <div className="text-right text-sm text-text-secondary">
              <div>University</div>
              <div className="mt-1 font-medium text-text">
                {completedEscrow.universityName}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <EscrowSummaryTile label="Plan" value={escrowPlan.planLabel} />
            <EscrowSummaryTile
              label="Yield path"
              value={
                escrowPlan.projectedYield > 0
                  ? `${escrowPlan.yieldProductLabel.split(" · ")[0]} · +$${formatProjectedDollars(escrowPlan.projectedYield)}`
                  : "Idle escrow"
              }
            />
            <EscrowSummaryTile
              label="Confirmation"
              value={formatConfirmationTime(completedEscrow.confirmationMs)}
            />
          </div>
          {completedEscrow.txHash ? (
            <a
              className="mt-4 inline-flex text-sm text-text-secondary transition-colors hover:text-text"
              href={`${ARC.explorer}/tx/${completedEscrow.txHash}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              View transaction {truncateHash(completedEscrow.txHash)}
            </a>
          ) : null}
        </div>

        <section className="rounded-[1.15rem] border border-border bg-bg-secondary/40 px-4 py-4 sm:px-5">
          <div className="text-sm font-medium">Release schedule</div>
          <div className="mt-3 space-y-2 text-sm">
            {escrowPlan.releaseSchedule.map((item) => (
              <div
                className="flex items-center justify-between gap-4"
                key={item.label}
              >
                <div className="text-text-secondary">
                  {item.label} · {formatEscrowDate(item.date)}
                </div>
                <div className="tabular-nums">${formatAmount(item.amount)}</div>
              </div>
            ))}
          </div>
        </section>

        <button
          className="inline-flex min-h-12 w-full items-center justify-center rounded-[0.8rem] border border-border px-6 text-base transition-colors hover:bg-bg-secondary/45"
          onClick={onBackToDashboard}
          type="button"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

function PaymentFlowFrame({
  canGoBack,
  children,
  onBack,
  stepLabel,
  showHeader = true,
}: {
  canGoBack: boolean;
  children: ReactNode;
  onBack: () => void;
  stepLabel: string;
  showHeader?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-52px)] w-full max-w-[760px] flex-col px-5 py-6 sm:px-8 sm:py-8">
      {showHeader ? (
        <div className="flex items-center justify-between gap-4 pb-7 text-sm text-text-secondary">
          <button
            className="inline-flex items-center gap-2 transition-colors hover:text-text disabled:opacity-35"
            disabled={!canGoBack}
            onClick={onBack}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <p>{stepLabel}</p>
        </div>
      ) : null}

      <div className="flex-1">{children}</div>
    </div>
  );
}

function PaymentSelectionScreen({
  availableAmount,
  canContinue,
  customAmountError,
  customAmountInput,
  invoice,
  onContinue,
  onCustomAmountChange,
  onSelectChoice,
  paymentChoice,
}: {
  availableAmount: number;
  canContinue: boolean;
  customAmountError: string | null;
  customAmountInput: string;
  invoice: InvoiceSummary;
  onContinue: () => void;
  onCustomAmountChange: (value: string) => void;
  onSelectChoice: (choice: PaymentChoice) => void;
  paymentChoice: PaymentChoice;
}) {
  const customAmountInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (paymentChoice !== "custom") return;
    customAmountInputRef.current?.focus();
  }, [paymentChoice]);

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <p className="text-sm text-text-secondary">
          {invoice.statementCount} open statement
          {invoice.statementCount === 1 ? "" : "s"} · Due{" "}
          {formatDate(invoice.dueDate)}
        </p>
        <h1 className="font-serif text-[clamp(2.3rem,6vw,3.6rem)] leading-[0.9] tracking-[-0.04em]">
          ${formatAmount(invoice.amount)}
        </h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-text-secondary">
          <span>${formatAmount(availableAmount)} available</span>
          <span>{invoice.university.name}</span>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.15rem] border border-border bg-bg-secondary/45">
        {invoice.statements.map((statement, index) => (
          <div
            className={`flex items-start justify-between gap-4 px-4 py-4 sm:px-5 ${
              index === 0 ? "" : "border-text/10 border-t"
            }`}
            key={statement.id}
          >
            <div className="min-w-0">
              <p className="text-lg leading-tight">{statement.description}</p>
              <p className="mt-1 text-sm text-text-secondary">
                Due {formatDate(statement.dueDate)}
              </p>
            </div>
            <p className="shrink-0 text-lg">
              ${formatAmount(statement.amount)}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-2.5">
        <PaymentChoiceCard
          active={paymentChoice === "plan"}
          description="Escrow your tuition balance and earn yield."
          onClick={() => onSelectChoice("plan")}
          title="Remit Payment Plan"
        >
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-bg-secondary px-2.5 py-1 text-[11px] font-medium text-text-secondary">
              No enrollment fee
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
              Earn 4.2% APY
            </span>
          </div>
        </PaymentChoiceCard>
        <PaymentChoiceCard
          active={paymentChoice === "full"}
          description={`Pay the full $${formatAmount(invoice.amount)} due now.`}
          onClick={() => onSelectChoice("full")}
          title="Pay in full"
        />
        <PaymentChoiceCard
          active={paymentChoice === "custom"}
          description="Enter a specific amount to pay."
          onClick={() => onSelectChoice("custom")}
          title="Custom amount"
        >
          {paymentChoice === "custom" ? (
            <div className="mt-4 border-border border-t pt-4">
              <label className="flex items-center gap-3 rounded-[0.9rem] border border-border px-4 py-3 focus-within:border-text focus-within:shadow-[0_0_0_1px_var(--color-text)]">
                <span className="font-serif text-[1.6rem] leading-none">$</span>
                <input
                  className="w-full bg-transparent text-[1.1rem] outline-none placeholder:text-text-secondary"
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => onCustomAmountChange(event.target.value)}
                  placeholder="0.00"
                  ref={customAmountInputRef}
                  step="0.01"
                  type="number"
                  value={customAmountInput}
                />
              </label>
            </div>
          ) : null}
        </PaymentChoiceCard>
      </section>

      <section className="space-y-3">

        {customAmountError ? (
          <p className="px-1 text-sm text-text-secondary">
            {customAmountError}
          </p>
        ) : null}

        <button
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.8rem] bg-text px-6 text-base text-bg transition-opacity hover:opacity-92 disabled:opacity-35"
          disabled={!canContinue}
          onClick={onContinue}
          type="button"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    </div>
  );
}

function EscrowSectionCard({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.35rem] border border-border bg-bg px-4 py-4 sm:px-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-text text-[11px] font-medium text-bg">
          {index}
        </span>
        <h3 className="text-[0.92rem] font-medium">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function EscrowSummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-bg/80 px-3 py-3">
      <div className="text-[11px] text-text-secondary">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function PaymentCompletedScreen({
  invoice,
  onBackToDashboard,
  payment,
}: {
  invoice: InvoiceSummary;
  onBackToDashboard: () => void;
  payment: PayCurrentBalanceResult["payment"];
}) {
  return (
    <div className="flex min-h-full items-center justify-center py-6 sm:py-10">
      <div className="w-full max-w-[352px] text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-text text-bg">
          <Check className="h-8 w-8" />
        </div>

        <h1 className="mt-8 font-serif text-[clamp(3.35rem,9vw,5rem)] leading-[0.9] tracking-[-0.05em]">
          ${formatAmount(payment.amount)}
        </h1>
        <p className="mt-3 text-[1.05rem] text-text-secondary">
          Sent to {invoice.university.name}
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          Settled in {formatConfirmationTime(payment.confirmationMs)} ·{" "}
          {formatPaymentTimestamp(payment.confirmedAt)}
        </p>

        <section className="mt-8 overflow-hidden rounded-[1.15rem] border border-border text-left">
          <DetailRow
            label="Status"
            value="Settled"
            valueClassName="text-success"
          />
          <DetailRow label="Network" value="Arc" />
          <DetailRow
            label="Balance status"
            value={
              payment.amount >= invoice.amount
                ? `${invoice.statementCount} statement${invoice.statementCount === 1 ? "" : "s"} cleared`
                : "Balance updated"
            }
          />
          <DetailRow label="Fee" value="$0.00" />
          <DetailRow
            label="Tx hash"
            value={
              payment.txHash ? (
                <a
                  className="transition-colors hover:text-text-secondary"
                  href={`${ARC.explorer}/tx/${payment.txHash}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {truncateHash(payment.txHash)}
                </a>
              ) : (
                "N/A"
              )
            }
            valueClassName="text-sm text-text-secondary"
          />
        </section>

        <button
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-[0.8rem] border border-border px-6 text-base transition-colors hover:bg-bg-secondary/45"
          onClick={onBackToDashboard}
          type="button"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

function PaymentConfirmScreen({
  amount,
  canPay,
  errorMessage,
  invoice,
  isSubmitting,
  onConfirm,
  paymentPower,
  remainingAfterPayment,
}: {
  amount: number;
  canPay: boolean;
  errorMessage: string | null;
  invoice: InvoiceSummary;
  isSubmitting: boolean;
  onConfirm: () => void;
  paymentPower: number;
  remainingAfterPayment: number;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-sm text-text-secondary">
          Sending to {invoice.university.name}
        </p>
        <h1 className="font-serif text-[clamp(2.3rem,9vw,5rem)] leading-[0.9] tracking-[-0.04em]">
          ${formatAmount(amount)}
        </h1>
      </section>

      <PaymentComparisonBanner />

      <section className="overflow-hidden rounded-[1.15rem] border border-border">
        <DetailRow
          label="From"
          value={`Remit balance · $${formatAmount(paymentPower)} ${invoice.currency}`}
        />
        <DetailRow label="To" value={invoice.university.name} />
        <DetailRow label="Network" value="Arc · 1 action" />
        <DetailRow
          label="Statements"
          value={`${invoice.statementCount} · Due ${formatDate(invoice.dueDate)}`}
        />
        <DetailRow
          label="Remaining balance"
          value={`$${formatAmount(remainingAfterPayment)} ${invoice.currency}`}
        />
        <DetailRow label="Fee" value="$0.00" />
      </section>

      {errorMessage ? (
        <p className="text-sm text-danger">{errorMessage}</p>
      ) : !canPay ? (
        <p className="text-sm text-text-secondary">
          Add funds before confirming this payment.
        </p>
      ) : null}

      <button
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.8rem] bg-text px-6 text-base text-bg transition-opacity hover:opacity-92 disabled:opacity-35"
        disabled={isSubmitting}
        onClick={onConfirm}
        type="button"
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Processing payment
          </>
        ) : canPay ? (
          "Confirm payment"
        ) : (
          "Add funds"
        )}
      </button>

      <p className="px-1 text-center text-sm text-text-secondary">
        By confirming, you authorize a transfer on Arc. Payments are final and
        non-reversible once settled.
      </p>
    </div>
  );
}

function PaymentComparisonBanner() {
  return (
    <div className="rounded-[1.15rem] border border-border bg-bg-secondary/45 px-4 py-3.5 sm:px-5">
      <div className="flex items-center justify-between gap-3 text-sm sm:text-[0.95rem]">
        <div className="min-w-0">
          <p className="text-text-secondary">Traditional wire</p>
          <p className="mt-1">~$45 fee · 3–5 business days</p>
        </div>
        <span className="h-8 w-px shrink-0 bg-border" />
        <div className="min-w-0 text-right">
          <p className="text-text-secondary">With Remit</p>
          <p className="mt-1">$0 fee · settles in seconds</p>
        </div>
      </div>
    </div>
  );
}

function PaymentChoiceCard({
  active,
  children,
  description,
  onClick,
  title,
}: {
  active: boolean;
  children?: ReactNode;
  description: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <div
      className={`rounded-[1.15rem] border px-4 py-4 transition-colors sm:px-5 ${
        active
          ? "border-text shadow-[0_0_0_1px_var(--color-text)]"
          : "border-border hover:bg-bg-secondary/35"
      }`}
    >
      <button
        aria-pressed={active}
        className="flex w-full items-start justify-between gap-4 text-left"
        onClick={onClick}
        type="button"
      >
        <div>
          <p className="text-[1.1rem] leading-tight">{title}</p>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
        <span
          className={`mt-1 h-5 w-5 rounded-full border transition-colors ${
            active
              ? "border-text shadow-[inset_0_0_0_4px_var(--color-text)]"
              : "border-border"
          }`}
        />
      </button>
      {children}
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-border border-t px-4 py-4 first:border-t-0 sm:px-5">
      <p className="text-text-secondary">{label}</p>
      <div className={`max-w-[60%] text-right ${valueClassName ?? ""}`}>
        {value}
      </div>
    </div>
  );
}

function truncateHash(txHash: string) {
  return `${txHash.slice(0, 6)}...${txHash.slice(-4)}`;
}

function formatConfirmationTime(confirmationMs: number | null) {
  if (confirmationMs == null) return "seconds";
  const seconds = confirmationMs / 1000;
  return `${seconds % 1 === 0 ? seconds.toFixed(0) : seconds.toFixed(1)} seconds`;
}

function formatPaymentTimestamp(date: Date | null) {
  if (!date) return "Just now";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildEscrowPlanOptions(
  totalCommitment: number,
  firstReleaseDate: Date,
): EscrowPlanOption[] {
  const safeTotal = Math.max(totalCommitment, 0);

  return [
    {
      id: "two-installments",
      title: "2 installments",
      subtitle: "Every 2 months",
      perReleaseLabel: `$${formatAmount(safeTotal / 2)}`,
      dateLabel: `${formatEscrowDate(firstReleaseDate)} - ${formatEscrowDate(addMonths(firstReleaseDate, 2))}`,
      yieldByProduct: { usyc: 42, aave: 54, none: 0 },
      schedule: buildEscrowSchedule(safeTotal, 2, 2, firstReleaseDate),
    },
    {
      id: "four-installments",
      title: "4 installments",
      subtitle: "Monthly",
      perReleaseLabel: `$${formatAmount(safeTotal / 4)}`,
      dateLabel: `${formatEscrowDate(firstReleaseDate)} - ${formatEscrowDate(addMonths(firstReleaseDate, 3))}`,
      yieldByProduct: { usyc: 127, aave: 164, none: 0 },
      schedule: buildEscrowSchedule(safeTotal, 4, 1, firstReleaseDate),
    },
  ];
}

function buildEscrowSchedule(
  totalCommitment: number,
  count: number,
  monthStep: number,
  startDate: Date,
) {
  const evenAmount = Math.floor((totalCommitment / count) * 100) / 100;
  return Array.from({ length: count }, (_, index) => {
    const isLast = index === count - 1;
    const releasedBeforeLast = evenAmount * index;
    return {
      label: `Installment ${index + 1}`,
      date: addMonths(startDate, monthStep * index),
      amount: isLast
        ? Number((totalCommitment - releasedBeforeLast).toFixed(2))
        : evenAmount,
    };
  });
}

function buildEscrowPlanDetails({
  projectedYield,
  selectedPlan,
  selectedYield,
  totalCommitment,
}: {
  projectedYield: number;
  selectedPlan: EscrowPlanOption;
  selectedYield: YieldProductOption;
  totalCommitment: number;
}): DemoEscrowPlan {
  return {
    planId: selectedPlan.id,
    planLabel: selectedPlan.title,
    planSubtitle: selectedPlan.subtitle,
    perReleaseLabel: selectedPlan.perReleaseLabel,
    dateLabel: selectedPlan.dateLabel,
    totalCommitment,
    yieldProductId: selectedYield.id,
    yieldProductLabel: selectedYield.title,
    yieldApy: selectedYield.apy,
    projectedYield,
    releaseSchedule: selectedPlan.schedule.map((item) => ({
      label: item.label,
      date: item.date,
      amount: item.amount,
    })),
  };
}

function getFirstReleaseDate(dueDate: Date) {
  const nextDate = new Date(dueDate);
  nextDate.setDate(nextDate.getDate() - 1);
  return nextDate;
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function formatProjectedDollars(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function formatEscrowDate(date?: Date) {
  if (!date) return "TBD";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
