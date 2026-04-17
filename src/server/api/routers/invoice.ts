import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ARC } from "~/lib/constants";
import { mockConfirmationMs, mockTxHash, nextBlockNumber } from "~/lib/mock";
import { buildPaymentPlan } from "~/lib/payment-plan";
import { ensureWalletBalances } from "~/lib/wallet-balances";
import { createTRPCRouter, studentProcedure } from "../trpc";

export const invoiceRouter = createTRPCRouter({
	list: studentProcedure.query(async ({ ctx }) => {
		return ctx.db.invoice.findMany({
			where: { studentId: ctx.student.id },
			include: { university: true },
			orderBy: { dueDate: "asc" },
		});
	}),

	get: studentProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const balances = await ctx.db.balance.findMany({
				where: { studentId: ctx.student.id },
				orderBy: { currency: "asc" },
			});

			if (input.id === "current") {
				const invoices = await ctx.db.invoice.findMany({
					where: { studentId: ctx.student.id, status: "UNPAID" },
					include: { university: true },
					orderBy: { dueDate: "asc" },
				});

				if (invoices.length === 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "No current balance due",
					});
				}

				const [firstInvoice] = invoices;
				if (!firstInvoice) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "No current balance due",
					});
				}
				const totalAmount = invoices.reduce(
					(sum, invoice) => sum + invoice.amount,
					0,
				);

				return {
					invoice: {
						id: "current",
						description: "Current balance",
						amount: totalAmount,
						currency: firstInvoice?.currency ?? "USDC",
						dueDate: firstInvoice?.dueDate ?? new Date(),
						status: "UNPAID",
						university: firstInvoice.university,
						statementCount: invoices.length,
						statements: invoices.map((invoice) => ({
							id: invoice.id,
							description: invoice.description,
							amount: invoice.amount,
							dueDate: invoice.dueDate,
							status: invoice.status,
						})),
					},
					balances: ensureWalletBalances(balances),
				};
			}

			const invoice = await ctx.db.invoice.findFirst({
				where: { id: input.id, studentId: ctx.student.id },
				include: { university: true },
			});

			if (!invoice) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			return {
				invoice: {
					...invoice,
					statementCount: 1,
					statements: [
						{
							id: invoice.id,
							description: invoice.description,
							amount: invoice.amount,
							dueDate: invoice.dueDate,
							status: invoice.status,
						},
					],
				},
				balances: ensureWalletBalances(balances),
			};
		}),

	pay: studentProcedure
		.input(z.object({ invoiceId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const invoices =
				input.invoiceId === "current"
					? await ctx.db.invoice.findMany({
							where: {
								studentId: ctx.student.id,
								status: "UNPAID",
							},
							include: { university: true },
							orderBy: { dueDate: "asc" },
						})
					: await ctx.db.invoice.findMany({
							where: {
								id: input.invoiceId,
								studentId: ctx.student.id,
								status: "UNPAID",
							},
							include: { university: true },
						});

			if (invoices.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message:
						input.invoiceId === "current"
							? "No current balance due"
							: "Statement not found or already paid",
				});
			}

			const [primaryInvoice] = invoices;
			if (!primaryInvoice) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No payable balance found",
				});
			}
			const totalAmount = invoices.reduce(
				(sum, invoice) => sum + invoice.amount,
				0,
			);

			const balances = await ctx.db.balance.findMany({
				where: { studentId: ctx.student.id },
			});

			const paymentPlan = buildPaymentPlan(
				balances,
				totalAmount,
				primaryInvoice.currency,
			);

			if (!paymentPlan.canPay) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Insufficient payment power. Add ${paymentPlan.targetCurrency} or another supported balance.`,
				});
			}

			const now = new Date();
			const swaps: Array<{
				id: string;
				txHash: string | null;
				blockNumber: number | null;
				confirmationMs: number | null;
				fromCurrency: string | null;
				toCurrency: string | null;
				amount: number;
				toAmount: number | null;
				exchangeRate: number | null;
			}> = [];

			const payment = await ctx.db.$transaction(async (db) => {
				for (const step of paymentPlan.steps) {
					if (step.kind !== "swap") continue;

					const confirmationMs = mockConfirmationMs();
					const swap = await db.transaction.create({
						data: {
							studentId: ctx.student.id,
							type: "SWAP",
							status: "CONFIRMED",
							amount: step.fromAmount,
							currency: step.fromCurrency,
							fromCurrency: step.fromCurrency,
							toCurrency: step.toCurrency,
							toAmount: step.toAmount,
							exchangeRate: step.effectiveRate,
							txHash: mockTxHash(),
							blockNumber: nextBlockNumber(),
							networkFee: ARC.networkFee,
							gasSponsor: "Remit Platform",
							confirmationMs,
							confirmedAt: new Date(now.getTime() + confirmationMs),
						},
					});

					swaps.push(swap);

					await db.balance.update({
						where: {
							studentId_currency: {
								studentId: ctx.student.id,
								currency: step.fromCurrency,
							},
						},
						data: { amount: { decrement: step.fromAmount } },
					});

					await db.balance.upsert({
						where: {
							studentId_currency: {
								studentId: ctx.student.id,
								currency: step.toCurrency,
							},
						},
						update: { amount: { increment: step.toAmount } },
						create: {
							studentId: ctx.student.id,
							currency: step.toCurrency,
							amount: step.toAmount,
						},
					});
				}

				const confirmationMs = mockConfirmationMs();
				const payment = await db.transaction.create({
					data: {
						studentId: ctx.student.id,
						type: "PAYMENT",
						status: "CONFIRMED",
						amount: totalAmount,
						currency: primaryInvoice.currency,
						toAddress: primaryInvoice.university.walletAddress,
						txHash: mockTxHash(),
						blockNumber: nextBlockNumber(),
						networkFee: ARC.networkFee,
						gasSponsor: "Remit Platform",
						confirmationMs,
						confirmedAt: new Date(now.getTime() + confirmationMs),
					},
				});

				await db.balance.update({
					where: {
						studentId_currency: {
							studentId: ctx.student.id,
							currency: primaryInvoice.currency,
						},
					},
					data: { amount: { decrement: totalAmount } },
				});

				for (const invoice of invoices) {
					await db.invoice.update({
						where: { id: invoice.id },
						data: {
							status: "PAID",
							paidAt: now,
						},
					});
				}

				return payment;
			});

			return {
				paymentPlan,
				swaps,
				payment,
				invoice: {
					id: input.invoiceId,
					description:
						input.invoiceId === "current"
							? "Current balance"
							: primaryInvoice.description,
					amount: totalAmount,
					currency: primaryInvoice.currency,
					dueDate: primaryInvoice.dueDate,
					status: "PAID" as const,
					university: primaryInvoice.university,
					statementCount: invoices.length,
					statements: invoices.map((invoice) => ({
						id: invoice.id,
						description: invoice.description,
						amount: invoice.amount,
						dueDate: invoice.dueDate,
						status: "PAID" as const,
					})),
				},
			};
		}),
});
