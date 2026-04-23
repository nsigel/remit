"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import {
	type AdvancePaymentPlanInstallmentResult,
	advancePaymentPlanInstallment as advancePaymentPlanInstallmentInSession,
	type CommitDepositInput,
	type CommitDepositResult,
	type CommitLiveSwapInput,
	type CommitLiveSwapResult,
	type CommitSwapInput,
	type CommitSwapResult,
	type CreateDemoStudentOptions,
	type CreatePaymentPlanEscrowInput,
	type CreatePaymentPlanEscrowResult,
	type CurrentBalanceView,
	commitDeposit as commitDepositToSession,
	commitLiveSwap as commitLiveSwapInSession,
	commitSwap as commitSwapToSession,
	createInitialDemoSession,
	createPaymentPlanEscrow as createPaymentPlanEscrowInSession,
	type DashboardView,
	DEMO_SESSION_STORAGE_KEY,
	type DemoActiveEscrowPlan,
	type DemoSessionState,
	type DemoTransaction,
	type DemoTransactionType,
	deserializeDemoSession,
	getActiveEscrowPlan,
	getCurrentBalanceView,
	getDashboardView,
	getTransactions,
	getUniversityDashboardView,
	type PayCurrentBalanceResult,
	payCurrentBalance as payCurrentBalanceInSession,
	type RecordLiveTopupInput,
	type RecordLiveTopupResult,
	recordLiveTopup as recordLiveTopupInSession,
	resetDemoSession,
	serializeDemoSession,
	type UniversityDashboardView,
} from "~/lib/demo-model";

type DemoSessionContextValue = {
	status: "hydrating" | "ready";
	session: DemoSessionState | null;
	hasSession: boolean;
	actions: {
		createStudent: (
			name: string,
			options?: CreateDemoStudentOptions,
		) => DemoSessionState;
		reset: () => void;
		commitDeposit: (input: CommitDepositInput) => CommitDepositResult;
		commitSwap: (input: CommitSwapInput) => CommitSwapResult;
		recordLiveTopup: (input: RecordLiveTopupInput) => RecordLiveTopupResult;
		commitLiveSwap: (input: CommitLiveSwapInput) => CommitLiveSwapResult;
		payCurrentBalance: (amount?: number) => PayCurrentBalanceResult;
		createPaymentPlanEscrow: (
			input: CreatePaymentPlanEscrowInput,
		) => CreatePaymentPlanEscrowResult;
		advancePaymentPlanInstallment: () => AdvancePaymentPlanInstallmentResult;
	};
	selectors: {
		dashboard: () => DashboardView | null;
		currentBalance: () => CurrentBalanceView | null;
		transactions: (filter?: DemoTransactionType) => DemoTransaction[];
		university: () => UniversityDashboardView | null;
		activeEscrowPlan: () => DemoActiveEscrowPlan | null;
	};
};

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider({ children }: { children: ReactNode }) {
	const [status, setStatus] = useState<"hydrating" | "ready">("hydrating");
	const [session, setSession] = useState<DemoSessionState | null>(null);

	const persistSession = (nextSession: DemoSessionState | null) => {
		if (nextSession) {
			window.sessionStorage.setItem(
				DEMO_SESSION_STORAGE_KEY,
				serializeDemoSession(nextSession),
			);
			return;
		}

		window.sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
	};

	useEffect(() => {
		try {
			const storedValue = window.sessionStorage.getItem(
				DEMO_SESSION_STORAGE_KEY,
			);
			if (!storedValue) {
				setSession(null);
				setStatus("ready");
				return;
			}

			const restored = deserializeDemoSession(storedValue);
			if (!restored) {
				window.sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
			}
			setSession(restored);
		} finally {
			setStatus("ready");
		}
	}, []);

	useEffect(() => {
		if (status !== "ready") return;
		if (!session) {
			window.sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
			return;
		}

		window.sessionStorage.setItem(
			DEMO_SESSION_STORAGE_KEY,
			serializeDemoSession(session),
		);
	}, [session, status]);

	const value: DemoSessionContextValue = {
		status,
		session,
		hasSession: session != null,
		actions: {
			createStudent: (name, options) => {
				const nextSession = createInitialDemoSession(name, options);
				persistSession(nextSession);
				setSession(nextSession);
				return nextSession;
			},
			reset: () => {
				const nextSession = resetDemoSession();
				persistSession(nextSession);
				setSession(nextSession);
			},
			commitDeposit: (input) => {
				let result: CommitDepositResult | null = null;
				setSession((current) => {
					if (!current) return current;
					result = commitDepositToSession(current, input);
					persistSession(result.session);
					return result.session;
				});
				if (!result) {
					throw new Error("No demo session is active.");
				}
				return result;
			},
			commitSwap: (input) => {
				let result: CommitSwapResult | null = null;
				setSession((current) => {
					if (!current) return current;
					result = commitSwapToSession(current, input);
					persistSession(result.session);
					return result.session;
				});
				if (!result) {
					throw new Error("No demo session is active.");
				}
				return result;
			},
			recordLiveTopup: (input) => {
				let result: RecordLiveTopupResult | null = null;
				setSession((current) => {
					if (!current) return current;
					result = recordLiveTopupInSession(current, input);
					persistSession(result.session);
					return result.session;
				});
				if (!result) {
					throw new Error("No demo session is active.");
				}
				return result;
			},
			commitLiveSwap: (input) => {
				let result: CommitLiveSwapResult | null = null;
				setSession((current) => {
					if (!current) return current;
					result = commitLiveSwapInSession(current, input);
					persistSession(result.session);
					return result.session;
				});
				if (!result) {
					throw new Error("No demo session is active.");
				}
				return result;
			},
			payCurrentBalance: (amount) => {
				let result: PayCurrentBalanceResult | null = null;
				setSession((current) => {
					if (!current) return current;
					result = payCurrentBalanceInSession(current, amount);
					persistSession(result.session);
					return result.session;
				});
				if (!result) {
					throw new Error("No demo session is active.");
				}
				return result;
			},
			createPaymentPlanEscrow: (input) => {
				let result: CreatePaymentPlanEscrowResult | null = null;
				setSession((current) => {
					if (!current) return current;
					result = createPaymentPlanEscrowInSession(current, input);
					persistSession(result.session);
					return result.session;
				});
				if (!result) {
					throw new Error("No demo session is active.");
				}
				return result;
			},
			advancePaymentPlanInstallment: () => {
				let result: AdvancePaymentPlanInstallmentResult | null = null;
				setSession((current) => {
					if (!current) return current;
					result = advancePaymentPlanInstallmentInSession(current);
					persistSession(result.session);
					return result.session;
				});
				if (!result) {
					throw new Error("No demo session is active.");
				}
				return result;
			},
		},
		selectors: {
			dashboard: () => getDashboardView(session),
			currentBalance: () => getCurrentBalanceView(session),
			transactions: (filter) => getTransactions(session, filter),
			university: () => getUniversityDashboardView(session),
			activeEscrowPlan: () => getActiveEscrowPlan(session),
		},
	};

	return (
		<DemoSessionContext.Provider value={value}>
			{children}
		</DemoSessionContext.Provider>
	);
}

export function useDemoSession() {
	const context = useContext(DemoSessionContext);

	if (!context) {
		throw new Error("useDemoSession must be used within DemoSessionProvider.");
	}

	return context;
}
