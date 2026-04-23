"use client";

import Image from "next/image";
import { useTheme } from "~/lib/theme";

export function FooterAttribution() {
	const { theme } = useTheme();
	const isDark = theme === "dark";

	return (
		<div className="flex flex-wrap items-center gap-3">
			<span className="text-[11px] text-text-secondary/60">Powered by</span>
			<Image
				alt="Circle"
				className="block h-[13px] w-auto"
				height={13}
				src={isDark ? "/circle-logo-white.svg" : "/circle-logo-2021.svg"}
				unoptimized
				width={52}
			/>
			<span className="inline-block h-3 w-px bg-border" />
			<Image
				alt="Arc"
				className="block h-[11px] w-auto"
				height={11}
				src={isDark ? "/Arc_Full_Logo_White.svg" : "/Arc_Full_Logo_Navy.svg"}
				unoptimized
				width={44}
			/>
			<span className="ml-1 text-[11px] text-text-secondary/60">
				Stablecoins &middot; CCTP v2 &middot; Arc Blockchain
			</span>
		</div>
	);
}
