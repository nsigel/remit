import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { AppKit } from "@circle-fin/app-kit";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { createPublicClient, http } from "viem";
import { arcTestnet } from "viem/chains";
import { Provider as CircleWalletProvider } from "../node_modules/@circle-fin/usdckit/dist/esm/providers/circle-wallets/transports/index.js";

const ARC_TESTNET_CHAIN = "Arc_Testnet";
const EXPLORER_BASE_URL = "https://testnet.arcscan.app/tx/";
const OUTPUT_ROOT = path.join(process.cwd(), "output");
const TOKEN_IN = "USDC";
const TOKEN_OUT = "EURC";
const AMOUNT_IN = "1";
const ALLOWANCE_STRATEGY = "approve";
const BOOTSTRAP_TRANSFER_AMOUNT = "0.000001";
const BALANCE_POLL_ATTEMPTS = 12;
const BALANCE_POLL_INTERVAL_MS = 5_000;

async function main() {
	const startedAt = new Date().toISOString();
	const runDir = path.join(
		OUTPUT_ROOT,
		`live-swap-${startedAt.replaceAll(":", "-")}`,
	);

	await mkdir(runDir, { recursive: true });

	try {
		const apiKey = getRequiredEnv("CIRCLE_API_KEY");
		const entitySecret = getRequiredEnv("CIRCLE_ENTITY_SECRET");
		const kitKey = getRequiredEnv("KIT_KEY");
		const walletId = getRequiredEnv("REMIT_DEMO_WALLET_ID");
		const walletAddress = getRequiredEnv("REMIT_DEMO_WALLET_ADDRESS");

		const client = initiateDeveloperControlledWalletsClient({
			apiKey,
			entitySecret,
		});
		const adapter = await buildCircleSwapAdapter({
			apiKey,
			entitySecret,
			walletAddress,
		});
		const kit = new AppKit();

		const requestPayload = {
			amountIn: AMOUNT_IN,
			config: {
				allowanceStrategy: ALLOWANCE_STRATEGY,
				kitKey: "[redacted]",
			},
			from: {
				address: walletAddress,
				chain: ARC_TESTNET_CHAIN,
			},
			tokenIn: TOKEN_IN,
			tokenOut: TOKEN_OUT,
			walletId,
		};

		await writeJson(path.join(runDir, "request.json"), {
			startedAt,
			request: requestPayload,
		});

		const preBalances = await client.getWalletTokenBalance({
			id: walletId,
			includeAll: true,
		});
		await writeJson(path.join(runDir, "pre-balances.json"), {
			recordedAt: new Date().toISOString(),
			response: preBalances.data,
		});

		const preUsdcBalance = getTokenBalance(
			preBalances.data?.tokenBalances,
			TOKEN_IN,
		);
		const preEurcBalance = getTokenBalance(
			preBalances.data?.tokenBalances,
			TOKEN_OUT,
		);
		const tokenId = getTokenId(preBalances.data?.tokenBalances, TOKEN_IN);

		if (preUsdcBalance < Number(AMOUNT_IN)) {
			throw new Error(
				`Wallet ${walletId} has ${preUsdcBalance} ${TOKEN_IN}, which is not enough to swap ${AMOUNT_IN}.`,
			);
		}

		const swapResponse = await runSwapWithOptionalBootstrap({
			adapter,
			client,
			kit,
			kitKey,
			runDir,
			tokenId,
			walletAddress,
			walletId,
		});
		const explorerUrl =
			swapResponse.explorerUrl ?? `${EXPLORER_BASE_URL}${swapResponse.txHash}`;

		await writeJson(path.join(runDir, "swap-response.json"), {
			recordedAt: new Date().toISOString(),
			response: {
				...swapResponse,
				explorerUrl,
			},
		});

		const postBalances = await waitForUpdatedBalances({
			client,
			preEurcBalance,
			preUsdcBalance,
			walletId,
		});

		await writeJson(path.join(runDir, "post-balances.json"), {
			recordedAt: new Date().toISOString(),
			response: postBalances.data,
		});

		const postUsdcBalance = getTokenBalance(
			postBalances.data?.tokenBalances,
			TOKEN_IN,
		);
		const postEurcBalance = getTokenBalance(
			postBalances.data?.tokenBalances,
			TOKEN_OUT,
		);

		await writeJson(path.join(runDir, "summary.json"), {
			explorerUrl,
			finishedAt: new Date().toISOString(),
			outputDirectory: runDir,
			swap: {
				amountIn: swapResponse.amountIn,
				amountOut: swapResponse.amountOut,
				fromAddress: swapResponse.fromAddress,
				toAddress: swapResponse.toAddress,
				tokenIn: TOKEN_IN,
				tokenOut: TOKEN_OUT,
				txHash: swapResponse.txHash,
			},
			wallet: {
				address: walletAddress,
				id: walletId,
			},
			balances: {
				before: {
					[TOKEN_IN]: preUsdcBalance,
					[TOKEN_OUT]: preEurcBalance,
				},
				after: {
					[TOKEN_IN]: postUsdcBalance,
					[TOKEN_OUT]: postEurcBalance,
				},
				delta: {
					[TOKEN_IN]: roundAmount(postUsdcBalance - preUsdcBalance),
					[TOKEN_OUT]: roundAmount(postEurcBalance - preEurcBalance),
				},
			},
		});

		console.log(`Swap complete: ${swapResponse.txHash}`);
		console.log(`Explorer: ${explorerUrl}`);
		console.log(`Artifacts: ${runDir}`);
	} catch (error) {
		await writeJson(path.join(runDir, "error.json"), {
			failedAt: new Date().toISOString(),
			message: error instanceof Error ? error.message : "Unknown error",
			stack: error instanceof Error ? error.stack : null,
		});
		throw error;
	}
}

