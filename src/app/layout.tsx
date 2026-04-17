import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import { ThemeProvider } from "~/lib/theme";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
	title: "Remit",
	description: "Tuition payments, settled in under a second",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

const instrumentSerif = Instrument_Serif({
	subsets: ["latin"],
	weight: "400",
	variable: "--font-instrument-serif",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html
			className={`${geist.variable} ${instrumentSerif.variable}`}
			lang="en"
			suppressHydrationWarning
		>
			<body className="font-sans">
				<ThemeProvider>
					<TRPCReactProvider>{children}</TRPCReactProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
