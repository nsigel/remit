"use client";

import Image from "next/image";

export function BrandLockup() {
	return (
		<div className="flex items-center gap-3">
			<Image
				alt="USC"
				className="block h-auto w-[54px] sm:w-[64px]"
				height={48}
				src="/USC.png"
				unoptimized
				width={140}
			/>
			<span className="font-serif text-lg tracking-tight sm:text-xl">
				Remit
			</span>
		</div>
	);
}
