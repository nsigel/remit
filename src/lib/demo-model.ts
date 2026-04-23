import {
	ARC,
	CCTP_CHAINS,
	type CctpChain,
	DEPOSIT_CURRENCIES,
	SEED_INVOICES,
	SEED_UNIVERSITY,
} from "~/lib/constants";
import {
	type DemoLiveCapabilities,
	type DemoWalletMode,
	MOCK_LIVE_CAPABILITIES,
	type TransactionProvenance,
} from "~/lib/live-demo";
import { mockConfirmationMs, mockTxHash, mockWalletAddress } from "~/lib/mock";
import {
	buildPaymentPlan,
	type PaymentPlan,
	type PaymentPlanStep,
} from "~/lib/payment-plan";
import {
	getDepositFlowDurationMs,
	type StableFxQuoteSnapshot,
} from "~/lib/stablefx";
import { ensureWalletBalances } from "~/lib/wallet-balances";

export const DEMO_SESSION_STORAGE_KEY = "remit-demo-session:v2";
const INITIAL_BLOCK_NUMBER = 8_421_001;
const AMOUNT_EPSILON = 0.000001;

export type DemoTransactionType = "DEPOSIT" | "PAYMENT" | "SWAP";
export type DemoTransactionStatus = "PENDING" | "PROCESSING" | "CONFIRMED";
export type DemoInvoiceStatus = "UNPAID" | "PAID";

export type DemoStudent = {
	id: string;
	name: string;
	walletAddress: string;
	walletMode: DemoWalletMode;
	circleWalletId: string | null;
	universityId: string;
	createdAt: Date;
};

export type DemoUniversity = {
	id: string;
	name: string;
	walletAddress: string;
};

export type DemoBalance = {
	id: string;
	studentId: string;
	currency: string;
	amount: number;
};

export type DemoInvoice = {
	id: string;
	universityId: string;
	studentId: string;
	description: string;
	amount: number;
	currency: string;
	dueDate: Date;
	status: DemoInvoiceStatus;
	paidAt: Date | null;
	transactionId: string | null;
	createdAt: Date;
};

export type DemoTransaction = {
	id: string;
	studentId: string;
	type: DemoTransactionType;
	status: DemoTransactionStatus;
	provenance: TransactionProvenance;
	amount: number;
	currency: string;
	sourceChain: string | null;
	sourceChainDomain: number | null;
	depositStep: string | null;
	toAddress: string | null;
	fromCurrency: string | null;
	toCurrency: string | null;
	toAmount: number | null;
	exchangeRate: number | null;
	txHash: string | null;
	blockNumber: number | null;
	networkFee: string | null;
	gasSponsor: string | null;
	confirmationMs: number | null;
	createdAt: Date;
	confirmedAt: Date | null;
};

export type DemoEscrowInstallment = {
	id: string;
	label: string;
	dueDate: Date;
	amount: number;
	status: "PENDING" | "PROCESSED";
	processedAt: Date | null;
	paymentTransactionId: string | null;
};

export type DemoActiveEscrowPlan = {
	id: string;
	planId: string;
	planLabel: string;
	planSubtitle: string;
	currency: string;
	totalCommitted: number;
	remainingPrincipal: number;
	projectedYield: number;
	interestAccrued: number;
	yieldProductId: string;
	yieldProductLabel: string;
	yieldApy: number;
	installments: DemoEscrowInstallment[];
	nextInstallmentIndex: number;
	createdAt: Date;
};

export type DemoSessionState = {
	student: DemoStudent;
	university: DemoUniversity;
	balances: DemoBalance[];
	invoices: DemoInvoice[];
	transactions: DemoTransaction[];
	activeEscrowPlan: DemoActiveEscrowPlan | null;
	liveCapabilities: DemoLiveCapabilities;
	nextBlockNumber: number;
};

export type DashboardView = {
	student: DemoStudent & {
		university: DemoUniversity;
	};
	balances: DemoBalance[];
	invoices: DemoInvoice[];
	transactions: DemoTransaction[];
	activeEscrowPlan: DemoActiveEscrowPlan | null;
};

export type CurrentBalanceView = {
	invoice: {
		id: "current";
		description: "Current balance";
		amount: number;
		currency: string;
		dueDate: Date;
		status: "UNPAID";
		university: DemoUniversity;
		statementCount: number;
		statements: Array<{
			id: string;
			description: string;
			amount: number;
			dueDate: Date;
			status: DemoInvoiceStatus;
		}>;
	};
	balances: DemoBalance[];
};

export type UniversityDashboardView = {
	university: DemoUniversity;
	payments: Array<
		DemoTransaction & {
			student: DemoStudent;
		}
	>;
	stats: {
		totalReceived: number;
		paymentCount: number;
		studentCount: number;
		paidInvoices: number;
		unpaidInvoices: number;
		avgConfirmationMs: number;
	};
};

export type CommitDepositInput = {
	amount: number;
	currency: string;
	sourceChainDomain: number;
	autoSwap: boolean;
	settlementCurrency: string;
	swapQuote?: StableFxQuoteSnapshot;
};

