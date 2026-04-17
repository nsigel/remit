import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { getSessionToken } from "~/lib/session";
import { db } from "~/server/db";

export const createTRPCContext = async (opts: { headers: Headers }) => {
	const sessionToken = await getSessionToken();

	return {
		db,
		sessionToken,
		...opts,
	};
};

const t = initTRPC.context<typeof createTRPCContext>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				zodError:
					error.cause instanceof ZodError ? error.cause.flatten() : null,
			},
		};
	},
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

// Procedure that requires an active student session
export const studentProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.sessionToken) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "No session" });
	}

	const student = await ctx.db.student.findUnique({
		where: { sessionToken: ctx.sessionToken },
	});

	if (!student) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid session" });
	}

	return next({ ctx: { ...ctx, student } });
});
