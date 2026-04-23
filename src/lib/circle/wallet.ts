import {
	isLiveDemoEnabled,
	LIVE_ARC_CAPABILITIES,
	type LiveBootstrapResponse,
} from "~/lib/live-demo";

type ConfiguredDemoWallet = LiveBootstrapResponse & {
	circleWalletId: string;
};

export function getConfiguredDemoWallet(): ConfiguredDemoWallet {
	if (!isLiveDemoEnabled()) {
		throw new Error("Live demo mode is not enabled.");
	}

	const circleWalletId = getRequiredEnv("REMIT_DEMO_WALLET_ID");
	const walletAddress = getRequiredEnv("REMIT_DEMO_WALLET_ADDRESS");

	return {
		walletAddress,
		walletMode: "circle_sca",
		circleWalletId,
		liveCapabilities: LIVE_ARC_CAPABILITIES,
	};
}

function getRequiredEnv(name: string) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required for the live demo.`);
	}
	return value;
}
