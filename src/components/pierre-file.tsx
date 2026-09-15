"use client";

import { File } from "@pierre/diffs/react";
import * as React from "react";
import { useDocumentTheme } from "@/components/use-document-theme";

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
			overflow: wrap ? ("wrap" as const) : ("scroll" as const),
			unsafeCSS: "[data-diffs-header] { display: none !important; }",
		}),
		[wrap],
	);

	return (
		<div className="pierre-file">
			<File file={file} options={options} style={{ colorScheme: themeType }} />
		</div>
	);
}
