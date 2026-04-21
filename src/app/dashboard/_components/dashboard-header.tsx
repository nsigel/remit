"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLockup } from "~/app/_components/brand-lockup";

type DashboardHeaderProps = {
	rightSlot?: ReactNode;
};

export function DashboardHeader({ rightSlot }: DashboardHeaderProps) {
	return (
		<header className="sticky top-0 z-50 flex h-[52px] items-center justify-between border-border border-b bg-bg px-6">
			<Link
				className="cursor-pointer font-serif text-lg tracking-tight"
				href="/dashboard"
			>
				<BrandLockup />
			</Link>
			{rightSlot ? (
				<div className="flex items-center gap-4">{rightSlot}</div>
			) : null}
		</header>
	);
}
