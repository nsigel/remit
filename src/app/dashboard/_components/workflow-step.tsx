"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

type WorkflowStepProps = {
	title: string;
	stepLabel: string;
	state: "active" | "completed";
	activeBadge?: "number" | "spinner";
	summary?: ReactNode;
	completedContent?: ReactNode;
	action?: ReactNode;
	children?: ReactNode;
};

export function WorkflowStep({
	title,
	stepLabel,
	state,
	activeBadge = "number",
	summary,
	completedContent,
	action,
	children,
}: WorkflowStepProps) {
	const stepCounter = stepLabel.match(/\d+/)?.[0] ?? stepLabel;

	return (
		<section className="pt-4 first:pt-0">
			<div className="flex items-start justify-between gap-4">
				<div className="flex min-w-0 items-center gap-3">
					<span
						className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full border text-sm ${
							state === "completed"
								? "border-success bg-success text-bg"
								: "border-text/18 bg-bg-secondary text-text"
						}`}
					>
						{state === "completed" ? (
							<Check className="h-3.5 w-3.5" />
						) : activeBadge === "spinner" ? (
							<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
						) : (
							<span className="font-medium text-[0.82rem] leading-none">
								{stepCounter}
							</span>
						)}
					</span>
					<div className="min-w-0">
						<h3 className="font-medium text-base leading-tight sm:text-[1.05rem]">
							{title}
						</h3>
					</div>
				</div>
				<div className="flex items-center gap-2">{action}</div>
			</div>

			<AnimatePresence initial={false} mode="wait">
				{state === "active" ? (
					<motion.div
						animate={{ opacity: 1, height: "auto" }}
						className="overflow-hidden"
						exit={{ opacity: 0, height: 0 }}
						initial={{ opacity: 0, height: 0 }}
						key="active"
						transition={{ duration: 0.18, ease: "easeOut" }}
					>
						<div className="mt-3 rounded-[1.25rem] border border-text/10 bg-bg-secondary/60 px-4 py-3.5 sm:px-4.5 sm:py-4">
							{children}
						</div>
					</motion.div>
				) : completedContent ? (
					<motion.div
						animate={{ opacity: 1, height: "auto" }}
						className="overflow-hidden"
						exit={{ opacity: 0, height: 0 }}
						initial={{ opacity: 0, height: 0 }}
						key="completed-content"
						transition={{ duration: 0.18, ease: "easeOut" }}
					>
						<div className="mt-3 rounded-[1.25rem] border border-text/10 bg-bg-secondary/60 px-4 py-3.5 sm:px-4.5 sm:py-4">
							{completedContent}
						</div>
					</motion.div>
				) : (
					<motion.div
						animate={{ opacity: 1, height: "auto" }}
						className="overflow-hidden"
						exit={{ opacity: 0, height: 0 }}
						initial={{ opacity: 0, height: 0 }}
						key="completed"
						transition={{ duration: 0.18, ease: "easeOut" }}
					>
						<div className="mt-2 pl-10 text-sm text-text-secondary">
							{summary}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</section>
	);
}
