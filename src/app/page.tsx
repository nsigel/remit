import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "~/trpc/server";
import { ThemeToggle } from "./_components/theme-toggle";

export default async function Home() {
	const session = await api.student.getSession();
	if (session) redirect("/dashboard");

	return (
		<main className="flex min-h-dvh flex-col">
			<header className="flex items-center justify-between px-8 py-6">
				<span className="font-serif text-2xl">Remit</span>
				<div className="flex items-center gap-6">
					<Link
						className="cursor-pointer text-sm text-text-secondary transition-colors hover:text-text"
						href="/university"
					>
						University View
					</Link>
					<ThemeToggle />
				</div>
			</header>

			<div className="flex flex-1 flex-col items-center justify-center px-8 pb-24">
				<h1 className="max-w-4xl text-center font-serif text-5xl leading-tight sm:text-7xl">
					From any chain to final tuition payment in under a second
				</h1>

				<p className="mt-6 max-w-2xl text-center text-lg text-text-secondary">
					Bridge funds onto Arc, convert only what is needed, and settle tuition
					with deterministic finality.
				</p>

				<Link
					className="mt-10 cursor-pointer bg-text px-8 py-3 font-medium text-bg text-lg transition-opacity hover:opacity-90"
					href="/demo"
				>
					Start Student Demo
				</Link>

				<div className="mt-24 grid w-full max-w-3xl grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-16">
					<ProofPoint
						detail="0.25s finality"
						label="Settlement"
						support="Deterministic confirmation on Arc."
					/>
					<ProofPoint
						detail="27 supported chains"
						label="Funding Reach"
						support="Bring USDC in through Circle CCTP."
					/>
					<ProofPoint
						detail="0.1% spread"
						label="FX Cost"
						support="Convert only what the payment needs."
					/>
				</div>

				<p className="mt-24 text-center text-text-secondary text-xs">
					Built with Arc, Circle CCTP, StableFX, Gas Station, and smart
					accounts.
				</p>
			</div>
		</main>
	);
}

function ProofPoint({
	label,
	detail,
	support,
}: {
	label: string;
	detail: string;
	support: string;
}) {
	return (
		<div>
			<div className="mb-2 text-sm text-text-secondary">{label}</div>
			<div className="font-medium text-xl">{detail}</div>
			<div className="mt-1 text-sm text-text-secondary">{support}</div>
		</div>
	);
}