async function waitForUpdatedBalances(input: {
	client: ReturnType<typeof initiateDeveloperControlledWalletsClient>;
	preEurcBalance: number;
	preUsdcBalance: number;
	walletId: string;
}) {
	let latest = await input.client.getWalletTokenBalance({
		id: input.walletId,
		includeAll: true,
	});

	for (let attempt = 0; attempt < BALANCE_POLL_ATTEMPTS; attempt += 1) {
		const currentUsdcBalance = getTokenBalance(
			latest.data?.tokenBalances,
			TOKEN_IN,
		);
		const currentEurcBalance = getTokenBalance(
			latest.data?.tokenBalances,
			TOKEN_OUT,
		);

		if (
			currentUsdcBalance !== input.preUsdcBalance ||
			currentEurcBalance !== input.preEurcBalance
		) {
			return latest;
		}

		await sleep(BALANCE_POLL_INTERVAL_MS);
		latest = await input.client.getWalletTokenBalance({
			id: input.walletId,
			includeAll: true,
		});
	}

	return latest;
}

async function runSwapWithOptionalBootstrap(input: {
	adapter: Awaited<ReturnType<typeof buildCircleSwapAdapter>>;
	client: ReturnType<typeof initiateDeveloperControlledWalletsClient>;
	kit: AppKit;
	kitKey: string;
	runDir: string;
	tokenId: string;
	walletAddress: string;
	walletId: string;
}) {
	try {
		return await executeSwap(input);
	} catch (error) {
		if (!isUndeployedWalletError(error)) {
			throw error;
		}

		await writeJson(path.join(input.runDir, "swap-attempt-error.json"), {
			recordedAt: new Date().toISOString(),
			error: serializeError(error),
		});

		const bootstrapTransaction = await deployWalletWithSelfTransfer({
			client: input.client,
			runDir: input.runDir,
			tokenId: input.tokenId,
			walletAddress: input.walletAddress,
			walletId: input.walletId,
		});

		await writeJson(path.join(input.runDir, "bootstrap-transaction.json"), {
			recordedAt: new Date().toISOString(),
			transaction: bootstrapTransaction,
			explorerUrl: `${EXPLORER_BASE_URL}${bootstrapTransaction.txHash}`,
		});

		return await executeSwap(input);
	}
}

