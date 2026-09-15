import { fireEvent, render, screen } from "@testing-library/react";
import type { CSSProperties } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
	options: null as null | {
		paths: string[];
		onSelectionChange: (paths: readonly string[]) => void;
	},
	push: vi.fn(),
	prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: testState.push }),
}));

vi.mock("@pierre/trees/react", () => ({
	useFileTree: (options: typeof testState.options) => {
		testState.options = options;
		return { model: {} };
	},
	FileTree: ({
		className,
		style,
	}: {
		className: string;
		style: CSSProperties;
	}) => (
		<div className={className} style={style} data-testid="pierre-tree">
			<button
				type="button"
				onClick={() => testState.options?.onSelectionChange(["src/a.ts"])}
			>
				Open file
			</button>
			<button
				type="button"
				onClick={() => testState.options?.onSelectionChange(["src"])}
			>
				Select folder
			</button>
		</div>
	),
}));

import { RepoTree } from "./repo-tree";

const items = [
	{ path: "README.md", type: "file" as const },
	{ path: "src", type: "dir" as const },
	{ path: "src/a.ts", type: "file" as const },
];

function renderTree(activePath = "README.md") {
	return render(
		<RepoTree
			items={items}
			owner="o"
			repo="r"
			refName="main"
			shareId="s1"
			activePath={activePath}
			onPrefetchPath={testState.prefetch}
		/>,
	);
}

describe("RepoTree adapter", () => {
	beforeEach(() => {
		testState.options = null;
		testState.push.mockClear();
		testState.prefetch.mockClear();
	});

	it("gives Pierre explicit directory paths and ordinary file paths", () => {
		renderTree();
		expect(testState.options?.paths).toEqual(["README.md", "src/", "src/a.ts"]);
	});

	it("opens a selected file through the SourceVault share URL", () => {
		renderTree();
		fireEvent.click(screen.getByRole("button", { name: "Open file" }));
		expect(testState.prefetch).toHaveBeenCalledWith("src/a.ts");
		expect(testState.push).toHaveBeenCalledWith("/o/r/blob/main/src/a.ts?s=s1");
	});

	it("does not navigate when a directory is selected", () => {
		renderTree();
		fireEvent.click(screen.getByRole("button", { name: "Select folder" }));
		expect(testState.push).not.toHaveBeenCalled();
	});

	it("does not reload the currently active file", () => {
		renderTree("src/a.ts");
		fireEvent.click(screen.getByRole("button", { name: "Open file" }));
		expect(testState.push).not.toHaveBeenCalled();
	});
});
