import { z } from "zod";
import { createTRPCRouter, studentProcedure } from "../trpc";

export const transactionRouter = createTRPCRouter({
	list: studentProcedure
		.input(
			z
				.object({
					type: z.enum(["DEPOSIT", "PAYMENT", "SWAP"]).optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			return ctx.db.transaction.findMany({
				where: {
					studentId: ctx.student.id,
					...(input?.type && { type: input.type }),
				},
				orderBy: { createdAt: "desc" },
			});
		}),
});
