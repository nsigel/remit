"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useDemoSession } from "~/lib/demo-session";

export function RedirectIfDemoSession({
	children,
	to = "/dashboard",
}: {
	children: ReactNode;
	to?: string;
}) {
	const router = useRouter();
	const { hasSession, status } = useDemoSession();

	useEffect(() => {
		if (status !== "ready" || !hasSession) return;
		router.replace(to);
	}, [hasSession, router, status, to]);

	if (status !== "ready" || hasSession) {
		return null;
	}

	return <>{children}</>;
}

export function RequireDemoSession({
	children,
	to = "/demo",
}: {
	children: ReactNode;
	to?: string;
}) {
	const router = useRouter();
	const { hasSession, status } = useDemoSession();

	useEffect(() => {
		if (status !== "ready" || hasSession) return;
		router.replace(to);
	}, [hasSession, router, status, to]);

	if (status !== "ready") {
		return (
			<main className="flex min-h-dvh items-center justify-center">
				<span className="text-text-secondary">Loading...</span>
			</main>
		);
	}

	if (!hasSession) {
		return null;
	}

	return <>{children}</>;
}