async function executeSwap(input: {
	adapter: Awaited<ReturnType<typeof buildCircleSwapAdapter>>;
	kit: AppKit;
	kitKey: string;
	walletAddress: string;
}) {
	return input.kit.swap({
		amountIn: AMOUNT_IN,
		config: {
			allowanceStrategy: ALLOWANCE_STRATEGY,
			kitKey: input.kitKey,
		},
		from: {
			address: input.walletAddress,
			adapter: input.adapter,
			chain: ARC_TESTNET_CHAIN,
		},
		tokenIn: TOKEN_IN,
		tokenOut: TOKEN_OUT,
	});
}

async function buildCircleSwapAdapter(input: {
	apiKey: string;
	entitySecret: string;
	walletAddress: string;
}) {
	const circleProvider = new CircleWalletProvider({
		apiKey: input.apiKey,
		entitySecret: input.entitySecret,
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
				return [input.walletAddress];
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

async function deployWalletWithSelfTransfer(input: {
	client: ReturnType<typeof initiateDeveloperControlledWalletsClient>;
	runDir: string;
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

	// A self-transfer deploys the SCA on-chain while preserving the demo balance.
	await writeJson(
		path.join(input.runDir, "bootstrap-transaction-create.json"),
		{
			recordedAt: new Date().toISOString(),
			response: createResponse.data,
		},
	);

	const transactionId = createResponse.data?.id;
	if (!transactionId) {
		throw new Error("Bootstrap transfer did not return a transaction id.");
	}

	return await waitForTransactionCompletion({
		client: input.client,
		transactionId,
	});
}

async function waitForTransactionCompletion(input: {
	client: ReturnType<typeof initiateDeveloperControlledWalletsClient>;
	transactionId: string;
}) {
	for (let attempt = 0; attempt < BALANCE_POLL_ATTEMPTS; attempt += 1) {
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
			return transaction;
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

		await sleep(BALANCE_POLL_INTERVAL_MS);
	}

	throw new Error(
		`Bootstrap transfer ${input.transactionId} did not complete in time.`,
	);
}

function getTokenBalance(
	tokenBalances: Array<{
		amount?: string | null;
		token?: {
			id?: string | null;
			name?: string | null;
			symbol?: string | null;
		} | null;
	}> = [],
	symbol: string,
) {
	const match = tokenBalances.find((entry) => entry.token?.symbol === symbol);
	return Number(match?.amount ?? 0);
}

function getTokenId(
	tokenBalances: Array<{
		token?: { id?: string | null; symbol?: string | null } | null;
	}> = [],
	symbol: string,
) {
	const tokenId = tokenBalances.find((entry) => entry.token?.symbol === symbol)
		?.token?.id;

	if (!tokenId) {
		throw new Error(`Could not find token id for ${symbol}.`);
	}

	return tokenId;
}

function roundAmount(value: number) {
	return Number(value.toFixed(8));
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

function getRequiredEnv(name: string) {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is required.`);
	}
	return value;
}

async function writeJson(filePath: string, data: unknown) {
	await writeFile(filePath, JSON.stringify(data, jsonReplacer, 2), "utf8");
}

function jsonReplacer(_key: string, value: unknown) {
	return typeof value === "bigint" ? value.toString() : value;
}

function isUndeployedWalletError(error: unknown) {
	return (
		error instanceof Error &&
		error.message.includes(
			"Cannot generate a signature from an undeployed wallet",
		)
	);
}

function serializeError(error: unknown) {
	if (error instanceof Error) {
		return {
			message: error.message,
			stack: error.stack,
		};
	}

	return {
		message: "Unknown error",
		value: error,
	};
}

await main();
