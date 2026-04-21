import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import { DemoSessionProvider } from "~/lib/demo-session";
import { ThemeProvider } from "~/lib/theme";

export const metadata: Metadata = {
	title: "Remit",
	description: "Tuition payments, settled in under a second",
	icons: [{ rel: "icon", type: "image/svg+xml", url: "/favicon.svg" }],
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
					<DemoSessionProvider>{children}</DemoSessionProvider>
					<Toaster
						position="top-center"
						richColors
						toastOptions={{
							classNames: {
								toast: "rounded-full px-3.5 py-2 text-sm shadow-sm",
								title: "text-[0.82rem]",
							},
						}}
						visibleToasts={1}
					/>
				</ThemeProvider>
			</body>
		</html>
	);
}
