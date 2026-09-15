"use client";

import type { FileTree as TreeModel } from "@pierre/trees";
import { FileTree, useFileTree } from "@pierre/trees/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useDocumentTheme } from "@/components/use-document-theme";
import { buildHref } from "@/lib/repo-path";

interface Item {
	path: string;
	type: "dir" | "file";
}

// Route navigation can recreate the viewer. Restore open folders on the first
// render, before the next file's response arrives, rather than reopening later.
const expandedTrees = new Map<string, string[]>();

function rememberExpansion(key: string, model: TreeModel, items: Item[]) {
	const expanded = items.flatMap((item) => {
		if (item.type !== "dir") return [];
		const handle = model.getItem(item.path);
		return handle && "isExpanded" in handle && handle.isExpanded()
			? [item.path]
			: [];
	});
	expandedTrees.delete(key);
	expandedTrees.set(key, expanded);
	if (expandedTrees.size > 32) {
		const oldest = expandedTrees.keys().next().value;
		if (oldest !== undefined) expandedTrees.delete(oldest);
	}
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
	const treeKey = JSON.stringify([shareId, owner, repo, refName]);
	const modelRef = React.useRef<TreeModel | null>(null);
	const files = React.useMemo(
		() =>
			new Set(
				items.filter((item) => item.type === "file").map((item) => item.path),
			),
		[items],
	);
	const paths = React.useMemo(
		() =>
			items.map((item) => (item.type === "dir" ? `${item.path}/` : item.path)),
		[items],
	);
	const navigateToSelection = React.useCallback(
		(selectedPaths: readonly string[]) => {
			const selected = selectedPaths.at(-1);
			if (!selected) return;
			if (!files.has(selected)) return;
			if (selected === activePath) return;
			if (modelRef.current) rememberExpansion(treeKey, modelRef.current, items);
			onPrefetchPath?.(selected);
			router.push(buildHref(owner, repo, "blob", refName, selected, shareId), {
				scroll: false,
			});
		},
		[
			activePath,
			files,
			items,
			onPrefetchPath,
			owner,
			refName,
			repo,
			router,
			shareId,
			treeKey,
		],
	);
	// Pierre creates its model once and retains the initial callback.
	const selectionHandler = React.useRef(navigateToSelection);
	const syncingSelection = React.useRef(false);
	React.useLayoutEffect(() => {
		selectionHandler.current = navigateToSelection;
	}, [navigateToSelection]);
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
		initialExpandedPaths: expandedTrees.get(treeKey) ?? ancestorsOf(activePath),
		initialSelectedPaths: activePath ? [activePath] : [],
		icons: "minimal",
		search: true,
		fileTreeSearchMode: "hide-non-matches",
		onSelectionChange: (selected) => {
			if (!syncingSelection.current) selectionHandler.current(selected);
		},
	});
	React.useLayoutEffect(() => {
		modelRef.current = model;
		return () => rememberExpansion(treeKey, model, items);
	}, [items, model, treeKey]);
	const modelPaths = React.useRef(paths);
	const modelKey = React.useRef(treeKey);
	React.useLayoutEffect(() => {
		syncingSelection.current = true;
		try {
			if (modelPaths.current !== paths || modelKey.current !== treeKey) {
				if (modelKey.current === treeKey)
					rememberExpansion(treeKey, model, items);
				model.resetPaths(paths, {
					initialExpandedPaths: expandedTrees.get(treeKey),
				});
				modelPaths.current = paths;
				modelKey.current = treeKey;
			}
			for (const selected of model.getSelectedPaths()) {
				if (selected !== activePath) model.getItem(selected)?.deselect();
			}
			for (const ancestor of ancestorsOf(activePath)) {
				const item = model.getItem(ancestor);
				if (item && "expand" in item) item.expand();
			}
			model.getItem(activePath)?.select();
		} finally {
			syncingSelection.current = false;
		}
	}, [activePath, items, model, paths, treeKey]);
	return (
		<FileTree
			model={model}
			className="pierre-tree"
			onPointerOver={prefetchHoveredFile}
			style={{ colorScheme: theme }}
		/>
	);
}
