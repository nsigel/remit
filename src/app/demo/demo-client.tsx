"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDemoSession } from "~/lib/demo-session";

const DEFAULT_STUDENT_NAME = "Student";

export function DemoClient() {
	const router = useRouter();
	const { actions, hasSession, status } = useDemoSession();
	const hasAutoCreatedRef = useRef(false);
	const [creating, setCreating] = useState(false);
	const [walletAddress, setWalletAddress] = useState<string | null>(null);

	useEffect(() => {
		if (status !== "ready" || !hasSession || walletAddress) return;
		router.replace("/dashboard");
	}, [hasSession, router, status, walletAddress]);

	useEffect(() => {
		if (status !== "ready" || hasSession || walletAddress) return;
		if (hasAutoCreatedRef.current) return;
		hasAutoCreatedRef.current = true;
		setCreating(true);

		try {
			const session = actions.createStudent(DEFAULT_STUDENT_NAME);
			setWalletAddress(session.student.walletAddress);
		} finally {
			setCreating(false);
		}
	}, [actions, hasSession, status, walletAddress]);

	if (status !== "ready" || creating) {
		return (
			<main className="flex min-h-dvh items-center justify-center px-8">
				<span className="text-text-secondary">
					{creating ? "Creating wallet..." : "Loading..."}
				</span>
			</main>
		);
	}

	if (walletAddress) {
		return (
			<main className="flex min-h-dvh flex-col items-center justify-center px-8">
				<div className="max-w-md text-center">
					<div className="mb-4 text-4xl text-success">&#10003;</div>
					<h1 className="mb-2 font-serif text-3xl">Wallet ready</h1>
					<p className="mb-6 text-sm text-text-secondary">
						Remit wallet live on Arc network.
					</p>
					<p className="break-all text-sm text-text-secondary">
						{walletAddress}
					</p>
					<button
						className="mt-8 w-full cursor-pointer bg-text py-3 font-medium text-bg text-lg transition-opacity hover:opacity-90"
						onClick={() => router.push("/dashboard")}
						type="button"
					>
						Continue
					</button>
				</div>
			</main>
		);
	}

	if (hasSession) {
		return null;
	}

	return (
		<main className="flex min-h-dvh items-center justify-center px-8">
			<span className="text-text-secondary">Creating wallet...</span>
		</main>
	);
}
