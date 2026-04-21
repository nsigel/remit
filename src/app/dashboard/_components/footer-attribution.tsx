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
				src={isDark ? "/circle-logo-white.svg" : "/circle-logo-2021.svg"}
				alt="Circle"
				height={13}
				width={52}
				unoptimized
				className="block h-[13px] w-auto"
			/>
			<span className="inline-block h-3 w-px bg-border" />
			<Image
				src={isDark ? "/Arc_Full_Logo_White.svg" : "/Arc_Full_Logo_Navy.svg"}
				alt="Arc"
				height={11}
				width={44}
				unoptimized
				className="block h-[11px] w-auto"
			/>
			<span className="ml-1 text-[11px] text-text-secondary/60">
				Stablecoins &middot; CCTP v2 &middot; Arc Blockchain
			</span>
		</div>
	);
}
