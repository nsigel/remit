import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { AppKit } from "@circle-fin/app-kit";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { createPublicClient, http } from "viem";
import { arcTestnet } from "viem/chains";
import type { LiveSwapResponse } from "~/lib/live-demo";
import { Provider as CircleWalletProvider } from "../../../node_modules/@circle-fin/usdckit/dist/esm/providers/circle-wallets/transports/index.js";
import { getConfiguredDemoWallet } from "./wallet";

const ARC_TESTNET_CHAIN = "Arc_Testnet";
const ALLOWANCE_STRATEGY = "approve";
const BOOTSTRAP_TRANSFER_AMOUNT = "0.000001";
const TRANSACTION_POLL_ATTEMPTS = 12;
const TRANSACTION_POLL_INTERVAL_MS = 5_000;

let cachedAdapter: Awaited<ReturnType<typeof buildCircleSwapAdapter>> | null =
	null;
let cachedAdapterAddress: string | null = null;
let cachedClient: ReturnType<
	typeof initiateDeveloperControlledWalletsClient
> | null = null;
let cachedKit: AppKit | null = null;

export async function executeLiveArcSwap(input: {
	tokenIn: LiveSwapResponse["tokenIn"];
	tokenOut: LiveSwapResponse["tokenOut"];
	amountIn: string;
}): Promise<LiveSwapResponse> {
	const wallet = getConfiguredDemoWallet();
	const kit = getAppKit();
	const adapter = await getCircleSwapAdapter(wallet.walletAddress);
	const client = getDeveloperControlledWalletsClient();

	const result = await runSwapWithOptionalBootstrap({
		adapter,
		client,
		input,
		kit,
		walletAddress: wallet.walletAddress,
		walletId: wallet.circleWalletId,
	});

	return {
		txHash: result.txHash,
		explorerUrl: result.explorerUrl,
		amountIn: result.amountIn,
		amountOut: result.amountOut,
		tokenIn: input.tokenIn,
		tokenOut: input.tokenOut,
		fromAddress: result.fromAddress,
		toAddress: result.toAddress,
	};
}

async function runSwapWithOptionalBootstrap(input: {
	adapter: Awaited<ReturnType<typeof buildCircleSwapAdapter>>;
	client: ReturnType<typeof initiateDeveloperControlledWalletsClient>;
	input: {
		tokenIn: LiveSwapResponse["tokenIn"];
		tokenOut: LiveSwapResponse["tokenOut"];
		amountIn: string;
	};
	kit: AppKit;
	walletAddress: string;
	walletId: string;
}) {
	try {
		return await executeSwap(input);
	} catch (error) {
		if (!isUndeployedWalletError(error)) {
			throw error;
		}

		const bootstrapToken = await getBootstrapToken({
			client: input.client,
			preferredSymbol: input.input.tokenIn,
			walletId: input.walletId,
		});

		await deployWalletWithSelfTransfer({
			client: input.client,
			tokenId: bootstrapToken.id,
			walletAddress: input.walletAddress,
			walletId: input.walletId,
		});

		return await executeSwap(input);
	}
}

async function executeSwap(input: {
	adapter: Awaited<ReturnType<typeof buildCircleSwapAdapter>>;
	input: {
		tokenIn: LiveSwapResponse["tokenIn"];
		tokenOut: LiveSwapResponse["tokenOut"];
		amountIn: string;
	};
	kit: AppKit;
	walletAddress: string;
}) {
	return input.kit.swap({
		amountIn: input.input.amountIn,
		config: {
			allowanceStrategy: ALLOWANCE_STRATEGY,
			kitKey: getRequiredEnv("KIT_KEY"),
		},
		from: {
			address: input.walletAddress,
			adapter: input.adapter,
			chain: ARC_TESTNET_CHAIN,
		},
		tokenIn: input.input.tokenIn,
		tokenOut: input.input.tokenOut,
	});
}

async function getCircleSwapAdapter(walletAddress: string) {
	if (!cachedAdapter || cachedAdapterAddress !== walletAddress) {
		cachedAdapterAddress = walletAddress;
		cachedAdapter = await buildCircleSwapAdapter(walletAddress);
	}

	if (!cachedAdapter) {
		throw new Error("The live swap adapter could not be initialized.");
	}

	return cachedAdapter;
}

async function buildCircleSwapAdapter(walletAddress: string) {
	const circleProvider = new CircleWalletProvider({
		apiKey: getRequiredEnv("CIRCLE_API_KEY"),
		entitySecret: getRequiredEnv("CIRCLE_ENTITY_SECRET"),
		chainId: arcTestnet.id,
	});

	const provider = {
		request: async ({
			method,
			params,
		}: {
			method: string;
			params?: unknown;
		}) => {
			if (method === "eth_requestAccounts" || method === "eth_accounts") {
				return [walletAddress];
			}

			if (method === "wallet_addEthereumChain") {
				return null;
			}

			if (method === "wallet_switchEthereumChain") {
				const [target] = Array.isArray(params) ? params : [];
				if (isSupportedChainSwitch(target)) {
					return null;
				}

				throw new Error(
					`Unsupported chain switch request: ${String(
						(target as { chainId?: string | number } | undefined)?.chainId,
					)}.`,
				);
			}

			if (method === "eth_call") {
				const [transaction, blockTag] = Array.isArray(params) ? params : [];
				return circleProvider.request({
					method,
					params: [stripUnsupportedCallParams(transaction), blockTag],
				});
			}

			if (method === "eth_sendTransaction") {
				const [transaction] = Array.isArray(params) ? params : [];
				return circleProvider.request({
					method,
					params: [stripUnsupportedSendParams(transaction)],
				});
			}

			return circleProvider.request({
				method,
				params: Array.isArray(params) ? params : undefined,
			});
		},
		on() {
			return provider;
		},
		removeListener() {
			return provider;
		},
	} as Parameters<typeof createViemAdapterFromProvider>[0]["provider"];

	return await createViemAdapterFromProvider({
		provider,
		getPublicClient: ({ chain }) =>
			createPublicClient({
				chain,
				transport: http(),
			}),
		capabilities: {
			addressContext: "developer-controlled",
		},
	});
}

