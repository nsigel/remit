import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { depositRouter } from "./routers/deposit";
import { invoiceRouter } from "./routers/invoice";
import { studentRouter } from "./routers/student";
import { swapRouter } from "./routers/swap";
import { transactionRouter } from "./routers/transaction";
import { universityRouter } from "./routers/university";

export const appRouter = createTRPCRouter({
	student: studentRouter,
	deposit: depositRouter,
	swap: swapRouter,
	invoice: invoiceRouter,
	transaction: transactionRouter,
	university: universityRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
