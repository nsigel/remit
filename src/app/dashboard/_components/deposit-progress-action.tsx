"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

type DepositProgressActionProps = {
	title: string;
	status: "pending" | "active" | "complete";
	activeDetail?: ReactNode;
	completedSummary?: ReactNode;
	children?: ReactNode;
	canExpand?: boolean;
};

export function DepositProgressAction({
	title,
	status,
	activeDetail,
	completedSummary,
	children,
	canExpand = true,
}: DepositProgressActionProps) {
	return (
		<div
			className={`rounded-[1.6rem] border px-4 py-4 transition-colors sm:px-5 ${
				status === "active"
					? "border-text/12 bg-bg shadow-[0_18px_40px_rgba(10,10,10,0.08)]"
					: status === "complete"
						? "border-success/15 bg-success/6"
						: "border-border bg-bg-secondary/35"
			}`}
		>
			<div className="flex items-start gap-3">
				<StatusMarker status={status} />
				<div className="min-w-0 flex-1">
					<div className="font-medium text-[1.12rem] leading-tight">
						{title}
					</div>
					{status !== "complete" && activeDetail ? (
						<div className="mt-1.5 text-sm text-text-secondary">
							<AnimatePresence initial={false} mode="wait">
								<motion.div
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									initial={{ opacity: 0 }}
									key={typeof activeDetail === "string" ? activeDetail : title}
									transition={{ duration: 0.2, ease: "easeOut" }}
								>
									{activeDetail}
								</motion.div>
							</AnimatePresence>
						</div>
					) : null}
				</div>
			</div>

			<AnimatePresence initial={false} mode="wait">
				{status === "complete" ? (
					<motion.div
						animate={{ opacity: 1, height: "auto" }}
						className="overflow-hidden"
						exit={{ opacity: 0, height: 0 }}
						initial={{ opacity: 0, height: 0 }}
						key="complete"
						transition={{ duration: 0.22, ease: "easeOut" }}
					>
						<div className="mt-3 border-text/6 border-t pt-3">
							{completedSummary}
						</div>
					</motion.div>
				) : canExpand && children ? (
					<motion.div
						animate={{ opacity: 1, height: "auto" }}
						className="overflow-hidden"
						exit={{ opacity: 0, height: 0 }}
						initial={{ opacity: 0, height: 0 }}
						key="expanded"
						transition={{ duration: 0.24, ease: "easeOut" }}
					>
						<div className="mt-4">{children}</div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}

function StatusMarker({
	status,
}: {
	status: DepositProgressActionProps["status"];
}) {
	if (status === "complete") {
		return (
			<span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-success text-bg">
				<Check className="h-4 w-4" />
			</span>
		);
	}

	if (status === "active") {
		return (
			<span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full border border-text/10 bg-text text-bg shadow-[0_0_0_6px_rgba(10,10,10,0.04)]">
				<span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" />
			</span>
		);
	}

	return (
		<span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border bg-bg text-text-secondary">
			<span className="h-2.5 w-2.5 rounded-full bg-current opacity-70" />
		</span>
	);
}
