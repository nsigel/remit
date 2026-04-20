"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	SESSION_COOKIE_MAX_AGE,
	SESSION_COOKIE_NAME,
} from "~/lib/session-constants";
import { useTheme } from "~/lib/theme";
import { api } from "~/trpc/react";

export default function DemoPage() {
	const router = useRouter();
	const { theme } = useTheme();
	const [name, setName] = useState("");
	const [creating, setCreating] = useState(false);
	const [walletAddress, setWalletAddress] = useState<string | null>(null);
	const arcIconSrc =
		theme === "dark" ? "/Arc_Icon_White.svg" : "/Arc_Icon_Navay.svg";

	const createStudent = api.student.create.useMutation({
		onSuccess: (data) => {
			// biome-ignore lint/suspicious/noDocumentCookie: The demo needs a browser-visible cookie because the current tRPC response path is not persisting the server-side cookie.
			document.cookie = `${SESSION_COOKIE_NAME}=${data.student.sessionToken}; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}; SameSite=Lax`;
			setWalletAddress(data.student.walletAddress);
			// Brief pause to show wallet creation, then redirect
			setTimeout(() => router.push("/dashboard"), 1500);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		setCreating(true);
		createStudent.mutate({ name: name.trim() });
	};

	if (walletAddress) {
		return (
			<main className="flex min-h-dvh flex-col items-center justify-center px-8">
				<div className="max-w-md text-center">
					<div className="mb-4 text-4xl text-success">&#10003;</div>
					<h1 className="mb-2 font-serif text-3xl">Wallet ready</h1>
					<p className="mb-6 text-sm text-text-secondary">
						Remit wallet live on Arc network.
					</p>
					<p className="break-all text-sm text-text-secondary">
						{walletAddress}
					</p>
				</div>
			</main>
		);
	}

	return (
		<main className="flex min-h-dvh flex-col items-center justify-center px-8">
			<div className="w-full max-w-sm">
				<div className="mb-8 text-center">
					<h1 className="font-serif text-4xl">
						<span className="inline-flex items-center gap-2">
							Create your Remit wallet
							<Image
								alt=""
								aria-hidden
								className="shrink-0"
								height={18}
								src={arcIconSrc}
								unoptimized
								width={18}
							/>
						</span>
					</h1>
					<p className="mt-2 text-sm text-text-secondary">
						Powered by Arc network.
					</p>
				</div>
				<form onSubmit={handleSubmit}>
					<label
						className="mb-2 block text-sm text-text-secondary"
						htmlFor="name"
					>
						Student name
					</label>
					<input
						className="w-full border border-border bg-bg px-4 py-3 text-lg outline-none transition-colors focus:border-text"
						disabled={creating}
						id="name"
						onChange={(e) => setName(e.target.value)}
						placeholder="Alex Johnson"
						type="text"
						value={name}
					/>
					<button
						className="mt-4 w-full cursor-pointer bg-text py-3 font-medium text-bg text-lg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
						disabled={!name.trim() || creating}
						type="submit"
					>
						{creating ? "Creating wallet..." : "Create wallet"}
					</button>
				</form>
			</div>
		</main>
	);
}
