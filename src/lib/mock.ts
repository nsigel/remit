// Utilities for generating mock blockchain data

export function mockWalletAddress(): string {
	const bytes = new Array(20)
		.fill(0)
		.map(() =>
			Math.floor(Math.random() * 256)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("");
	return `0x${bytes}`;
}

export function mockTxHash(): string {
	const bytes = new Array(32)
		.fill(0)
		.map(() =>
			Math.floor(Math.random() * 256)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("");
	return `0x${bytes}`;
}

let blockCounter = 8_421_000;
export function nextBlockNumber(): number {
	return ++blockCounter;
}

export function mockConfirmationMs(): number {
	// Sub-second: 200-800ms
	return Math.floor(Math.random() * 600) + 200;
}
