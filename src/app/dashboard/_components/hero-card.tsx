"use client";

import Image from "next/image";
import { useTheme } from "~/lib/theme";

function StatItem({
	value,
	label,
	color,
}: {
	value: string;
	label: string;
	color: string;
}) {
	return (
		<div>
			<div
				className="font-serif text-2xl leading-none tracking-tight"
				style={{ color }}
			>
				{value}
			</div>
			<div className="mt-1 text-xs font-medium text-text-secondary">
				{label}
			</div>
		</div>
	);
}

function CoinStack({ coins }: { coins: string[] }) {
	return (
		<div className="flex items-center">
			{coins.map((src, i) => (
				<div
					className="flex h-[26px] w-[26px] items-center justify-center overflow-hidden rounded-full border-2 border-bg bg-bg"
					key={src}
					style={{
						marginLeft: i > 0 ? -8 : 0,
						boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
					}}
				>
					<Image
						alt=""
						className="block h-full w-full object-contain p-[3px]"
						height={26}
						src={src}
						unoptimized
						width={26}
					/>
				</div>
			))}
		</div>
	);
}

function JourneyNode({
	label,
	coins,
	right,
}: {
	label: string;
	coins: string[];
	right?: boolean;
}) {
	return (
		<div
			className="flex min-w-[80px] flex-col gap-1.5"
			style={{ alignItems: right ? "flex-end" : "flex-start" }}
		>
			<CoinStack coins={right ? [...coins].reverse() : coins} />
			<div className="text-sm font-semibold text-text">{label}</div>
		</div>
	);
}

function FlowArrow() {
	return (
		<div className="relative flex min-w-[40px] max-w-[72px] flex-1 items-center h-[2px]">
			<div
				className="flex-1 h-px"
				style={{
					background:
						"linear-gradient(90deg, var(--border), var(--accent), var(--border))",
				}}
			/>
			<div className="absolute right-0 text-accent text-xs leading-none">›</div>
			<div
				className="absolute top-1/2 -translate-y-1/2 h-[5px] w-[5px] rounded-full bg-accent"
				style={{
					animation: "travel 2.5s linear infinite",
				}}
			/>
			<style>{`@keyframes travel { 0%{left:0%} 100%{left:calc(100% - 5px)} }`}</style>
		</div>
	);
}

function CircleNodeHero() {
	return (
		<div className="flex flex-col items-center gap-1 shrink-0">
			<div className="flex h-[38px] w-[38px] items-center justify-center rounded-full border-[1.5px] border-accent bg-accent/8">
				<Image
					alt="Circle"
					height={22}
					src="/Circle_Icon.svg"
					unoptimized
					width={22}
				/>
			</div>
			<span className="text-[10px] font-semibold tracking-wide text-accent">
				StableFX
			</span>
		</div>
	);
}

export function HeroCard({
	fromCity,
	university,
}: {
	fromCity: string;
	university: string;
}) {
	const { theme } = useTheme();
	const isDark = theme === "dark";

	return (
		<div className="relative overflow-hidden rounded-[2rem] border border-border bg-bg-secondary">
			<div className="grid grid-cols-1 items-center gap-7 px-5 py-5 sm:grid-cols-[1fr_auto] sm:px-6 sm:py-5">
				{/* Temple background artifact */}
				<Image
					alt=""
					aria-hidden
					className="pointer-events-none absolute select-none"
					height={600}
					src="/temple.png"
					style={{
						right: -20,
						top: "50%",
						transform: "translateY(-50%)",
						height: "230%",
						width: "auto",
						opacity: isDark ? 0.08 : 0.13,
						filter: isDark ? "invert(1)" : "none",
						maskImage: "linear-gradient(to left, black 0%, transparent 55%)",
						WebkitMaskImage:
							"linear-gradient(to left, black 0%, transparent 55%)",
					}}
					unoptimized
					width={600}
				/>

				{/* Left: headline + stats + attribution */}
				<div className="relative z-10 flex min-w-0 flex-col">
					<h2 className="font-serif text-[clamp(24px,4vw,40px)] leading-[1.1] tracking-tight">
						Pay tuition instantly,
						<br />
						from anywhere in the world.
					</h2>

					<div className="mt-3.5 flex items-center">
						<StatItem color="var(--accent)" label="Settlement" value="< 10s" />
						<div className="mx-4 h-7 w-px shrink-0 bg-border" />
						<StatItem color="var(--success)" label="Wire fees" value="$0" />
						<div className="mx-4 h-7 w-px shrink-0 bg-border" />
						<StatItem color="var(--fg)" label="Chains" value="27+" />
					</div>

					<div className="mt-2.5 flex items-center gap-1.5">
						<span className="text-[11px] text-text-secondary/60">
							Powered by
						</span>
						<Image
							alt="Circle"
							className="block h-3 w-auto"
							height={12}
							src={isDark ? "/circle-logo-white.svg" : "/circle-logo-2021.svg"}
							unoptimized
							width={50}
						/>
						<span className="inline-block h-[9px] w-px bg-border" />
						<Image
							alt="Arc"
							className="block h-2.5 w-auto"
							height={10}
							src={
								isDark ? "/Arc_Full_Logo_White.svg" : "/Arc_Full_Logo_Navy.svg"
							}
							unoptimized
							width={40}
						/>
					</div>
				</div>

				{/* Right: journey diagram */}
				<div className="relative z-10 flex shrink-0 items-center gap-2.5 rounded-[1.35rem] border border-border bg-bg px-4 py-3.5 shadow-sm">
					<JourneyNode
						coins={["/eurc.svg", "/jpyc.svg", "/usdc.svg"]}
						label={fromCity}
					/>
					<FlowArrow />
					<CircleNodeHero />
					<FlowArrow />
					<JourneyNode
						coins={["/usdc.svg", "/USC_Trojans_logo.svg"]}
						label={university}
						right
					/>
				</div>
			</div>
		</div>
	);
}
