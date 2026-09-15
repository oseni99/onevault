"use client";

import * as React from "react";

export type DocumentTheme = "light" | "dark";

function currentTheme(): DocumentTheme {
	if (typeof document === "undefined") return "dark";
	return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function useDocumentTheme(): DocumentTheme {
	const [theme, setTheme] = React.useState<DocumentTheme>(currentTheme);

	React.useEffect(() => {
		const root = document.documentElement;
		const observer = new MutationObserver(() => setTheme(currentTheme()));
		observer.observe(root, {
			attributes: true,
			attributeFilter: ["data-theme"],
		});
		return () => observer.disconnect();
	}, []);

	return theme;
}
