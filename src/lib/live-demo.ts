export type DemoWalletMode = "mock" | "circle_sca";

export type DemoLiveCapabilities = {
	topup: boolean;
	swap: boolean;
	bridge: boolean;
	escrow: boolean;
};

export type TransactionProvenance = "mock" | "live";

export type LiveBootstrapResponse = {
	walletAddress: string;
	walletMode: "circle_sca";
	circleWalletId: string;
	liveCapabilities: {
		topup: true;
		swap: true;
		bridge: false;
		escrow: false;
	};
};

export type LiveSwapResponse = {
	txHash: string;
	explorerUrl?: string;
	amountIn: string;
	amountOut?: string;
	tokenIn: "USDC" | "EURC";
	tokenOut: "USDC" | "EURC";
	fromAddress: string;
	toAddress: string;
};

export const MOCK_LIVE_CAPABILITIES: DemoLiveCapabilities = {
	topup: false,
	swap: false,
	bridge: false,
	escrow: false,
};

export const LIVE_ARC_CAPABILITIES: LiveBootstrapResponse["liveCapabilities"] =
	{
		topup: true,
		swap: true,
		bridge: false,
		escrow: false,
	};

export function isLiveDemoEnabled() {
	return process.env.NEXT_PUBLIC_REMIT_LIVE_ENABLED === "true";
}
