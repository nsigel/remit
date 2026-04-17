"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type DashboardHeaderProps = {
	rightSlot?: ReactNode;
	subtitle?: string;
};

export function DashboardHeader({
	rightSlot,
	subtitle,
}: DashboardHeaderProps) {
	return (
		<header className="border-border border-b px-5 py-5 sm:px-8 sm:py-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="space-y-1">
					<Link className="cursor-pointer font-serif text-2xl" href="/dashboard">
						Remit
					</Link>
					{subtitle ? (
						<div className="text-sm text-text-secondary">{subtitle}</div>
					) : null}
				</div>
				{rightSlot ? (
					<div className="flex items-center gap-4 sm:gap-6">{rightSlot}</div>
				) : null}
			</div>
		</header>
	);
}
