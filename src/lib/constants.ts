// CCTP V2 supported chains — all can bridge USDC to Arc (domain 26)
export const CCTP_CHAINS = [
	{ domain: 0, name: "Ethereum", popular: true },
	{ domain: 6, name: "Base", popular: true },
	{ domain: 5, name: "Solana", popular: true },
	{ domain: 3, name: "Arbitrum", popular: true },
	{ domain: 2, name: "OP Mainnet", popular: true },
	{ domain: 7, name: "Polygon PoS", popular: true },
	{ domain: 26, name: "Arc", popular: true },
	{ domain: 1, name: "Avalanche", popular: false },
	{ domain: 17, name: "BNB Smart Chain", popular: false },
	{ domain: 12, name: "Codex", popular: false },
	{ domain: 28, name: "EDGE", popular: false },
	{ domain: 19, name: "HyperEVM", popular: false },
	{ domain: 21, name: "Ink", popular: false },
	{ domain: 11, name: "Linea", popular: false },
	{ domain: 15, name: "Monad", popular: false },
	{ domain: 30, name: "Morph", popular: false },
	{ domain: 31, name: "Pharos", popular: false },
	{ domain: 22, name: "Plume", popular: false },
	{ domain: 16, name: "Sei", popular: false },
	{ domain: 13, name: "Sonic", popular: false },
	{ domain: 25, name: "Starknet", popular: false },
	{ domain: 27, name: "Stellar", popular: false },
	{ domain: 10, name: "Unichain", popular: false },
	{ domain: 14, name: "World Chain", popular: false },
	{ domain: 18, name: "XDC", popular: false },
	// Legacy V1
	{ domain: 9, name: "Aptos", popular: false },
	{ domain: 4, name: "Noble", popular: false },
	{ domain: 8, name: "Sui", popular: false },
] as const;

export type CctpChain = (typeof CCTP_CHAINS)[number];

// Deposit currencies — primary + partner stablecoins
export const DEPOSIT_CURRENCIES = [
	{ symbol: "USDC", name: "USD Coin", decimals: 6, primary: true },
	{ symbol: "EURC", name: "Euro Coin", decimals: 6, primary: true },
	{ symbol: "JPYC", name: "JPY Coin", decimals: 6, primary: true },
] as const;

export const PARTNER_CURRENCIES = [
	{ symbol: "MXNB", name: "Mexican Peso Stablecoin" },
	{ symbol: "PHPC", name: "Philippine Peso Coin" },
	{ symbol: "QCAD", name: "Canadian Dollar Stablecoin" },
	{ symbol: "TRYB", name: "Turkish Lira Stablecoin" },
	{ symbol: "BRZ", name: "Brazilian Real Stablecoin" },
	{ symbol: "XSGD", name: "Singapore Dollar Stablecoin" },
] as const;

// Mock FX rates to USDC
export const FX_RATES: Record<string, number> = {
	USDC: 1.0,
	EURC: 1.085, // 1 EURC = 1.085 USDC
	JPYC: 0.0067, // 1 JPYC = 0.0067 USDC (~149 JPY/USD)
};

// StableFX spread vs traditional banking
export const STABLEFX_SPREAD = 0.001; // 0.1%
export const TRADITIONAL_SPREAD_LOW = 0.03; // 3%
export const TRADITIONAL_SPREAD_HIGH = 0.05; // 5%

// Arc network constants
export const ARC = {
	chainId: 5042002,
	cctpDomain: 26,
	rpc: "https://rpc.testnet.arc.network",
	explorer: "https://testnet.arcscan.app",
	usdcAddress: "0x3600000000000000000000000000000000000000",
	networkFee: "$0.01",
} as const;

// CCTP deposit steps in order
export const DEPOSIT_STEPS = [
	"APPROVE",
	"BURN",
	"ATTEST",
	"MINT",
	"COMPLETE",
] as const;

export type DepositStep = (typeof DEPOSIT_STEPS)[number];

// University seed data
export const SEED_UNIVERSITY = {
	name: "USC",
	walletAddress: "0x4d657269dian00000000000000000000000000000",
} as const;

export const SEED_INVOICES = [
	{
		description: "Fall 2026 Tuition",
		amount: 15000,
		currency: "USDC",
		dueDate: new Date("2026-08-15"),
	},
	{
		description: "Fall 2026 Housing",
		amount: 5000,
		currency: "USDC",
		dueDate: new Date("2026-08-15"),
	},
	{
		description: "Fall 2026 Meal Plan",
		amount: 2500,
		currency: "USDC",
		dueDate: new Date("2026-08-15"),
	},
] as const;
