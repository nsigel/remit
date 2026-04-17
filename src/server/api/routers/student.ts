import { z } from "zod";
import {
	DEPOSIT_CURRENCIES,
	SEED_INVOICES,
	SEED_UNIVERSITY,
} from "~/lib/constants";
import { mockWalletAddress } from "~/lib/mock";
import { clearSessionToken, setSessionToken } from "~/lib/session";
import { ensureWalletBalances } from "~/lib/wallet-balances";
import { createTRPCRouter, publicProcedure, studentProcedure } from "../trpc";

export const studentRouter = createTRPCRouter({
	create: publicProcedure
		.input(z.object({ name: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const sessionToken = crypto.randomUUID();

			// Upsert the seed university
			const university = await ctx.db.university.upsert({
				where: { id: "meridian" },
				update: {},
				create: {
					id: "meridian",
					name: SEED_UNIVERSITY.name,
					walletAddress: SEED_UNIVERSITY.walletAddress,
				},
			});

			// Create student with wallet
			const student = await ctx.db.student.create({
				data: {
					sessionToken,
					name: input.name,
					walletAddress: mockWalletAddress(),
					universityId: university.id,
					balances: {
						create: DEPOSIT_CURRENCIES.map((currency) => ({
							currency: currency.symbol,
							amount: 0,
						})),
					},
					invoices: {
						create: SEED_INVOICES.map((inv) => ({
							universityId: university.id,
							description: inv.description,
							amount: inv.amount,
							currency: inv.currency,
							dueDate: inv.dueDate,
						})),
					},
				},
			});

			await setSessionToken(sessionToken);

			return { student };
		}),

	getSession: publicProcedure.query(async ({ ctx }) => {
		if (!ctx.sessionToken) return null;

		const student = await ctx.db.student.findUnique({
			where: { sessionToken: ctx.sessionToken },
			include: {
				balances: true,
				university: true,
			},
		});

		if (!student) return null;

		return {
			...student,
			balances: ensureWalletBalances(student.balances),
		};
	}),

	dashboard: studentProcedure.query(async ({ ctx }) => {
		const [balances, invoices, transactions] = await Promise.all([
			ctx.db.balance.findMany({
				where: { studentId: ctx.student.id },
			}),
			ctx.db.invoice.findMany({
				where: { studentId: ctx.student.id },
				orderBy: { dueDate: "asc" },
			}),
			ctx.db.transaction.findMany({
				where: { studentId: ctx.student.id },
				orderBy: { createdAt: "desc" },
				take: 10,
			}),
		]);

		return {
			student: ctx.student,
			balances: ensureWalletBalances(balances),
			invoices,
			transactions,
		};
	}),

	reset: publicProcedure.mutation(async () => {
		await clearSessionToken();
	}),
});
