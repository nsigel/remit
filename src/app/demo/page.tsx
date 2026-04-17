"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	SESSION_COOKIE_MAX_AGE,
	SESSION_COOKIE_NAME,
} from "~/lib/session-constants";
import { api } from "~/trpc/react";

export default function DemoPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [creating, setCreating] = useState(false);
	const [walletAddress, setWalletAddress] = useState<string | null>(null);

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
					<p className="mb-6 text-sm text-text-secondary">Live on Arc.</p>
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
				<h1 className="mb-8 text-center font-serif text-4xl">
					Create your Arc wallet
				</h1>
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
