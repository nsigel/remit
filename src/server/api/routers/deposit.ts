import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { CCTP_CHAINS, DEPOSIT_STEPS } from "~/lib/constants";
import { mockTxHash, nextBlockNumber } from "~/lib/mock";
import {
	getDepositFlowDurationMs,
	type StableFxQuoteSnapshot,
} from "~/lib/stablefx";
import { createTRPCRouter, studentProcedure } from "../trpc";

const stableFxQuoteSchema: z.ZodType<StableFxQuoteSnapshot> = z.object({
	fromCurrency: z.string(),
	toCurrency: z.string(),
	fromAmount: z.number(),
	rate: z.number(),
	toAmount: z.number(),
	spread: z.number(),
	benchmarkSpread: z.number(),
	savedAmount: z.number(),
});

export const depositRouter = createTRPCRouter({
	initiate: studentProcedure
		.input(
			z.object({
				amount: z.number().positive(),
				currency: z.string(),
				sourceChainDomain: z.number(),
				autoSwap: z.boolean().default(false),
				settlementCurrency: z.string(),
				swapQuote: stableFxQuoteSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const chain = CCTP_CHAINS.find(
				(c) => c.domain === input.sourceChainDomain,
			);
			if (!chain) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid source chain",
				});
			}

			const transaction = await ctx.db.transaction.create({
				data: {
					studentId: ctx.student.id,
					type: "DEPOSIT",
					status: "PROCESSING",
					amount: input.amount,
					currency: input.currency,
					sourceChain: chain.name,
					sourceChainDomain: chain.domain,
					depositStep: "APPROVE",
					gasSponsor: "Remit Platform",
					...(input.autoSwap &&
					input.swapQuote &&
					input.currency !== input.settlementCurrency
						? {
								fromCurrency: input.swapQuote.fromCurrency,
								toCurrency: input.swapQuote.toCurrency,
								toAmount: input.swapQuote.toAmount,
								exchangeRate: input.swapQuote.rate,
							}
						: {}),
				},
			});

			return transaction;
		}),

	progress: studentProcedure
		.input(z.object({ transactionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const tx = await ctx.db.transaction.findFirst({
				where: {
					id: input.transactionId,
					studentId: ctx.student.id,
					type: "DEPOSIT",
				},
			});

			if (!tx) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const currentIdx = DEPOSIT_STEPS.indexOf(
				tx.depositStep as (typeof DEPOSIT_STEPS)[number],
			);
			if (currentIdx === -1 || currentIdx >= DEPOSIT_STEPS.length - 1) {
				return tx; // Already complete
			}

			const nextStep = DEPOSIT_STEPS[currentIdx + 1];
			if (!nextStep) {
				return tx;
			}
			const isComplete = nextStep === "COMPLETE";
			const autoSwapActive = tx.toCurrency != null && tx.toAmount != null;

			const updated = await ctx.db.transaction.update({
				where: { id: tx.id },
				data: {
					depositStep: nextStep,
					...(isComplete && {
						status: "CONFIRMED",
						txHash: mockTxHash(),
						blockNumber: nextBlockNumber(),
						networkFee: "$0.01",
						confirmationMs: getDepositFlowDurationMs({
							arcNative: tx.sourceChainDomain === 26,
							autoSwap: autoSwapActive,
						}),
						confirmedAt: new Date(),
					}),
				},
			});

			// Credit balance on completion
			if (isComplete) {
				await ctx.db.balance.upsert({
					where: {
						studentId_currency: {
							studentId: ctx.student.id,
							currency: tx.toCurrency ?? tx.currency,
						},
					},
					update: { amount: { increment: tx.toAmount ?? tx.amount } },
					create: {
						studentId: ctx.student.id,
						currency: tx.toCurrency ?? tx.currency,
						amount: tx.toAmount ?? tx.amount,
					},
				});
			}

			return updated;
		}),

	list: studentProcedure.query(async ({ ctx }) => {
		return ctx.db.transaction.findMany({
			where: { studentId: ctx.student.id, type: "DEPOSIT" },
			orderBy: { createdAt: "desc" },
		});
	}),
});
