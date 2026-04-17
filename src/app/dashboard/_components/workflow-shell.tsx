"use client";

import { motion } from "framer-motion";
import { type ReactNode, useEffect } from "react";

type WorkflowShellProps = {
	title: string;
	description?: string;
	onClose: () => void;
	canClose: boolean;
	children: ReactNode;
};

export function WorkflowShell({
	title,
	description,
	onClose,
	canClose,
	children,
}: WorkflowShellProps) {
	useEffect(() => {
		if (typeof window === "undefined") return;

		const mobileQuery = window.matchMedia("(max-width: 1023px)");
		const originalOverflow = document.body.style.overflow;
		const syncOverflow = () => {
			document.body.style.overflow = mobileQuery.matches
				? "hidden"
				: originalOverflow;
		};

		syncOverflow();
		mobileQuery.addEventListener("change", syncOverflow);

		return () => {
			mobileQuery.removeEventListener("change", syncOverflow);
			document.body.style.overflow = originalOverflow;
		};
	}, []);

	return (
		<motion.div
			animate={{ opacity: 1 }}
			className="fixed inset-0 z-50 flex items-end bg-text/16 backdrop-blur-sm lg:static lg:z-auto lg:block lg:bg-transparent lg:backdrop-blur-none"
			exit={{ opacity: 0 }}
			initial={{ opacity: 0 }}
			transition={{ duration: 0.2, ease: "easeOut" }}
		>
			<motion.aside
				animate={{ opacity: 1, x: 0, y: 0 }}
				aria-modal="true"
				className="w-full lg:w-[410px] lg:flex-none"
				exit={{ opacity: 0, x: 0, y: 40 }}
				initial={{ opacity: 0, x: 0, y: 40 }}
				role="dialog"
				transition={{ duration: 0.24, ease: "easeOut" }}
			>
				<div className="flex h-dvh max-h-dvh flex-col rounded-t-[1.75rem] border border-border bg-bg shadow-[0_24px_60px_rgba(10,10,10,0.12)] lg:sticky lg:top-6 lg:h-auto lg:max-h-[calc(100dvh-3rem)] lg:rounded-[1.75rem] lg:shadow-[0_24px_60px_rgba(10,10,10,0.05)]">
					<div className="flex justify-center pt-3 lg:hidden">
						<span className="h-1 w-12 rounded-full bg-border" />
					</div>

					<div className="flex items-start justify-between gap-4 border-border border-b px-5 pt-4 pb-5 lg:px-6 lg:pt-6">
						<div>
							<h2 className="font-serif text-3xl">{title}</h2>
							{description ? (
								<p className="mt-2 max-w-sm text-sm text-text-secondary">
									{description}
								</p>
							) : null}
						</div>
						<button
							className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
							disabled={!canClose}
							onClick={onClose}
							type="button"
						>
							Close
						</button>
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] lg:px-6 lg:pb-6">
						<div className="space-y-5">{children}</div>
					</div>
				</div>
			</motion.aside>
		</motion.div>
	);
}