function getDeveloperControlledWalletsClient() {
	if (!cachedClient) {
		cachedClient = initiateDeveloperControlledWalletsClient({
			apiKey: getRequiredEnv("CIRCLE_API_KEY"),
			entitySecret: getRequiredEnv("CIRCLE_ENTITY_SECRET"),
		});
	}

	return cachedClient;
}

function getAppKit() {
	if (!cachedKit) {
		cachedKit = new AppKit();
	}

	return cachedKit;
}

async function getBootstrapToken(input: {
	client: ReturnType<typeof initiateDeveloperControlledWalletsClient>;
	preferredSymbol: LiveSwapResponse["tokenIn"];
	walletId: string;
}) {
	const balanceResponse = await input.client.getWalletTokenBalance({
		id: input.walletId,
		includeAll: true,
	});
	const tokenBalances = balanceResponse.data?.tokenBalances ?? [];
	const preferredToken = tokenBalances.find(
		(entry) =>
			entry.token?.symbol === input.preferredSymbol &&
			hasSufficientBootstrapBalance(entry.amount),
	);
	const fallbackToken = tokenBalances.find(
		(entry) =>
			entry.token?.id != null && hasSufficientBootstrapBalance(entry.amount),
	);
	const selectedToken = preferredToken ?? fallbackToken;

	if (!selectedToken?.token?.id) {
		throw new Error(
			"No funded token is available to deploy the live demo wallet on Arc Testnet.",
		);
	}

	return {
		id: selectedToken.token.id,
		symbol: selectedToken.token.symbol ?? "unknown",
	};
}

function hasSufficientBootstrapBalance(amount?: string | null) {
	return Number(amount ?? 0) >= Number(BOOTSTRAP_TRANSFER_AMOUNT);
}

async function deployWalletWithSelfTransfer(input: {
	client: ReturnType<typeof initiateDeveloperControlledWalletsClient>;
	tokenId: string;
	walletAddress: string;
	walletId: string;
}) {
	const createResponse = await input.client.createTransaction({
		amount: [BOOTSTRAP_TRANSFER_AMOUNT],
		destinationAddress: input.walletAddress,
		fee: {
			type: "level",
			config: {
				feeLevel: "HIGH",
			},
		},
		idempotencyKey: randomUUID(),
		tokenId: input.tokenId,
		walletId: input.walletId,
	});
	const transactionId = createResponse.data?.id;

	if (!transactionId) {
		throw new Error("Bootstrap transfer did not return a transaction id.");
	}

	await waitForTransactionCompletion({
		client: input.client,
		transactionId,
	});
}

async function waitForTransactionCompletion(input: {
	client: ReturnType<typeof initiateDeveloperControlledWalletsClient>;
	transactionId: string;
}) {
	for (let attempt = 0; attempt < TRANSACTION_POLL_ATTEMPTS; attempt += 1) {
		const response = await input.client.getTransaction({
			id: input.transactionId,
		});
		const transaction = response.data?.transaction;

		if (!transaction) {
			throw new Error(
				`Bootstrap transfer ${input.transactionId} did not return a transaction payload.`,
			);
		}

		if (transaction.state === "COMPLETE") {
			return;
		}

		if (
			transaction.state === "FAILED" ||
			transaction.state === "CANCELLED" ||
			transaction.state === "DENIED"
		) {
			throw new Error(
				`Bootstrap transfer ${input.transactionId} ended in state ${transaction.state}.`,
			);
		}

		await sleep(TRANSACTION_POLL_INTERVAL_MS);
	}

	throw new Error(
		`Bootstrap transfer ${input.transactionId} did not complete in time.`,
	);
}

function isSupportedChainSwitch(target: unknown) {
	if (!target || typeof target !== "object") {
		return true;
	}

	const chainId = (target as { chainId?: string | number }).chainId;
	if (chainId === undefined) {
		return true;
	}

	return (
		chainId === arcTestnet.id || chainId === `0x${arcTestnet.id.toString(16)}`
	);
}

function stripUnsupportedCallParams(transaction: unknown) {
	if (!transaction || typeof transaction !== "object") {
		return transaction;
	}

	const {
		gas,
		gasPrice,
		maxFeePerGas,
		maxPriorityFeePerGas,
		nonce,
		value,
		...rest
	} = transaction as Record<string, unknown>;

	return rest;
}

function stripUnsupportedSendParams(transaction: unknown) {
	if (!transaction || typeof transaction !== "object") {
		return transaction;
	}

	const { gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, nonce, ...rest } =
		transaction as Record<string, unknown>;

	return rest;
}

function isUndeployedWalletError(error: unknown) {
	return (
		error instanceof Error &&
		error.message.includes(
			"Cannot generate a signature from an undeployed wallet",
		)
	);
}

function getRequiredEnv(name: string) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required for live App Kit actions.`);
	}
	return value;
}