export type CommitDepositResult = {
	session: DemoSessionState;
	transaction: DemoTransaction;
};

export type CommitSwapInput = {
	fromCurrency: string;
	toCurrency: string;
	fromAmount: number;
	quote: StableFxQuoteSnapshot;
};

export type CommitSwapResult = {
	session: DemoSessionState;
	transaction: DemoTransaction;
};

export type CreateDemoStudentOptions = {
	walletAddress?: string;
	walletMode?: DemoWalletMode;
	circleWalletId?: string | null;
	liveCapabilities?: DemoLiveCapabilities;
};

export type RecordLiveTopupInput = {
	amount: number;
	txHash: string;
	confirmationMs: number;
};

export type RecordLiveTopupResult = {
	session: DemoSessionState;
	transaction: DemoTransaction;
};

export type CommitLiveSwapInput = {
	fromCurrency: string;
	toCurrency: string;
	fromAmount: number;
	toAmount: number;
	txHash: string;
	confirmationMs: number;
	exchangeRate: number | null;
};

export type CommitLiveSwapResult = {
	session: DemoSessionState;
	transaction: DemoTransaction;
};

export type CreatePaymentPlanEscrowInput = {
	amount: number;
	currency: string;
	planId: string;
	planLabel: string;
	planSubtitle: string;
	projectedYield: number;
	yieldProductId: string;
	yieldProductLabel: string;
	yieldApy: number;
	releaseSchedule: Array<{
		label: string;
		date: Date;
		amount: number;
	}>;
};

export type CreatePaymentPlanEscrowResult = {
	session: DemoSessionState;
	escrowPlan: DemoActiveEscrowPlan;
	txHash: string;
	confirmationMs: number;
};

export type AdvancePaymentPlanInstallmentResult = {
	session: DemoSessionState;
	payment: DemoTransaction;
	installment: DemoEscrowInstallment;
	completed: boolean;
	interestPaidOut: number;
};

export type PayCurrentBalanceResult = {
	session: DemoSessionState;
	paymentPlan: PaymentPlan;
	swaps: DemoTransaction[];
	payment: DemoTransaction;
	invoice: CurrentBalanceView["invoice"];
};

type SerializedDemoStudent = Omit<DemoStudent, "createdAt"> & {
	createdAt: string;
};

type SerializedDemoInvoice = Omit<
	DemoInvoice,
	"dueDate" | "paidAt" | "createdAt"
> & {
	dueDate: string;
	paidAt: string | null;
	createdAt: string;
};

type SerializedDemoTransaction = Omit<
	DemoTransaction,
	"createdAt" | "confirmedAt"
> & {
	createdAt: string;
	confirmedAt: string | null;
};

type SerializedDemoEscrowInstallment = Omit<
	DemoEscrowInstallment,
	"dueDate" | "processedAt"
> & {
	dueDate: string;
	processedAt: string | null;
};

type SerializedDemoEscrowPlan = Omit<
	DemoActiveEscrowPlan,
	"createdAt" | "installments"
> & {
	createdAt: string;
	installments: SerializedDemoEscrowInstallment[];
};

type SerializedDemoSessionState = Omit<
	DemoSessionState,
	"student" | "invoices" | "transactions" | "activeEscrowPlan"
> & {
	student: SerializedDemoStudent;
	invoices: SerializedDemoInvoice[];
	transactions: SerializedDemoTransaction[];
	activeEscrowPlan?: SerializedDemoEscrowPlan | null;
};

export function createInitialDemoSession(
	name: string,
	options: CreateDemoStudentOptions = {},
): DemoSessionState {
	const createdAt = new Date();
	const university: DemoUniversity = {
		id: "meridian",
		name: SEED_UNIVERSITY.name,
		walletAddress: SEED_UNIVERSITY.walletAddress,
	};
	const student: DemoStudent = {
		id: crypto.randomUUID(),
		name: name.trim(),
		walletAddress: options.walletAddress ?? mockWalletAddress(),
		walletMode: options.walletMode ?? "mock",
		circleWalletId: options.circleWalletId ?? null,
		universityId: university.id,
		createdAt,
	};

	return {
		student,
		university,
		balances: normalizeBalances(
			DEPOSIT_CURRENCIES.map((currency) => ({
				id: crypto.randomUUID(),
				studentId: student.id,
				currency: currency.symbol,
				amount: 0,
			})),
			student.id,
		),
		invoices: SEED_INVOICES.map((invoice) => ({
			id: crypto.randomUUID(),
			universityId: university.id,
			studentId: student.id,
			description: invoice.description,
			amount: invoice.amount,
			currency: invoice.currency,
			dueDate: new Date(invoice.dueDate),
			status: "UNPAID" as const,
			paidAt: null,
			transactionId: null,
			createdAt,
		})).sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime()),
		transactions: [],
		activeEscrowPlan: null,
		liveCapabilities: {
			...MOCK_LIVE_CAPABILITIES,
			...options.liveCapabilities,
		},
		nextBlockNumber: INITIAL_BLOCK_NUMBER,
	};
}

export function resetDemoSession(): null {
	return null;
}

