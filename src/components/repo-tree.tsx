"use client";

import { FileTree, useFileTree } from "@pierre/trees/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useDocumentTheme } from "@/components/use-document-theme";
import { buildHref } from "@/lib/repo-path";

interface Item {
	path: string;
	type: "dir" | "file";
}

function ancestorsOf(path: string): string[] {
	const parts = path.split("/");
	const ancestors: string[] = [];
	for (let index = 1; index < parts.length; index += 1) {
		ancestors.push(parts.slice(0, index).join("/"));
	}
	return ancestors;
}

export function RepoTree({
	items,
	owner,
	repo,
	refName,
	shareId,
	activePath,
	onPrefetchPath,
}: {
	items: Item[];
	owner: string;
	repo: string;
	refName: string;
	shareId: string;
	activePath: string;
	onPrefetchPath?: (path: string) => void;
}) {
	const router = useRouter();
	const theme = useDocumentTheme();
	const files = React.useMemo(
		() =>
			new Set(
				items.filter((item) => item.type === "file").map((item) => item.path),
			),
		[items],
	);
	const filesByFolder = React.useMemo(() => {
		const folders = new Map<string, string[]>();
		for (const path of files) {
			const parts = path.split("/");
			for (let depth = 1; depth < parts.length; depth += 1) {
				const folder = parts.slice(0, depth).join("/");
				const children = folders.get(folder);
				if (children) children.push(path);
				else folders.set(folder, [path]);
			}
		}
		return folders;
	}, [files]);
	const paths = React.useMemo(
		() =>
			items.map((item) => (item.type === "dir" ? `${item.path}/` : item.path)),
		[items],
	);
	const navigateToSelection = React.useCallback(
		(selectedPaths: readonly string[]) => {
			const selected = selectedPaths.at(-1);
			if (!selected) return;
			if (!files.has(selected)) {
				for (const child of filesByFolder.get(selected) ?? []) {
					onPrefetchPath?.(child);
				}
				return;
			}
			if (selected === activePath) return;
			onPrefetchPath?.(selected);
			router.push(buildHref(owner, repo, "blob", refName, selected, shareId), {
				scroll: false,
			});
		},
		[
			activePath,
			files,
			filesByFolder,
			onPrefetchPath,
			owner,
			refName,
			repo,
			router,
			shareId,
		],
	);
	const prefetchHoveredFile = React.useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			for (const target of event.nativeEvent.composedPath()) {
				if (!(target instanceof HTMLElement)) continue;
				if (target.dataset.itemType !== "file") continue;
				const path = target.dataset.itemPath;
				if (path && files.has(path)) onPrefetchPath?.(path);
				return;
			}
		},
		[files, onPrefetchPath],
	);
	const { model } = useFileTree({
		paths,
		flattenEmptyDirectories: true,
		initialExpansion: "closed",
		initialExpandedPaths: ancestorsOf(activePath),
		initialSelectedPaths: activePath ? [activePath] : [],
		icons: "minimal",
		search: true,
		fileTreeSearchMode: "hide-non-matches",
		onSelectionChange: navigateToSelection,
	});
	return (
		<FileTree
			model={model}
			className="pierre-tree"
			onPointerOver={prefetchHoveredFile}
			style={{ colorScheme: theme }}
		/>
	);
}
