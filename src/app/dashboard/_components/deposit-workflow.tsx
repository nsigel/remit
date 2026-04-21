"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ARC, CCTP_CHAINS, DEPOSIT_CURRENCIES } from "~/lib/constants";
import { useDemoSession } from "~/lib/demo-session";
import {
  getBridgeDurationMs,
  getStableFxGuaranteedRate,
  STABLEFX_TOTAL_DURATION_MS,
  type StableFxQuoteSnapshot,
} from "~/lib/stablefx";
import { useTheme } from "~/lib/theme";
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

type CompletedTxState = {
  txHash: string;
  confirmationMs: number;
};

type ConfettiParticle = {
  id: number;
  color: string;
  delay: number;
  drift: number;
  duration: number;
  left: string;
  rotate: number;
};

const RECOMMENDED_DEPOSIT_USDC_AMOUNTS = [5000, 15000, 22500] as const;
const CONFETTI_PARTICLES: ConfettiParticle[] = [
  {
    color: "#0052ff",
    delay: 0,
    drift: -30,
    duration: 1.8,
    id: 1,
    left: "8%",
    rotate: -180,
  },
  {
    color: "#00a67e",
    delay: 0.06,
    drift: 34,
    duration: 1.95,
    id: 2,
    left: "14%",
    rotate: 210,
  },
  {
    color: "#f59e0b",
    delay: 0.12,
    drift: -22,
    duration: 1.7,
    id: 3,
    left: "20%",
    rotate: -160,
  },
  {
    color: "#0052ff",
    delay: 0.03,
    drift: 26,
    duration: 1.9,
    id: 4,
    left: "28%",
    rotate: 190,
  },
  {
    color: "#00a67e",
    delay: 0.14,
    drift: -18,
    duration: 1.75,
    id: 5,
    left: "36%",
    rotate: -220,
  },
  {
    color: "#f59e0b",
    delay: 0.05,
    drift: 16,
    duration: 1.85,
    id: 6,
    left: "44%",
    rotate: 180,
  },
  {
    color: "#0052ff",
    delay: 0.09,
    drift: -12,
    duration: 1.65,
    id: 7,
    left: "50%",
    rotate: -150,
  },
  {
    color: "#00a67e",
    delay: 0.01,
    drift: 10,
    duration: 1.8,
    id: 8,
    left: "56%",
    rotate: 170,
  },
  {
    color: "#f59e0b",
    delay: 0.16,
    drift: -28,
    duration: 1.9,
    id: 9,
    left: "62%",
    rotate: -200,
  },
  {
    color: "#0052ff",
    delay: 0.08,
    drift: 22,
    duration: 1.7,
    id: 10,
    left: "70%",
    rotate: 160,
  },
  {
    color: "#00a67e",
    delay: 0.11,
    drift: -16,
    duration: 1.8,
    id: 11,
    left: "78%",
    rotate: -190,
  },
  {
    color: "#f59e0b",
    delay: 0.04,
    drift: 30,
    duration: 1.95,
    id: 12,
    left: "86%",
    rotate: 220,
  },
];

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

const SUPPORTED_FLAG_CURRENCIES = [
  {
    country: "Australia",
    flagSrc: "/flags/australia.svg",
    name: "Australian Dollar Stablecoin",
    symbol: "AUD",
  },
  {
    country: "Brazil",
    flagSrc: "/flags/brazil.svg",
    name: "Brazilian Real Stablecoin",
    symbol: "BRZ",
  },
  {
    country: "Canada",
    flagSrc: "/flags/canada.svg",
    name: "Canadian Dollar Stablecoin",
    symbol: "QCAD",
  },
  {
    country: "Mexico",
    flagSrc: "/flags/mexico.svg",
    name: "Mexican Peso Stablecoin",
    symbol: "MXNB",
  },
  {
    country: "Philippines",
    flagSrc: "/flags/philipines.svg",
    name: "Philippine Peso Coin",
    symbol: "PHPC",
  },
  {
    country: "South Africa",
    flagSrc: "/flags/south-africa.svg",
    name: "South African Rand Stablecoin",
    symbol: "ZAR",
  },
  {
    country: "South Korea",
    flagSrc: "/flags/south-korea.svg",
    name: "Korean Won Stablecoin",
    symbol: "KRW",
  },
] as const;

