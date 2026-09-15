"use client";

import { getFiletypeFromFileName, preloadHighlighter } from "@pierre/diffs";
import { File } from "@pierre/diffs/react";
import * as React from "react";
import { useDocumentTheme } from "@/components/use-document-theme";

const CODE_THEMES = { light: "github-light", dark: "github-dark" } as const;

export function preloadPierreFile(name: string): Promise<void> {
	return preloadHighlighter({
		themes: [CODE_THEMES.light, CODE_THEMES.dark],
		langs: [getFiletypeFromFileName(name)],
	});
}

export function PierreFile({
	name,
	contents,
	wrap,
}: {
	name: string;
	contents: string;
	wrap: boolean;
}) {
	const themeType = useDocumentTheme();
	const file = React.useMemo(() => ({ name, contents }), [name, contents]);
	const options = React.useMemo(
		() => ({
			theme: CODE_THEMES,
			themeType,
			overflow: wrap ? ("wrap" as const) : ("scroll" as const),
			unsafeCSS: "[data-diffs-header] { display: none !important; }",
		}),
		[wrap, themeType],
	);

	return (
		<div className="pierre-file">
			<File file={file} options={options} style={{ colorScheme: themeType }} />
		</div>
	);
}
