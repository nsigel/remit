import { NextResponse } from "next/server";
import { executeLiveArcSwap } from "~/lib/circle/app-kit";
import type { LiveSwapResponse } from "~/lib/live-demo";

export const runtime = "nodejs";

type LiveSwapRequest = {
	tokenIn?: LiveSwapResponse["tokenIn"];
	tokenOut?: LiveSwapResponse["tokenOut"];
	amountIn?: string;
};

const SUPPORTED_PAIRS = new Set(["USDC:EURC", "EURC:USDC"]);

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as LiveSwapRequest;
		const tokenIn = body.tokenIn;
		const tokenOut = body.tokenOut;
		const amountIn = body.amountIn?.trim();

		if (tokenIn !== "USDC" && tokenIn !== "EURC") {
			return NextResponse.json(
				{ error: "tokenIn must be USDC or EURC." },
				{ status: 400 },
			);
		}

		if (tokenOut !== "USDC" && tokenOut !== "EURC") {
			return NextResponse.json(
				{ error: "tokenOut must be USDC or EURC." },
				{ status: 400 },
			);
		}

		if (!SUPPORTED_PAIRS.has(`${tokenIn}:${tokenOut}`)) {
			return NextResponse.json(
				{ error: "Only USDC and EURC swaps are enabled for the live demo." },
				{ status: 400 },
			);
		}

		if (!amountIn || Number.parseFloat(amountIn) <= 0) {
			return NextResponse.json(
				{ error: "amountIn must be a positive decimal string." },
				{ status: 400 },
			);
		}

		const result = await executeLiveArcSwap({
			tokenIn,
			tokenOut,
			amountIn,
		});

		return NextResponse.json(result);
	} catch (error) {
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Live swap failed.",
			},
			{ status: 500 },
		);
	}
}