function isArcNetworkTile(
  entry: NetworkChainTile,
): entry is { domain: number; arcLogo: true } {
  return "arcLogo" in entry && entry.arcLogo;
}

export function DepositWorkflow({
  canClose,
  onClose,
  onLockChange,
}: DepositWorkflowProps) {
  const { actions } = useDemoSession();
  const { theme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const [stage, setStage] = useState<DepositStage>("input");
  const [selectedChain, setSelectedChain] = useState<
    (typeof CCTP_CHAINS)[number] | null
  >(null);
  const [currency, setCurrency] = useState<
    (typeof DEPOSIT_CURRENCIES)[number]["symbol"] | null
  >(null);
  const [amount, setAmount] = useState("");
  const [amountConfirmed, setAmountConfirmed] = useState(false);
  const [sourceSelectionConfirmed, setSourceSelectionConfirmed] =
    useState(false);
  const [depositInOriginalCurrency, setDepositInOriginalCurrency] =
    useState(false);
  const [activeProcessStep, setActiveProcessStep] = useState(0);
  const [processingQuote, setProcessingQuote] =
    useState<StableFxQuoteSnapshot | null>(null);
  const [completedTx, setCompletedTx] = useState<CompletedTxState | null>(null);
  const [confettiBurstKey, setConfettiBurstKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const previousStageRef = useRef<DepositStage>("input");

  const selectedCurrency = DEPOSIT_CURRENCIES.find(
    (depositCurrency) => depositCurrency.symbol === currency,
  );
  const parsedAmount = Number.parseFloat(amount) || 0;
  const canReview =
    sourceSelectionConfirmed &&
    selectedChain != null &&
    currency != null &&
    parsedAmount > 0 &&
    amountConfirmed;
  const extraNetworkCount = CCTP_CHAINS.length - NETWORK_ICON_GRID.length;
  const arcFullLogoSrc =
    theme === "dark" ? "/Arc_Full_Logo_White.svg" : "/Arc_Full_Logo_Navy.svg";
  const arcIconSrc =
    theme === "dark" ? "/Arc_Icon_White.svg" : "/Arc_Icon_Navay.svg";
  const swapHintClassName =
    theme === "dark"
      ? "mt-2.5 rounded-lg border border-blue-400/35 bg-blue-500/15 px-2.5 py-1.5 text-[11px] font-medium text-blue-200"
      : "mt-2.5 rounded-lg border border-blue-300 bg-blue-100 px-2.5 py-1.5 text-[11px] font-medium text-blue-900";
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
  const settledAmount =
    activeQuote?.toAmount ?? (parsedAmount > 0 ? parsedAmount : 0);
  const recommendedDepositAmounts = RECOMMENDED_DEPOSIT_USDC_AMOUNTS.map(
    (targetUsdcAmount) =>
      convertFromUsdcTarget({
        targetUsdcAmount,
        depositCurrency: currency ?? "USDC",
      }),
  );
  useEffect(() => {
    return () => onLockChange(false);
  }, [onLockChange]);

  useEffect(() => {
    if (
      stage === "done" &&
      previousStageRef.current !== "done" &&
      !prefersReducedMotion
    ) {
      setConfettiBurstKey((current) => current + 1);
    }

    previousStageRef.current = stage;
  }, [prefersReducedMotion, stage]);

  const resetStepState = () => {
    setSourceSelectionConfirmed(false);
    setAmountConfirmed(false);
    setDepositInOriginalCurrency(false);
    setErrorMessage(null);
    setProcessingQuote(null);
    setActiveProcessStep(0);
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
    setActiveProcessStep(0);
    onLockChange(true);

    try {
      await delay(
        getBridgeDurationMs({
          arcNative: isArcSource,
          autoSwap,
        }),
      );

      if (autoSwap) {
        setActiveProcessStep(1);
        await delay(STABLEFX_TOTAL_DURATION_MS);
      }

      setActiveProcessStep(processingSteps.length - 1);
      await delay(350);

      const result = actions.commitDeposit({
        amount: parsedAmount,
        autoSwap,
        currency,
        settlementCurrency: autoSwap ? "USDC" : currency,
        sourceChainDomain: selectedChain.domain,
        swapQuote: lockedQuote ?? undefined,
      });

      if (
        result.transaction.txHash &&
        result.transaction.confirmationMs != null
      ) {
        setCompletedTx({
          txHash: result.transaction.txHash,
          confirmationMs: result.transaction.confirmationMs,
        });
      }

      setStage("done");
      onLockChange(false);
    } catch (error) {
      setStage("input");
      setActiveProcessStep(0);
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

  const processingSteps = buildProcessingSteps({
    chain: selectedChain,
    currency,
    autoSwap,
  });
  const totalProcessingSteps = processingSteps.length;
  const currentProcessStep =
    stage === "done"
      ? totalProcessingSteps
      : stage === "processing"
        ? activeProcessStep
        : 0;

  const depositResolutionContent =
    stage !== "input" ? (
      <div className="space-y-3">
        {/* Processing steps card */}
        <div className="overflow-hidden rounded-[1.35rem] border border-border bg-bg">
          {/* Progress bar */}
          {stage !== "done" ? (
            <div className="relative h-[3px] bg-bg-secondary">
              <div
                className="absolute left-0 top-0 h-full rounded-sm bg-accent transition-[width] duration-600 ease-out"
                style={{
                  width: `${(currentProcessStep / totalProcessingSteps) * 100}%`,
                }}
              />
            </div>
          ) : (
            <div className="h-[3px] bg-success" />
          )}

          <div className="py-1">
            {processingSteps.map((ps, i) => {
              const stepDone = currentProcessStep > i;
              const stepActive = currentProcessStep === i && stage !== "done";
              return (
                <div
                  className="flex items-center gap-3 px-4 py-2.5 transition-opacity"
                  key={ps.label}
                  style={{ opacity: stepDone || stepActive ? 1 : 0.35 }}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all ${
                      stepDone
                        ? "bg-success text-white"
                        : stepActive
                          ? "border-[1.5px] border-accent bg-accent/8"
                          : "border-[1.5px] border-border bg-bg-secondary"
                    }`}
                  >
                    {stepDone ? (
                      <Check className="h-3 w-3" />
                    ) : stepActive ? (
                      <LoaderCircle className="h-3 w-3 animate-spin text-accent" />
                    ) : (
                      <span className="text-[11px] text-text-secondary">
                        {i + 1}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{ps.label}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-secondary">
                      {ps.sublabel}
                      {ps.showCircleLogo ? (
                        <Image
                          alt="Circle"
                          className="block h-[9px] w-auto"
                          height={9}
                          src={
                            theme === "dark"
                              ? "/circle-logo-white.svg"
                              : "/circle-logo-2021.svg"
                          }
                          unoptimized
                          width={36}
                        />
                      ) : null}
                      {ps.showArcIcon ? (
                        <Image
                          alt="Arc"
                          className="h-2.5 w-2.5 shrink-0"
                          height={10}
                          src={arcIconSrc}
                          unoptimized
                          width={10}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirmation card — shown when done */}
        {stage === "done" ? (
          <>
            <div
              className="relative overflow-hidden rounded-[1.35rem] border border-border p-4 animate-in fade-in slide-in-from-top-2 duration-400"
              style={{
                background:
                  "linear-gradient(135deg, var(--success-soft, rgba(0,166,126,0.10)) 0%, var(--bg) 60%)",
              }}
            >
              {!prefersReducedMotion ? (
                <DepositCompletionConfetti key={confettiBurstKey} />
              ) : null}
              <div className="mb-2.5 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-semibold text-success">
                  Settled on Arc
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-text-secondary">
                    Amount received
                  </div>
                  <div className="mt-0.5 font-serif text-[1.35rem]">
                    ${formatAmount(settledAmount)} USDC
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-text-secondary">
                    Confirmation time
                  </div>
                  <div className="mt-0.5 font-serif text-[1.35rem] text-success">
                    {completedTx?.confirmationMs != null
                      ? `${(completedTx.confirmationMs / 1000).toFixed(1)}s`
                      : "—"}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-border border-t pt-2.5">
                {completedTx?.txHash ? (
                  <a
                    className="font-mono text-[11px] text-text-secondary transition-colors hover:text-text"
                    href={`${ARC.explorer}/tx/${completedTx.txHash}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {completedTx.txHash.slice(0, 12)}...
                  </a>
                ) : null}
                <Image
                  alt="Arc"
                  className="block h-3 w-auto"
                  height={12}
                  src={
                    theme === "dark"
                      ? "/Arc_Full_Logo_White.svg"
                      : "/Arc_Full_Logo_Navy.svg"
                  }
                  unoptimized
                  width={48}
                />
              </div>
            </div>

            {/* Savings badge */}
            <div className="flex items-center justify-between rounded-xl border border-accent/15 bg-accent/8 px-3.5 py-2.5 animate-in fade-in zoom-in-95 duration-400 delay-200">
              <div>
                <div className="text-xs font-semibold text-accent">
                  You saved $45 in wire fees
                </div>
                <div className="mt-0.5 text-[11px] text-text-secondary">
                  And 3–5 days of waiting time.
                </div>
              </div>
              <Image
                alt="Circle"
                className="block h-3.5 w-auto"
                height={14}
                src={
                  theme === "dark"
                    ? "/circle-logo-white.svg"
                    : "/circle-logo-2021.svg"
                }
                unoptimized
                width={56}
              />
            </div>

            <button
              className="w-full cursor-pointer rounded-full bg-text py-3 font-medium text-bg transition-opacity hover:opacity-90"
              onClick={onClose}
              type="button"
            >
              Back to dashboard
            </button>
          </>
        ) : null}
      </div>
    ) : null;

  return (
    <WorkflowShell canClose={canClose} onClose={onClose} title="Deposit funds">
      <WorkflowStep
        action={
          sourceSelectionConfirmed && stage === "input" ? (
            <button
              className="cursor-pointer text-text-secondary text-xs transition-colors hover:text-text"
              onClick={handleEditChain}
              type="button"
            >
              Edit
            </button>
          ) : undefined
        }
        state={sourceSelectionConfirmed ? "completed" : "active"}
        stepLabel="Step 1"
        summary={
          sourceSelectionConfirmed && selectedChain && selectedCurrency ? (
            <p className="text-sm text-text-secondary">
              {`${selectedChain.name} · ${selectedCurrency.symbol}`}
            </p>
          ) : undefined
        }
        title={
          sourceSelectionConfirmed && selectedChain && selectedCurrency
            ? `${selectedChain.name} · ${selectedCurrency.symbol}`
            : "Choose source and currency"
        }
      >
        <div className="space-y-5">
          <div>
            <div className="mb-3 text-sm text-text-secondary">Deposit as</div>
            <div className="grid grid-cols-3 gap-2">
              {DEPOSIT_CURRENCIES.map((depositCurrency) => {
                const isSelected = currency === depositCurrency.symbol;
                return (
                  <button
                    className={`cursor-pointer rounded-xl border px-3 py-6 text-left transition-colors ${
                      isSelected
                        ? "border-text bg-text text-bg"
                        : "border-border hover:bg-bg-secondary"
                    }`}
                    key={depositCurrency.symbol}
                    onClick={() => {
                      setSelectedChain(null);
                      setCurrency(depositCurrency.symbol);
                      setAmount("");
                      resetStepState();
                    }}
                    type="button"
                  >
                    <div className="flex items-center gap-1.5">
                      <Image
                        alt=""
                        className="h-[18px] w-[18px] shrink-0"
                        height={18}
                        src={getStablecoinIconSrc(depositCurrency.symbol) ?? ""}
                        unoptimized
                        width={18}
                      />
                      <span className="font-semibold text-lg">
                        {depositCurrency.symbol}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3">
              <div className="mb-2 text-text-secondary text-xs">
                Circle partner stablecoins:
              </div>
              <div className="flex items-center px-1">
                
                {SUPPORTED_FLAG_CURRENCIES.map((supportedCurrency, index) => (
                  <div
                    className={`group relative ${index === 0 ? "" : "-ml-2.5"}`}
                    key={supportedCurrency.flagSrc}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-bg bg-bg shadow-[0_8px_20px_rgba(10,10,10,0.08)] ring-1 ring-border/70 transition-transform duration-150 group-hover:z-10 group-hover:-translate-y-0.5 group-focus-within:z-10 group-focus-within:-translate-y-0.5">
                      <Image
                        alt={supportedCurrency.country}
                        className="h-7 w-7 rounded-full object-cover"
                        height={28}
                        src={supportedCurrency.flagSrc}
                        unoptimized
                        width={28}
                      />
                    </div>
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md border border-border bg-bg px-2.5 py-1.5 text-[11px] text-text opacity-0 shadow-[0_12px_30px_rgba(10,10,10,0.12)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                      {supportedCurrency.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {currency && currency !== "USDC" ? (
              <div className={swapHintClassName}>
                {currency} will be auto-swapped to USDC at the best available
                rate via StableFX.
              </div>
            ) : null}
          </div>

          <div className="border-border border-t pt-4">
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
                    className={`flex aspect-square items-center justify-center rounded-lg border p-2 transition-colors ${
                      !currency
                        ? "cursor-not-allowed border-border opacity-45"
                        : isSelected
                          ? "cursor-pointer border-text ring-2 ring-text"
                          : "cursor-pointer border-border hover:bg-bg-secondary"
                    }`}
                    disabled={!currency}
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
            {!currency ? (
              <p className="mt-2 text-xs text-text-secondary">
                Select a currency first to choose a source chain.
              </p>
            ) : null}
          </div>

          <button
            className="w-full cursor-pointer rounded-full bg-text py-3 font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!selectedChain || !currency}
            onClick={() => {
              setSourceSelectionConfirmed(true);
              setErrorMessage(null);
            }}
            type="button"
          >
            Continue
          </button>
        </div>
      </WorkflowStep>

      {sourceSelectionConfirmed && selectedChain && currency ? (
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
              <div className="flex items-center justify-between rounded-xl border border-border bg-bg-secondary px-3.5 py-2.5 text-xs">
                <span className="text-text-secondary">Traditional wire</span>
                <span className="font-semibold text-danger">
                  ~$45 · 3–5 days
                </span>
                <span className="h-3.5 w-px bg-border" />
                <span className="text-text-secondary">Via Remit</span>
                <span className="font-semibold text-success">$0 · ~7s</span>
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

      {canReview && currency ? (
        <WorkflowStep
          state={stage === "input" ? "active" : "completed"}
          stepLabel="Step 3"
          title="Review deposit"
        >
          <div className="space-y-3 text-sm">
            {/* Receipt card */}
            <div className="overflow-hidden rounded-[1.35rem] border border-border bg-bg">
              {/* You send */}
              <div className="px-5 pt-[18px] pb-3.5">
                <div className="text-[15px] font-medium font-serif italic text-text-secondary/60 tracking-wide">
                  You send
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-secondary px-3 py-1.5">
                    <Image
                      alt={currency}
                      className="h-[18px] w-[18px] shrink-0"
                      height={18}
                      src={getStablecoinIconSrc(currency) ?? ""}
                      unoptimized
                      width={18}
                    />
                    <span className="font-semibold text-[13px]">
                      {currency}
                    </span>
                  </span>
                  <span className="font-serif text-[2.1rem] tracking-tight leading-none">
                    {formatCurrencyAmount(parsedAmount, currency)}
                  </span>
                </div>
              </div>

              {autoSwap ? (
                <>
                  {/* Conversion divider */}
                  <div className="flex items-center justify-between border-border border-y bg-bg-secondary px-5 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-text-secondary/60">
                        via StableFX
                      </span>
                      <Image
                        alt="Circle"
                        className="block h-[11px] w-auto"
                        height={11}
                        src={
                          theme === "dark"
                            ? "/circle-logo-white.svg"
                            : "/circle-logo-2021.svg"
                        }
                        unoptimized
                        width={44}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-text-secondary/60">
                      1 {currency} ={" "}
                      {reviewQuote ? reviewQuote.rate.toFixed(4) : "..."} USDC
                    </span>
                  </div>

                  {/* You receive */}
                  <div className="px-5 pt-3.5 pb-[18px]">
                    <div className="text-[15px] font-medium font-serif italic text-text-secondary/60 tracking-wide">
                      You receive
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-secondary px-3 py-1.5">
                        <Image
                          alt="USDC"
                          className="h-[18px] w-[18px] shrink-0"
                          height={18}
                          src="/usdc.svg"
                          unoptimized
                          width={18}
                        />
                        <span className="font-semibold text-[13px]">USDC</span>
                      </span>
                      <span className="font-serif text-[2.1rem] tracking-tight leading-none">
                        ${formatAmount(settledAmount)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="border-border border-t bg-bg-secondary px-5 py-2.5">
                  <span className="text-[11px] text-text-secondary/60">
                    Arrives as-is via CCTP v2
                  </span>
                </div>
              )}

              {/* Footer badges */}
              <div className="flex flex-wrap items-center gap-2 border-border border-t px-5 py-2.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
                  ⚡ ~7s
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
                  $0 fees
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-bg-secondary px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                  <Image
                    alt=""
                    className="h-2.5 w-2.5 shrink-0"
                    height={10}
                    src={arcIconSrc}
                    unoptimized
                    width={10}
                  />
                  Arc
                </span>
              </div>
            </div>

            {shouldOfferSwap ? (
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-bg px-3.5 py-2.5">
                <input
                  checked={depositInOriginalCurrency}
                  className="h-4 w-4 accent-[var(--fg)]"
                  onChange={(event) =>
                    setDepositInOriginalCurrency(event.target.checked)
                  }
                  type="checkbox"
                />
                <span className="text-xs text-text-secondary">
                  <span className="font-medium text-text">
                    Keep as {currency}
                  </span>{" "}
                  — skip the swap, wait for a better rate.
                </span>
              </label>
            ) : null}

            {errorMessage ? (
              <p className="text-danger">{errorMessage}</p>
            ) : null}

            <button
              className="w-full cursor-pointer rounded-full bg-text py-3 font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={stage === "processing"}
              onClick={handleStartDeposit}
              type="button"
            >
              {stage === "processing" ? "Starting deposit..." : "Deposit funds"}
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

function DepositCompletionConfetti() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-44 overflow-hidden"
    >
      {CONFETTI_PARTICLES.map((particle) => (
        <motion.span
          animate={{
            opacity: [0, 1, 1, 0],
            rotate: [0, particle.rotate],
            scale: [0.75, 1, 0.9],
            x: [0, particle.drift],
            y: [-8, 20, 152],
          }}
          className="absolute top-3 block h-3 w-2 rounded-full"
          initial={{
            opacity: 0,
            rotate: 0,
            scale: 0.7,
            x: 0,
            y: -20,
          }}
          key={particle.id}
          style={{
            backgroundColor: particle.color,
            left: particle.left,
          }}
          transition={{
            delay: particle.delay,
            duration: particle.duration,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
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
  const rateToUsdc =
    depositCurrency === "USDC"
      ? 1
      : getStableFxGuaranteedRate(depositCurrency, "USDC");
  if (rateToUsdc == null || rateToUsdc <= 0) {
    return targetUsdcAmount;
  }

  const convertedAmount = targetUsdcAmount / rateToUsdc;
  if (depositCurrency === "JPYC") {
    return Math.ceil(convertedAmount);
  }

  return roundUpAmount(convertedAmount, 2);
}

function roundUpAmount(value: number, digits: number) {
  const multiplier = 10 ** digits;
  return Math.ceil(value * multiplier) / multiplier;
}

type ProcessingStepDef = {
  label: string;
  sublabel: string;
  showCircleLogo?: boolean;
  showArcIcon?: boolean;
};

function buildProcessingSteps({
  chain,
  currency,
  autoSwap,
}: {
  chain: { name: string } | null;
  currency: string | null;
  autoSwap: boolean;
}): ProcessingStepDef[] {
  const chainName = chain?.name ?? "source";
  const steps: ProcessingStepDef[] = [
    {
      label: `Sending ${currency ?? "funds"} from ${chainName}`,
      sublabel: "CCTP v2 bridge initiated",
    },
  ];

  if (autoSwap) {
    steps.push({
      label: `Swapping ${currency} → USDC via StableFX`,
      sublabel: "Powered by Circle",
      showCircleLogo: true,
    });
  }

  steps.push({
    label: "Crediting USDC to Remit wallet",
    sublabel: "Settled on Arc blockchain",
    showArcIcon: true,
  });

  return steps;
}

function getStablecoinIconSrc(currency: string) {
  if (currency === "USDC") return "/usdc.svg";
  if (currency === "EURC") return "/eurc.svg";
  if (currency === "JPYC") return "/jpyc.svg";

  return null;
}
