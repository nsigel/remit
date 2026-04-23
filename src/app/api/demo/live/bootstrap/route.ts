import { NextResponse } from "next/server";
import { getConfiguredDemoWallet } from "~/lib/circle/wallet";

export const runtime = "nodejs";

export async function POST() {
	try {
		return NextResponse.json(getConfiguredDemoWallet());
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Live wallet bootstrap failed.",
			},
			{ status: 500 },
		);
	}
}
