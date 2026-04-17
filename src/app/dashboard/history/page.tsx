"use client";

import { useState } from "react";
import { ARC } from "~/lib/constants";
import { api } from "~/trpc/react";
import { ThemeToggle } from "../../_components/theme-toggle";
import { DashboardHeader } from "../_components/dashboard-header";

type Filter = "all" | "DEPOSIT" | "PAYMENT" | "SWAP";

export default function HistoryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data: transactions, isLoading } = api.transaction.list.useQuery(
    filter === "all" ? undefined : { type: filter },
  );

  const filters: { label: string; value: Filter }[] = [
    { label: "All", value: "all" },
    { label: "Deposits", value: "DEPOSIT" },
    { label: "Payments", value: "PAYMENT" },
    { label: "Swaps", value: "SWAP" },
  ];

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

        {isLoading ? (
          <p className="text-text-secondary">Loading...</p>
        ) : !transactions || transactions.length === 0 ? (
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
                  <div className="mt-0.5 text-text-secondary text-xs">
                    {new Date(tx.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {tx.confirmationMs != null &&
                      ` · ${(tx.confirmationMs / 1000).toFixed(2)}s`}
                    {tx.txHash && (
                      <>
                        {" · "}
                        <a
                          className="cursor-pointer transition-colors hover:text-text"
                          href={`${ARC.explorer}/tx/${tx.txHash}`}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {tx.txHash.slice(0, 10)}...
                        </a>
                      </>
                    )}
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
                    {tx.type === "SWAP"
                      ? `${formatAmount(tx.toAmount ?? 0)} ${tx.toCurrency}`
                      : `$${formatAmount(tx.amount)}`}
                  </div>
                  <div className="text-text-secondary text-xs">
                    {tx.status === "CONFIRMED" ? "Final" : tx.status}
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

function formatAmount(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function txLabel(
  type: string,
  sourceChain?: string | null,
  fromCurrency?: string | null,
  toCurrency?: string | null,
): string {
  if (type === "DEPOSIT") return `Deposit from ${sourceChain ?? "unknown"}`;
  if (type === "SWAP") return `Swap ${fromCurrency} → ${toCurrency}`;
  return "Statement Payment";
}
