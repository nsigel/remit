"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
	theme: Theme;
	toggle: () => void;
}>({
	theme: "light",
	toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setTheme] = useState<Theme>("light");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		const stored = localStorage.getItem("remit-theme") as Theme | null;
		setTheme(stored ?? "light");
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!mounted) return;
		document.documentElement.classList.toggle("dark", theme === "dark");
		localStorage.setItem("remit-theme", theme);
	}, [theme, mounted]);

	const toggle = useCallback(() => {
		setTheme((t) => (t === "light" ? "dark" : "light"));
	}, []);

	return (
		<ThemeContext.Provider value={{ theme, toggle }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	return useContext(ThemeContext);
}
