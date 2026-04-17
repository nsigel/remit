import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { CCTP_CHAINS, DEPOSIT_STEPS } from "~/lib/constants";
import { mockConfirmationMs, mockTxHash, nextBlockNumber } from "~/lib/mock";
import { createTRPCRouter, studentProcedure } from "../trpc";

export const depositRouter = createTRPCRouter({
	initiate: studentProcedure
		.input(
			z.object({
				amount: z.number().positive(),
				currency: z.string(),
				sourceChainDomain: z.number(),
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

			const nextStep = DEPOSIT_STEPS[currentIdx + 1]!;
			const isComplete = nextStep === "COMPLETE";

			const updated = await ctx.db.transaction.update({
				where: { id: tx.id },
				data: {
					depositStep: nextStep,
					...(isComplete && {
						status: "CONFIRMED",
						txHash: mockTxHash(),
						blockNumber: nextBlockNumber(),
						networkFee: "$0.01",
						confirmationMs: mockConfirmationMs(),
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
							currency: tx.currency,
						},
					},
					update: { amount: { increment: tx.amount } },
					create: {
						studentId: ctx.student.id,
						currency: tx.currency,
						amount: tx.amount,
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
