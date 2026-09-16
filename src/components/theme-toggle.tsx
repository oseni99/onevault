"use client";

import * as React from "react";

type Theme = "light" | "dark";

function preferredTheme(): Theme {
	const saved =
		window.localStorage.getItem("onelinkvault:theme") ??
		window.localStorage.getItem("sourcevault:theme");
	if (saved === "light" || saved === "dark") return saved;
	return window.matchMedia("(prefers-color-scheme: light)").matches
		? "light"
		: "dark";
}

export function ThemeToggle() {
	const [theme, setTheme] = React.useState<Theme | null>(null);

	React.useEffect(() => {
		const current =
			document.documentElement.dataset.theme === "light" ||
			document.documentElement.dataset.theme === "dark"
				? (document.documentElement.dataset.theme as Theme)
				: preferredTheme();
		document.documentElement.dataset.theme = current;
		setTheme(current);
	}, []);

	const toggle = () => {
		const next: Theme =
			document.documentElement.dataset.theme === "light" ? "dark" : "light";
		document.documentElement.dataset.theme = next;
		window.localStorage.setItem("onelinkvault:theme", next);
		setTheme(next);
	};

	const nextLabel = theme === "light" ? "dark" : "light";

	return (
		<button
			type="button"
			className="theme-toggle"
			onClick={toggle}
			aria-label={`Use ${nextLabel} theme`}
			title={`Use ${nextLabel} theme`}
		>
			{theme === "light" ? (
				<svg viewBox="0 0 16 16" aria-hidden="true">
					<path d="M6.15 1.02a.75.75 0 0 1 .83.95A5.25 5.25 0 0 0 14.03 9a.75.75 0 0 1 .95.83A7 7 0 1 1 6.15 1.02Z" />
				</svg>
			) : (
				<svg viewBox="0 0 16 16" aria-hidden="true">
					<path d="M8 0a.75.75 0 0 1 .75.75V2a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0Zm0 4.25A3.75 3.75 0 1 0 8 11.75 3.75 3.75 0 0 0 8 4.25ZM1.34 2.4a.75.75 0 0 1 1.06-1.06l.88.88a.75.75 0 1 1-1.06 1.06l-.88-.88ZM0 8a.75.75 0 0 1 .75-.75H2a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 8Zm1.34 5.6.88-.88a.75.75 0 1 1 1.06 1.06l-.88.88a.75.75 0 1 1-1.06-1.06ZM8 13.25a.75.75 0 0 1 .75.75v1.25a.75.75 0 0 1-1.5 0V14a.75.75 0 0 1 .75-.75Zm4.72.53a.75.75 0 0 1 0-1.06.75.75 0 0 1 1.06 0l.88.88a.75.75 0 0 1-1.06 1.06l-.88-.88ZM13.25 8A.75.75 0 0 1 14 7.25h1.25a.75.75 0 0 1 0 1.5H14a.75.75 0 0 1-.75-.75Zm-.53-4.72a.75.75 0 0 1 0-1.06l.88-.88a.75.75 0 1 1 1.06 1.06l-.88.88a.75.75 0 0 1-1.06 0Z" />
				</svg>
			)}
		</button>
	);
}
