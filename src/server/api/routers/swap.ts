import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { mockConfirmationMs, mockTxHash, nextBlockNumber } from "~/lib/mock";
import type { StableFxQuoteSnapshot } from "~/lib/stablefx";
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

export const swapRouter = createTRPCRouter({
	initiate: studentProcedure
		.input(
			z.object({
				fromCurrency: z.string(),
				toCurrency: z.string(),
				fromAmount: z.number().positive(),
				quote: stableFxQuoteSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (input.fromCurrency === input.toCurrency) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Swap requires two different currencies.",
				});
			}

			if (
				input.quote.fromCurrency !== input.fromCurrency ||
				input.quote.toCurrency !== input.toCurrency
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Quote does not match the requested swap.",
				});
			}

			if (Math.abs(input.quote.fromAmount - input.fromAmount) > 0.000001) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Quote amount does not match the requested swap.",
				});
			}

			const balance = await ctx.db.balance.findUnique({
				where: {
					studentId_currency: {
						studentId: ctx.student.id,
						currency: input.fromCurrency,
					},
				},
			});

			if (!balance || balance.amount < input.fromAmount) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Insufficient ${input.fromCurrency} balance.`,
				});
			}

			return ctx.db.transaction.create({
				data: {
					studentId: ctx.student.id,
					type: "SWAP",
					status: "PROCESSING",
					amount: input.fromAmount,
					currency: input.fromCurrency,
					fromCurrency: input.fromCurrency,
					toCurrency: input.toCurrency,
					toAmount: input.quote.toAmount,
					exchangeRate: input.quote.rate,
					gasSponsor: "Remit Platform",
				},
			});
		}),

	confirm: studentProcedure
		.input(z.object({ transactionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const confirmationMs = mockConfirmationMs();
			const confirmedAt = new Date();

			return ctx.db.$transaction(async (db) => {
				const tx = await db.transaction.findFirst({
					where: {
						id: input.transactionId,
						studentId: ctx.student.id,
						type: "SWAP",
					},
				});

				if (!tx) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}

				if (
					tx.fromCurrency == null ||
					tx.toCurrency == null ||
					tx.toAmount == null
				) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Swap transaction is missing route details.",
					});
				}

				if (tx.status === "CONFIRMED") {
					return tx;
				}

				const balance = await db.balance.findUnique({
					where: {
						studentId_currency: {
							studentId: ctx.student.id,
							currency: tx.fromCurrency,
						},
					},
				});

				if (!balance || balance.amount < tx.amount) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Insufficient ${tx.fromCurrency} balance.`,
					});
				}

				const updated = await db.transaction.update({
					where: { id: tx.id },
					data: {
						status: "CONFIRMED",
						txHash: mockTxHash(),
						blockNumber: nextBlockNumber(),
						confirmationMs,
						confirmedAt,
					},
				});

				await db.balance.update({
					where: {
						studentId_currency: {
							studentId: ctx.student.id,
							currency: tx.fromCurrency,
						},
					},
					data: { amount: { decrement: tx.amount } },
				});

				await db.balance.upsert({
					where: {
						studentId_currency: {
							studentId: ctx.student.id,
							currency: tx.toCurrency,
						},
					},
					update: { amount: { increment: tx.toAmount } },
					create: {
						studentId: ctx.student.id,
						currency: tx.toCurrency,
						amount: tx.toAmount,
					},
				});

				return updated;
			});
		}),
});
