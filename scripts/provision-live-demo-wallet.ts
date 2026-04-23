import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";
import { AppKit } from "@circle-fin/app-kit";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const ARC_TESTNET_BLOCKCHAIN = "ARC-TESTNET";
const ARC_TESTNET_CHAIN = "Arc_Testnet";
const DEFAULT_WALLET_SET_NAME = "Remit Live Demo";
const DEFAULT_WALLET_NAME = "Remit Live Demo Wallet";
const DEFAULT_SWAP_CHECK_AMOUNT = "1.00";
const ENV_PATH = path.join(process.cwd(), ".env");
const OUTPUT_PATH = path.join(process.cwd(), "output", "live-demo-wallet.json");

async function main() {
	const apiKey = getRequiredEnv("CIRCLE_API_KEY");
	const entitySecret = getRequiredEnv("CIRCLE_ENTITY_SECRET");
	const kitKey = getRequiredEnv("KIT_KEY");
	const walletSetIdFromEnv = getOptionalEnv("REMIT_DEMO_WALLET_SET_ID");
	const walletSetName =
		getOptionalEnv("REMIT_DEMO_WALLET_SET_NAME") ?? DEFAULT_WALLET_SET_NAME;
	const walletName =
		getOptionalEnv("REMIT_DEMO_WALLET_NAME") ?? DEFAULT_WALLET_NAME;
	const walletRefId =
		getOptionalEnv("REMIT_DEMO_WALLET_REF_ID") ??
		`remit-live-demo-${Date.now()}`;

	const client = initiateDeveloperControlledWalletsClient({
		apiKey,
		entitySecret,
	});

	let walletSetId = walletSetIdFromEnv;

	if (walletSetId) {
		const walletSetResponse = await client.getWalletSet({
			id: walletSetId,
		});
		const walletSet = walletSetResponse.data?.walletSet;
		if (!walletSet) {
			throw new Error(
				`Wallet set ${walletSetId} was not found in this Circle environment.`,
			);
		}
		console.log(`Using existing wallet set ${walletSet.id}.`);
	} else {
		const walletSetResponse = await client.createWalletSet({
			idempotencyKey: randomUUID(),
			name: walletSetName,
		});
		const walletSet = walletSetResponse.data?.walletSet;
		if (!walletSet) {
			throw new Error("Circle did not return a wallet set.");
		}
		walletSetId = walletSet.id;
		console.log(`Created wallet set ${walletSet.id}.`);
	}

	const walletResponse = await client.createWallets({
		accountType: "SCA",
		blockchains: [ARC_TESTNET_BLOCKCHAIN],
		count: 1,
		idempotencyKey: randomUUID(),
		metadata: [{ name: walletName, refId: walletRefId }],
		walletSetId,
	});
	const [wallet] = walletResponse.data?.wallets ?? [];

	if (!wallet) {
		throw new Error("Circle did not return a wallet.");
	}

	if (wallet.blockchain !== ARC_TESTNET_BLOCKCHAIN) {
		throw new Error(
			`Expected ${ARC_TESTNET_BLOCKCHAIN}, received ${wallet.blockchain ?? "unknown"}.`,
		);
	}

	console.log(`Created wallet ${wallet.id} at ${wallet.address}.`);

	await verifyAppSwapCompatibility({
		address: wallet.address,
		apiKey,
		entitySecret,
		kitKey,
	});

	await writeDemoEnv({
		walletAddress: wallet.address,
		walletId: wallet.id,
		walletSetId,
	});

	await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
	await writeFile(
		OUTPUT_PATH,
		JSON.stringify(
			{
				createdAt: new Date().toISOString(),
				swapCheck: {
					accountType: "SCA",
					amountIn: DEFAULT_SWAP_CHECK_AMOUNT,
					tokenIn: "USDC",
					tokenOut: "EURC",
				},
				wallet: {
					address: wallet.address,
					blockchain: wallet.blockchain,
					id: wallet.id,
					refId: wallet.refId,
					state: wallet.state,
					walletSetId,
				},
			},
			null,
			2,
		),
		"utf8",
	);

	console.log("Live demo wallet is provisioned and swap-compatible.");
	console.log(`Updated ${ENV_PATH}`);
	console.log(`Wrote ${OUTPUT_PATH}`);
	console.log("");
	console.log(`NEXT_PUBLIC_REMIT_LIVE_ENABLED="true"`);
	console.log(`REMIT_DEMO_WALLET_ID="${wallet.id}"`);
	console.log(`REMIT_DEMO_WALLET_ADDRESS="${wallet.address}"`);
	console.log(`REMIT_DEMO_WALLET_SET_ID="${walletSetId}"`);
}

async function verifyAppSwapCompatibility(input: {
	address: string;
	apiKey: string;
	entitySecret: string;
	kitKey: string;
}) {
	const adapter = createCircleWalletsAdapter({
		apiKey: input.apiKey,
		entitySecret: input.entitySecret,
	});
	const kit = new AppKit();

	const estimate = await kit.estimateSwap({
		amountIn: DEFAULT_SWAP_CHECK_AMOUNT,
		config: {
			kitKey: input.kitKey,
		},
		from: {
			address: input.address,
			adapter,
			chain: ARC_TESTNET_CHAIN,
		},
		tokenIn: "USDC",
		tokenOut: "EURC",
	});

	if (!estimate.estimatedOutput?.amount) {
		throw new Error("App Kit swap estimate did not return an output amount.");
	}

	console.log(
		[
			"Verified App Kit swap route",
			`USDC -> EURC on ${ARC_TESTNET_CHAIN}`,
			`estimated output ${estimate.estimatedOutput.amount} ${estimate.estimatedOutput.token}`,
		].join(": "),
	);
}

async function writeDemoEnv(input: {
	walletAddress: string;
	walletId: string;
	walletSetId: string;
}) {
	let envContents = "";

	try {
		envContents = await readFile(ENV_PATH, "utf8");
	} catch (error) {
		if (!isMissingFileError(error)) {
			throw error;
		}
	}

	envContents = upsertEnvValue(
		envContents,
		"NEXT_PUBLIC_REMIT_LIVE_ENABLED",
		"true",
	);
	envContents = upsertEnvValue(
		envContents,
		"REMIT_DEMO_WALLET_ID",
		input.walletId,
	);
	envContents = upsertEnvValue(
		envContents,
		"REMIT_DEMO_WALLET_ADDRESS",
		input.walletAddress,
	);
	envContents = upsertEnvValue(
		envContents,
		"REMIT_DEMO_WALLET_SET_ID",
		input.walletSetId,
	);

	await writeFile(ENV_PATH, envContents, "utf8");
}

function getOptionalEnv(name: string) {
	const value = process.env[name]?.trim();
	return value ? value : null;
}

function getRequiredEnv(name: string) {
	const value = getOptionalEnv(name);
	if (!value) {
		throw new Error(`${name} is required.`);
	}
	return value;
}

function isMissingFileError(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "ENOENT"
	);
}

function upsertEnvValue(envContents: string, key: string, value: string) {
	const normalizedLine = `${key}=${quoteEnvValue(value)}`;
	const keyPattern = new RegExp(`^${escapeRegExp(key)}=.*$`, "m");

	if (keyPattern.test(envContents)) {
		return envContents.replace(keyPattern, normalizedLine);
	}

	const trimmed = envContents.trimEnd();
	return trimmed ? `${trimmed}\n${normalizedLine}\n` : `${normalizedLine}\n`;
}

function quoteEnvValue(value: string) {
	const escaped = value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
	return `"${escaped}"`;
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Provisioning failed: ${message}`);
	process.exitCode = 1;
});