export function getDashboardView(
	session: DemoSessionState | null,
): DashboardView | null {
	if (!session) return null;

	return {
		student: {
			...session.student,
			university: session.university,
		},
		balances: normalizeBalances(session.balances, session.student.id),
		invoices: sortInvoices(session.invoices),
		transactions: getTransactions(session).slice(0, 10),
		activeEscrowPlan: session.activeEscrowPlan,
	};
}

export function getCurrentBalanceView(
	session: DemoSessionState | null,
): CurrentBalanceView | null {
	if (!session) return null;

	const invoices = sortInvoices(
		session.invoices.filter((invoice) => invoice.status === "UNPAID"),
	);

	if (invoices.length === 0) {
		return null;
	}

	const [firstInvoice] = invoices;
	if (!firstInvoice) return null;

	return {
		invoice: {
			id: "current",
			description: "Current balance",
			amount: normalizeAmount(
				invoices.reduce((sum, invoice) => sum + invoice.amount, 0),
			),
			currency: firstInvoice.currency,
			dueDate: firstInvoice.dueDate,
			status: "UNPAID",
			university: session.university,
			statementCount: invoices.length,
			statements: invoices.map((invoice) => ({
				id: invoice.id,
				description: invoice.description,
				amount: invoice.amount,
				dueDate: invoice.dueDate,
				status: invoice.status,
			})),
		},
		balances: normalizeBalances(session.balances, session.student.id),
	};
}

