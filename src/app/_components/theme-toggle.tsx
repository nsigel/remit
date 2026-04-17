"use client";

import { useTheme } from "~/lib/theme";

export function ThemeToggle() {
	const { theme, toggle } = useTheme();

	return (
		<button
			aria-label="Toggle theme"
			className="cursor-pointer text-sm text-text-secondary transition-colors hover:text-text"
			onClick={toggle}
			type="button"
		>
			{theme === "light" ? "Dark" : "Light"}
		</button>
	);
}
