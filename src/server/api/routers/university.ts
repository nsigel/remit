import { createTRPCRouter, publicProcedure } from "../trpc";

export const universityRouter = createTRPCRouter({
	dashboard: publicProcedure.query(async ({ ctx }) => {
		const university = await ctx.db.university.findUnique({
			where: { id: "meridian" },
		});

		if (!university) {
			return null;
		}

		const [payments, invoices, students] = await Promise.all([
			ctx.db.transaction.findMany({
				where: { type: "PAYMENT", toAddress: university.walletAddress },
				include: { student: true },
				orderBy: { createdAt: "desc" },
			}),
			ctx.db.invoice.findMany({
				where: { universityId: university.id },
				include: { student: true },
				orderBy: { createdAt: "desc" },
			}),
			ctx.db.student.count({ where: { universityId: university.id } }),
		]);

		const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
		const paidInvoices = invoices.filter((i) => i.status === "PAID").length;
		const unpaidInvoices = invoices.filter((i) => i.status === "UNPAID").length;
		const avgConfirmation =
			payments.length > 0
				? payments.reduce((sum, p) => sum + (p.confirmationMs ?? 0), 0) /
					payments.length
				: 0;

		return {
			university,
			payments,
			stats: {
				totalReceived,
				paymentCount: payments.length,
				studentCount: students,
				paidInvoices,
				unpaidInvoices,
				avgConfirmationMs: Math.round(avgConfirmation),
			},
		};
	}),
});