export function getTransactions(
	session: DemoSessionState | null,
	filter?: DemoTransactionType,
): DemoTransaction[] {
	if (!session) return [];

	return [...session.transactions]
		.filter((transaction) => (filter ? transaction.type === filter : true))
		.sort(
			(left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
		);
}

export function getUniversityDashboardView(
	session: DemoSessionState | null,
): UniversityDashboardView | null {
	if (!session) return null;

	const payments = getTransactions(session, "PAYMENT").filter(
		(transaction) => transaction.toAddress === session.university.walletAddress,
	);
	const paidInvoices = session.invoices.filter(
		(invoice) => invoice.status === "PAID",
	).length;
	const unpaidInvoices = session.invoices.filter(
		(invoice) => invoice.status === "UNPAID",
	).length;
	const totalReceived = normalizeAmount(
		payments.reduce((sum, payment) => sum + payment.amount, 0),
	);
	const avgConfirmationMs =
		payments.length > 0
			? Math.round(
					payments.reduce(
						(sum, payment) => sum + (payment.confirmationMs ?? 0),
						0,
					) / payments.length,
				)
			: 0;

	return {
		university: session.university,
		payments: payments.map((payment) => ({
			...payment,
			student: session.student,
		})),
		stats: {
			totalReceived,
			paymentCount: payments.length,
			studentCount: 1,
			paidInvoices,
			unpaidInvoices,
			avgConfirmationMs,
		},
	};
}

export function getActiveEscrowPlan(
	session: DemoSessionState | null,
): DemoActiveEscrowPlan | null {
	if (!session) return null;
	return session.activeEscrowPlan;
}

export function commitDeposit(
	session: DemoSessionState,
	input: CommitDepositInput,
): CommitDepositResult {
	const amount = normalizePositiveAmount(input.amount, "Deposit amount");
	const chain = getCctpChain(input.sourceChainDomain);
	const shouldAutoSwap =
		input.autoSwap && input.currency !== input.settlementCurrency;

	if (shouldAutoSwap && !input.swapQuote) {
		throw new Error("StableFX quote is required for this deposit.");
	}

	if (
		input.swapQuote &&
		(Math.abs(input.swapQuote.fromAmount - amount) > AMOUNT_EPSILON ||
			input.swapQuote.fromCurrency !== input.currency)
	) {
		throw new Error("StableFX quote does not match the deposit.");
	}

	const settledCurrency = shouldAutoSwap
		? (input.swapQuote?.toCurrency ?? input.settlementCurrency)
		: input.settlementCurrency;
	const settledAmount = shouldAutoSwap
		? (input.swapQuote?.toAmount ?? amount)
		: amount;
	const confirmedAt = new Date();
	const { blockNumber, session: sessionWithBlock } =
		reserveBlockNumber(session);
	const transaction: DemoTransaction = {
		id: crypto.randomUUID(),
		studentId: session.student.id,
		type: "DEPOSIT",
		status: "CONFIRMED",
		provenance: "mock",
		amount,
		currency: input.currency,
		sourceChain: chain.name,
		sourceChainDomain: chain.domain,
		depositStep: "COMPLETE",
		toAddress: null,
		fromCurrency: shouldAutoSwap
			? (input.swapQuote?.fromCurrency ?? null)
			: null,
		toCurrency: shouldAutoSwap ? (input.swapQuote?.toCurrency ?? null) : null,
		toAmount: shouldAutoSwap ? (input.swapQuote?.toAmount ?? null) : null,
		exchangeRate: shouldAutoSwap ? (input.swapQuote?.rate ?? null) : null,
		txHash: mockTxHash(),
		blockNumber,
		networkFee: ARC.networkFee,
		gasSponsor: "Remit Platform",
		confirmationMs: getDepositFlowDurationMs({
			arcNative: chain.domain === ARC.cctpDomain,
			autoSwap: shouldAutoSwap,
		}),
		createdAt: confirmedAt,
		confirmedAt,
	};

	const nextSession = {
		...sessionWithBlock,
		balances: adjustBalance(
			sessionWithBlock.balances,
			session.student.id,
			settledCurrency,
			settledAmount,
		),
		transactions: [...sessionWithBlock.transactions, transaction],
	};

	return {
		session: nextSession,
		transaction,
	};
}

export function commitSwap(
	session: DemoSessionState,
	input: CommitSwapInput,
): CommitSwapResult {
	if (input.fromCurrency === input.toCurrency) {
		throw new Error("Swap requires two different currencies.");
	}

	const fromAmount = normalizePositiveAmount(input.fromAmount, "Swap amount");
	validateSwapQuote(
		input.quote,
		input.fromCurrency,
		input.toCurrency,
		fromAmount,
	);

	const sourceBalance = getBalanceAmount(session.balances, input.fromCurrency);
	if (sourceBalance + AMOUNT_EPSILON < fromAmount) {
		throw new Error(`Insufficient ${input.fromCurrency} balance.`);
	}

	const confirmedAt = new Date();
	const { blockNumber, session: sessionWithBlock } =
		reserveBlockNumber(session);
	const transaction: DemoTransaction = {
		id: crypto.randomUUID(),
		studentId: session.student.id,
		type: "SWAP",
		status: "CONFIRMED",
		provenance: "mock",
		amount: fromAmount,
		currency: input.fromCurrency,
		sourceChain: null,
		sourceChainDomain: null,
		depositStep: null,
		toAddress: null,
		fromCurrency: input.fromCurrency,
		toCurrency: input.toCurrency,
		toAmount: normalizeAmount(input.quote.toAmount),
		exchangeRate: input.quote.rate,
		txHash: mockTxHash(),
		blockNumber,
		networkFee: ARC.networkFee,
		gasSponsor: "Remit Platform",
		confirmationMs: mockConfirmationMs(),
		createdAt: confirmedAt,
		confirmedAt,
	};

	const debitedBalances = adjustBalance(
		sessionWithBlock.balances,
		session.student.id,
		input.fromCurrency,
		-fromAmount,
	);
	const creditedBalances = adjustBalance(
		debitedBalances,
		session.student.id,
		input.toCurrency,
		input.quote.toAmount,
	);

	return {
		session: {
			...sessionWithBlock,
			balances: creditedBalances,
			transactions: [...sessionWithBlock.transactions, transaction],
		},
		transaction,
	};
}

export function recordLiveTopup(
	session: DemoSessionState,
	input: RecordLiveTopupInput,
): RecordLiveTopupResult {
	const amount = normalizePositiveAmount(input.amount, "Top-up amount");
	const confirmedAt = new Date();
	const { blockNumber, session: sessionWithBlock } =
		reserveBlockNumber(session);
	const transaction: DemoTransaction = {
		id: crypto.randomUUID(),
		studentId: session.student.id,
		type: "DEPOSIT",
		status: "CONFIRMED",
		provenance: "live",
		amount,
		currency: "USDC",
		sourceChain: "Arc",
		sourceChainDomain: ARC.cctpDomain,
		depositStep: "COMPLETE",
		toAddress: session.student.walletAddress,
		fromCurrency: null,
		toCurrency: null,
		toAmount: null,
		exchangeRate: null,
		txHash: input.txHash,
		blockNumber,
		networkFee: null,
		gasSponsor: null,
		confirmationMs: normalizeConfirmationMs(input.confirmationMs),
		createdAt: confirmedAt,
		confirmedAt,
	};

	return {
		session: {
			...sessionWithBlock,
			balances: adjustBalance(
				sessionWithBlock.balances,
				session.student.id,
				"USDC",
				amount,
			),
			transactions: [...sessionWithBlock.transactions, transaction],
		},
		transaction,
	};
}

export function commitLiveSwap(
	session: DemoSessionState,
	input: CommitLiveSwapInput,
): CommitLiveSwapResult {
	if (input.fromCurrency === input.toCurrency) {
		throw new Error("Swap requires two different currencies.");
	}

	const fromAmount = normalizePositiveAmount(input.fromAmount, "Swap amount");
	const toAmount = normalizePositiveAmount(input.toAmount, "Swap output");
	const sourceBalance = getBalanceAmount(session.balances, input.fromCurrency);
	if (sourceBalance + AMOUNT_EPSILON < fromAmount) {
		throw new Error(`Insufficient ${input.fromCurrency} balance.`);
	}

	const confirmedAt = new Date();
	const { blockNumber, session: sessionWithBlock } =
		reserveBlockNumber(session);
	const transaction: DemoTransaction = {
		id: crypto.randomUUID(),
		studentId: session.student.id,
		type: "SWAP",
		status: "CONFIRMED",
		provenance: "live",
		amount: fromAmount,
		currency: input.fromCurrency,
		sourceChain: "Arc",
		sourceChainDomain: ARC.cctpDomain,
		depositStep: null,
		toAddress: session.student.walletAddress,
		fromCurrency: input.fromCurrency,
		toCurrency: input.toCurrency,
		toAmount,
		exchangeRate:
			input.exchangeRate != null
				? normalizeAmount(input.exchangeRate)
				: normalizeAmount(toAmount / fromAmount),
		txHash: input.txHash,
		blockNumber,
		networkFee: ARC.networkFee,
		gasSponsor: "Remit Platform",
		confirmationMs: normalizeConfirmationMs(input.confirmationMs),
		createdAt: confirmedAt,
		confirmedAt,
	};

	const debitedBalances = adjustBalance(
		sessionWithBlock.balances,
		session.student.id,
		input.fromCurrency,
		-fromAmount,
	);
	const creditedBalances = adjustBalance(
		debitedBalances,
		session.student.id,
		input.toCurrency,
		toAmount,
	);

	return {
		session: {
			...sessionWithBlock,
			balances: creditedBalances,
			transactions: [...sessionWithBlock.transactions, transaction],
		},
		transaction,
	};
}

export function createPaymentPlanEscrow(
	session: DemoSessionState,
	input: CreatePaymentPlanEscrowInput,
): CreatePaymentPlanEscrowResult {
	if (session.activeEscrowPlan) {
		throw new Error("A payment plan is already active.");
	}
	if (input.releaseSchedule.length === 0) {
		throw new Error("Payment plan schedule is required.");
	}

	const amount = normalizePositiveAmount(input.amount, "Escrow amount");
	const paymentPlan = buildPaymentPlan(
		session.balances,
		amount,
		input.currency,
	);
	if (!paymentPlan.canPay) {
		throw new Error(
			`Insufficient payment power. Add ${paymentPlan.targetCurrency} or another supported balance.`,
		);
	}

	const baseTime = Date.now();
	const fundedSession = applyPaymentPlanSwaps(session, paymentPlan, baseTime);
	const balancesAfterEscrow = adjustBalance(
		fundedSession.session.balances,
		session.student.id,
		input.currency,
		-amount,
	);

	const installments = input.releaseSchedule.map((installment) => ({
		id: crypto.randomUUID(),
		label: installment.label,
		dueDate: installment.date,
		amount: normalizeAmount(installment.amount),
		status: "PENDING" as const,
		processedAt: null,
		paymentTransactionId: null,
	}));
	const totalScheduled = normalizeAmount(
		installments.reduce((sum, installment) => sum + installment.amount, 0),
	);
	if (Math.abs(totalScheduled - amount) > 0.01) {
		throw new Error("Installment schedule does not match escrow amount.");
	}

	const escrowPlan: DemoActiveEscrowPlan = {
		id: crypto.randomUUID(),
		planId: input.planId,
		planLabel: input.planLabel,
		planSubtitle: input.planSubtitle,
		currency: input.currency,
		totalCommitted: amount,
		remainingPrincipal: amount,
		projectedYield: normalizeAmount(input.projectedYield),
		interestAccrued: 0,
		yieldProductId: input.yieldProductId,
		yieldProductLabel: input.yieldProductLabel,
		yieldApy: input.yieldApy,
		installments,
		nextInstallmentIndex: 0,
		createdAt: new Date(),
	};

	const nextSession = {
		...fundedSession.session,
		balances: balancesAfterEscrow,
		activeEscrowPlan: escrowPlan,
	};

	return {
		session: nextSession,
		escrowPlan,
		txHash: mockTxHash(),
		confirmationMs: mockConfirmationMs(),
	};
}

export function advancePaymentPlanInstallment(
	session: DemoSessionState,
): AdvancePaymentPlanInstallmentResult {
	const escrowPlan = session.activeEscrowPlan;
	if (!escrowPlan) {
		throw new Error("No active payment plan.");
	}

	const installment = escrowPlan.installments[escrowPlan.nextInstallmentIndex];
	if (!installment || installment.status !== "PENDING") {
		throw new Error("No installment is available to process.");
	}

	const paymentAmount = normalizeAmount(
		Math.min(installment.amount, escrowPlan.remainingPrincipal),
	);
	const paymentConfirmedAt = new Date();
	const { blockNumber, session: sessionWithBlock } =
		reserveBlockNumber(session);
	const payment: DemoTransaction = {
		id: crypto.randomUUID(),
		studentId: session.student.id,
		type: "PAYMENT",
		status: "CONFIRMED",
		provenance: "mock",
		amount: paymentAmount,
		currency: escrowPlan.currency,
		sourceChain: null,
		sourceChainDomain: null,
		depositStep: null,
		toAddress: session.university.walletAddress,
		fromCurrency: null,
		toCurrency: null,
		toAmount: null,
		exchangeRate: null,
		txHash: mockTxHash(),
		blockNumber,
		networkFee: ARC.networkFee,
		gasSponsor: "Remit Platform",
		confirmationMs: mockConfirmationMs(),
		createdAt: paymentConfirmedAt,
		confirmedAt: paymentConfirmedAt,
	};

	const nextInstallmentIndex = escrowPlan.nextInstallmentIndex + 1;
	const updatedInstallment: DemoEscrowInstallment = {
		...installment,
		amount: paymentAmount,
		status: "PROCESSED",
		processedAt: paymentConfirmedAt,
		paymentTransactionId: payment.id,
	};
	const installments = escrowPlan.installments.map((item, index) =>
		index === escrowPlan.nextInstallmentIndex ? updatedInstallment : item,
	);
	const remainingPrincipal = normalizeAmount(
		Math.max(escrowPlan.remainingPrincipal - paymentAmount, 0),
	);
	const interestAccrued = normalizeAmount(
		(escrowPlan.projectedYield * nextInstallmentIndex) /
			Math.max(escrowPlan.installments.length, 1),
	);
	const completed =
		nextInstallmentIndex >= escrowPlan.installments.length ||
		remainingPrincipal <= AMOUNT_EPSILON;
	const interestPaidOut = completed ? interestAccrued : 0;
	const balancesWithInterest =
		interestPaidOut > AMOUNT_EPSILON
			? adjustBalance(
					sessionWithBlock.balances,
					session.student.id,
					escrowPlan.currency,
					interestPaidOut,
				)
			: sessionWithBlock.balances;

	return {
		session: {
			...sessionWithBlock,
			balances: balancesWithInterest,
			invoices: applyPaymentToInvoices(
				sessionWithBlock.invoices,
				paymentAmount,
				payment.id,
				paymentConfirmedAt,
			),
			transactions: [...sessionWithBlock.transactions, payment],
			activeEscrowPlan: completed
				? null
				: {
						...escrowPlan,
						installments,
						remainingPrincipal,
						interestAccrued,
						nextInstallmentIndex,
					},
		},
		payment,
		installment: updatedInstallment,
		completed,
		interestPaidOut,
	};
}

export function payCurrentBalance(
	session: DemoSessionState,
	requestedAmount?: number,
): PayCurrentBalanceResult {
	const currentBalance = getCurrentBalanceView(session);
	if (!currentBalance) {
		throw new Error("No current balance is available.");
	}

	const paymentAmount = normalizeAmount(
		requestedAmount ?? currentBalance.invoice.amount,
	);
	if (paymentAmount <= AMOUNT_EPSILON) {
		throw new Error("Enter an amount greater than $0.00.");
	}
	if (paymentAmount - currentBalance.invoice.amount > AMOUNT_EPSILON) {
		throw new Error("Payment amount exceeds the current balance.");
	}

	const paymentPlan = buildPaymentPlan(
		session.balances,
		paymentAmount,
		currentBalance.invoice.currency,
	);

	if (!paymentPlan.canPay) {
		throw new Error(
			`Insufficient payment power. Add ${paymentPlan.targetCurrency} or another supported balance.`,
		);
	}

	const baseTime = Date.now();
	const fundedSession = applyPaymentPlanSwaps(session, paymentPlan, baseTime);
	let nextSession = fundedSession.session;
	const swaps = fundedSession.swaps;

	const paymentTimestamp = baseTime + paymentPlan.steps.length + 1;
	const paymentConfirmedAt = new Date(paymentTimestamp);
	const { blockNumber, session: sessionWithBlock } =
		reserveBlockNumber(nextSession);
	const payment: DemoTransaction = {
		id: crypto.randomUUID(),
		studentId: session.student.id,
		type: "PAYMENT",
		status: "CONFIRMED",
		provenance: "mock",
		amount: paymentAmount,
		currency: currentBalance.invoice.currency,
		sourceChain: null,
		sourceChainDomain: null,
		depositStep: null,
		toAddress: session.university.walletAddress,
		fromCurrency: null,
		toCurrency: null,
		toAmount: null,
		exchangeRate: null,
		txHash: mockTxHash(),
		blockNumber,
		networkFee: ARC.networkFee,
		gasSponsor: "Remit Platform",
		confirmationMs: mockConfirmationMs(),
		createdAt: paymentConfirmedAt,
		confirmedAt: paymentConfirmedAt,
	};

	nextSession = {
		...sessionWithBlock,
		balances: adjustBalance(
			sessionWithBlock.balances,
			session.student.id,
			currentBalance.invoice.currency,
			-paymentAmount,
		),
		invoices: applyPaymentToInvoices(
			sessionWithBlock.invoices,
			paymentAmount,
			payment.id,
			paymentConfirmedAt,
		),
		transactions: [...sessionWithBlock.transactions, payment],
	};

	return {
		session: nextSession,
		paymentPlan,
		swaps,
		payment,
		invoice: {
			...currentBalance.invoice,
			status: "UNPAID",
		},
	};
}

export function serializeDemoSession(session: DemoSessionState): string {
	const serialized: SerializedDemoSessionState = {
		...session,
		student: {
			...session.student,
			createdAt: session.student.createdAt.toISOString(),
		},
		invoices: session.invoices.map((invoice) => ({
			...invoice,
			dueDate: invoice.dueDate.toISOString(),
			paidAt: invoice.paidAt?.toISOString() ?? null,
			createdAt: invoice.createdAt.toISOString(),
		})),
		transactions: session.transactions.map((transaction) => ({
			...transaction,
			createdAt: transaction.createdAt.toISOString(),
			confirmedAt: transaction.confirmedAt?.toISOString() ?? null,
		})),
		activeEscrowPlan: session.activeEscrowPlan
			? {
					...session.activeEscrowPlan,
					createdAt: session.activeEscrowPlan.createdAt.toISOString(),
					installments: session.activeEscrowPlan.installments.map(
						(installment) => ({
							...installment,
							dueDate: installment.dueDate.toISOString(),
							processedAt: installment.processedAt?.toISOString() ?? null,
						}),
					),
				}
			: null,
	};

	return JSON.stringify(serialized);
}

export function deserializeDemoSession(value: string): DemoSessionState | null {
	try {
		const parsed = JSON.parse(value) as SerializedDemoSessionState;
		const studentId = parsed.student.id;
		return {
			...parsed,
			student: {
				...parsed.student,
				walletMode:
					parsed.student.walletMode === "circle_sca" ? "circle_sca" : "mock",
				circleWalletId: parsed.student.circleWalletId ?? null,
				createdAt: reviveDate(parsed.student.createdAt),
			},
			balances: normalizeBalances(parsed.balances, studentId),
			invoices: sortInvoices(
				parsed.invoices.map((invoice) => ({
					...invoice,
					dueDate: reviveDate(invoice.dueDate),
					paidAt: reviveNullableDate(invoice.paidAt),
					createdAt: reviveDate(invoice.createdAt),
				})),
			),
			transactions: parsed.transactions
				.map((transaction) => ({
					...transaction,
					provenance:
						transaction.provenance === "live"
							? ("live" as const)
							: ("mock" as const),
					createdAt: reviveDate(transaction.createdAt),
					confirmedAt: reviveNullableDate(transaction.confirmedAt),
				}))
				.sort(
					(left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
				),
			activeEscrowPlan: parsed.activeEscrowPlan
				? {
						...parsed.activeEscrowPlan,
						createdAt: reviveDate(parsed.activeEscrowPlan.createdAt),
						installments: parsed.activeEscrowPlan.installments.map(
							(installment) => ({
								...installment,
								dueDate: reviveDate(installment.dueDate),
								processedAt: reviveNullableDate(installment.processedAt),
							}),
						),
					}
				: null,
			liveCapabilities: normalizeLiveCapabilities(parsed.liveCapabilities),
			nextBlockNumber:
				typeof parsed.nextBlockNumber === "number" &&
				Number.isFinite(parsed.nextBlockNumber)
					? parsed.nextBlockNumber
					: INITIAL_BLOCK_NUMBER,
		};
	} catch {
		return null;
	}
}

function applyPaymentPlanSwaps(
	session: DemoSessionState,
	paymentPlan: PaymentPlan,
	baseTime: number,
) {
	let nextSession = { ...session, balances: [...session.balances] };
	const swaps: DemoTransaction[] = [];

	for (const [index, step] of paymentPlan.steps.entries()) {
		if (step.kind !== "swap") continue;
		const result = commitPaymentSwapStep(nextSession, step, baseTime + index);
		nextSession = result.session;
		swaps.push(result.transaction);
	}

	return { session: nextSession, swaps };
}

function applyPaymentToInvoices(
	invoices: DemoInvoice[],
	paymentAmount: number,
	paymentId: string,
	paymentConfirmedAt: Date,
) {
	let remainingPayment = paymentAmount;
	return sortInvoices(
		invoices.map((invoice) =>
			invoice.status !== "UNPAID" || remainingPayment <= AMOUNT_EPSILON
				? invoice
				: (() => {
						const appliedAmount = Math.min(invoice.amount, remainingPayment);
						remainingPayment = normalizeAmount(
							Math.max(remainingPayment - appliedAmount, 0),
						);

						if (invoice.amount - appliedAmount <= AMOUNT_EPSILON) {
							return {
								...invoice,
								amount: 0,
								status: "PAID" as const,
								paidAt: paymentConfirmedAt,
								transactionId: paymentId,
							};
						}

						return {
							...invoice,
							amount: normalizeAmount(invoice.amount - appliedAmount),
						};
					})(),
		),
	);
}

function commitPaymentSwapStep(
	session: DemoSessionState,
	step: Extract<PaymentPlanStep, { kind: "swap" }>,
	timestamp: number,
) {
	const sourceBalance = getBalanceAmount(session.balances, step.fromCurrency);
	if (sourceBalance + AMOUNT_EPSILON < step.fromAmount) {
		throw new Error(`Insufficient ${step.fromCurrency} balance.`);
	}

	const confirmedAt = new Date(timestamp);
	const { blockNumber, session: sessionWithBlock } =
		reserveBlockNumber(session);
	const transaction: DemoTransaction = {
		id: crypto.randomUUID(),
		studentId: session.student.id,
		type: "SWAP",
		status: "CONFIRMED",
		provenance: "mock",
		amount: step.fromAmount,
		currency: step.fromCurrency,
		sourceChain: null,
		sourceChainDomain: null,
		depositStep: null,
		toAddress: null,
		fromCurrency: step.fromCurrency,
		toCurrency: step.toCurrency,
		toAmount: step.toAmount,
		exchangeRate: step.effectiveRate,
		txHash: mockTxHash(),
		blockNumber,
		networkFee: ARC.networkFee,
		gasSponsor: "Remit Platform",
		confirmationMs: mockConfirmationMs(),
		createdAt: confirmedAt,
		confirmedAt,
	};

	const debitedBalances = adjustBalance(
		sessionWithBlock.balances,
		session.student.id,
		step.fromCurrency,
		-step.fromAmount,
	);
	const creditedBalances = adjustBalance(
		debitedBalances,
		session.student.id,
		step.toCurrency,
		step.toAmount,
	);

	return {
		session: {
			...sessionWithBlock,
			balances: creditedBalances,
			transactions: [...sessionWithBlock.transactions, transaction],
		},
		transaction,
	};
}

function validateSwapQuote(
	quote: StableFxQuoteSnapshot,
	fromCurrency: string,
	toCurrency: string,
	fromAmount: number,
) {
	if (
		quote.fromCurrency !== fromCurrency ||
		quote.toCurrency !== toCurrency ||
		Math.abs(quote.fromAmount - fromAmount) > AMOUNT_EPSILON
	) {
		throw new Error("StableFX quote does not match the requested swap.");
	}
}

function adjustBalance(
	balances: DemoBalance[],
	studentId: string,
	currency: string,
	delta: number,
) {
	const balanceByCurrency = new Map(
		normalizeBalances(balances, studentId).map((balance) => [
			balance.currency,
			{ ...balance },
		]),
	);
	const existingBalance = balanceByCurrency.get(currency);

	if (!existingBalance) {
		if (delta < -AMOUNT_EPSILON) {
			throw new Error(`Insufficient ${currency} balance.`);
		}

		balanceByCurrency.set(currency, {
			id: crypto.randomUUID(),
			studentId,
			currency,
			amount: normalizeAmount(Math.max(delta, 0)),
		});
	} else {
		const nextAmount = normalizeAmount(existingBalance.amount + delta);
		if (nextAmount < -AMOUNT_EPSILON) {
			throw new Error(`Insufficient ${currency} balance.`);
		}
		balanceByCurrency.set(currency, {
			...existingBalance,
			amount: Math.max(nextAmount, 0),
		});
	}

	return normalizeBalances([...balanceByCurrency.values()], studentId);
}

function normalizeBalances(balances: DemoBalance[], studentId: string) {
	const existingByCurrency = new Map(
		balances.map((balance) => [
			balance.currency,
			{ ...balance, amount: normalizeAmount(balance.amount) },
		]),
	);
	const ensured = ensureWalletBalances(
		balances.map((balance) => ({
			currency: balance.currency,
			amount: balance.amount,
		})),
	);

	return ensured.map((balance) => {
		const existing = existingByCurrency.get(balance.currency);
		if (existing) {
			return {
				...existing,
				amount: normalizeAmount(balance.amount),
			};
		}

		return {
			id: crypto.randomUUID(),
			studentId,
			currency: balance.currency,
			amount: normalizeAmount(balance.amount),
		};
	});
}

function reserveBlockNumber(session: DemoSessionState) {
	return {
		blockNumber: session.nextBlockNumber,
		session: {
			...session,
			nextBlockNumber: session.nextBlockNumber + 1,
		},
	};
}

function sortInvoices(invoices: DemoInvoice[]) {
	return [...invoices].sort(
		(left, right) => left.dueDate.getTime() - right.dueDate.getTime(),
	);
}

function getBalanceAmount(balances: DemoBalance[], currency: string) {
	return balances.find((balance) => balance.currency === currency)?.amount ?? 0;
}

function getCctpChain(domain: number): CctpChain {
	const chain = CCTP_CHAINS.find((item) => item.domain === domain);
	if (!chain) {
		throw new Error("Invalid source chain.");
	}
	return chain;
}

function normalizePositiveAmount(amount: number, label: string) {
	const normalized = normalizeAmount(amount);
	if (!Number.isFinite(normalized) || normalized <= 0) {
		throw new Error(`${label} must be greater than zero.`);
	}
	return normalized;
}

function normalizeAmount(amount: number) {
	return Number(amount.toFixed(6));
}

function normalizeConfirmationMs(value: number) {
	if (!Number.isFinite(value) || value <= 0) {
		return 0;
	}
	return Math.round(value);
}

function normalizeLiveCapabilities(
	capabilities: Partial<DemoLiveCapabilities> | undefined,
): DemoLiveCapabilities {
	return {
		...MOCK_LIVE_CAPABILITIES,
		...capabilities,
	};
}

function reviveDate(value: string) {
	const revived = new Date(value);
	if (Number.isNaN(revived.getTime())) {
		throw new Error("Invalid date.");
	}
	return revived;
}

function reviveNullableDate(value: string | null) {
	return value ? reviveDate(value) : null;
}
