import { DEPOSIT_CURRENCIES } from "~/lib/constants";

export type WalletBalance = {
	currency: string;
	amount: number;
};

export function ensureWalletBalances(
	balances: WalletBalance[],
): WalletBalance[] {
	const balanceMap = new Map(
		balances.map((balance) => [balance.currency, balance] as const),
	);

	for (const currency of DEPOSIT_CURRENCIES) {
		if (!balanceMap.has(currency.symbol)) {
			balanceMap.set(currency.symbol, { currency: currency.symbol, amount: 0 });
		}
	}

	return [...balanceMap.values()].sort((a, b) =>
		a.currency.localeCompare(b.currency),
	);
}
