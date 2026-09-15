import type { FileTree as TreeModel } from "@pierre/trees";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
	model: null as TreeModel | null,
	push: vi.fn(),
	prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: testState.push }),
}));

// Keep the real hook/model: it deliberately ignores later option changes.
vi.mock("@pierre/trees/react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@pierre/trees/react")>()),
	FileTree: ({ model }: { model: TreeModel }) => {
		testState.model = model;
		return (
			<button type="button" onClick={() => model.getItem("src/a.ts")?.select()}>
				Open file
			</button>
		);
	},
}));

import { RepoTree } from "./repo-tree";

const items = [
	{ path: "README.md", type: "file" as const },
	{ path: "src", type: "dir" as const },
	{ path: "src/a.ts", type: "file" as const },
	{ path: "src/nested", type: "dir" as const },
	{ path: "src/nested/b.ts", type: "file" as const },
];
const props = {
	items,
	owner: "o",
	repo: "r",
	refName: "main",
	shareId: "s1",
	activePath: "README.md",
	onPrefetchPath: testState.prefetch,
};

describe("RepoTree adapter", () => {
	beforeEach(() => {
		testState.model = null;
		testState.push.mockClear();
		testState.prefetch.mockClear();
	});

	it("opens a selected file through the share URL", () => {
		render(<RepoTree {...props} />);
		fireEvent.click(screen.getByRole("button", { name: "Open file" }));
		expect(testState.prefetch).toHaveBeenCalledWith("src/a.ts");
		expect(testState.push).toHaveBeenCalledWith(
			"/o/r/blob/main/src/a.ts?s=s1",
			{ scroll: false },
		);
	});

	it("can return to the initial file after navigation", () => {
		const view = render(<RepoTree {...props} />);
		const model = testState.model;
		fireEvent.click(screen.getByRole("button", { name: "Open file" }));
		view.rerender(<RepoTree {...props} activePath="src/a.ts" />);
		expect(testState.model).toBe(model);
		act(() => model?.getItem("README.md")?.select());
		expect(testState.push).toHaveBeenLastCalledWith(
			"/o/r/blob/main/README.md?s=s1",
			{ scroll: false },
		);
		expect(testState.push).toHaveBeenCalledTimes(2);
	});

	it("syncs external navigation and reveals ancestors without navigating again", () => {
		const view = render(<RepoTree {...props} />);
		view.rerender(<RepoTree {...props} activePath="src/nested/b.ts" />);
		expect(testState.model?.getSelectedPaths()).toEqual(["src/nested/b.ts"]);
		const folder = testState.model?.getItem("src/nested");
		expect(folder && "isExpanded" in folder && folder.isExpanded()).toBe(true);
		expect(testState.push).not.toHaveBeenCalled();
		expect(testState.prefetch).not.toHaveBeenCalled();
	});

	it("uses updated repository context and tree paths", () => {
		const view = render(<RepoTree {...props} />);
		view.rerender(
			<RepoTree
				{...props}
				refName="release"
				shareId="s2"
				items={[{ path: "new.ts", type: "file" }]}
				activePath=""
			/>,
		);
		expect(testState.model?.getItem("README.md")).toBeNull();
		act(() => testState.model?.getItem("new.ts")?.select());
		expect(testState.push).toHaveBeenLastCalledWith(
			"/o/r/blob/release/new.ts?s=s2",
			{ scroll: false },
		);
	});

	it("does not prefetch descendants or navigate when a folder is selected", () => {
		render(<RepoTree {...props} />);
		act(() => testState.model?.getItem("src")?.select());
		expect(testState.push).not.toHaveBeenCalled();
		expect(testState.prefetch).not.toHaveBeenCalled();
	});

	it("does not reload the currently active file", () => {
		render(<RepoTree {...props} activePath="src/a.ts" />);
		fireEvent.click(screen.getByRole("button", { name: "Open file" }));
		expect(testState.push).not.toHaveBeenCalled();
	});

	it("restores open folders when navigation recreates the tree before file data arrives", () => {
		const navigationProps = { ...props, shareId: "expansion-navigation" };
		const view = render(<RepoTree {...navigationProps} />);
		act(() => {
			const folder = testState.model?.getItem("src");
			if (folder && "expand" in folder) folder.expand();
			testState.model?.getItem("src/a.ts")?.select();
		});
		// The new route initially has the cached README payload, not a.ts yet.
		// Mount before old cleanup to verify expansion was saved before navigation.
		const next = render(<RepoTree {...navigationProps} />);
		const folder = testState.model?.getItem("src");
		expect(folder && "isExpanded" in folder && folder.isExpanded()).toBe(true);
		view.unmount();
		next.unmount();
	});

	it("preserves open folders when an equivalent tree array is received", () => {
		const view = render(<RepoTree {...props} shareId="expansion-refresh" />);
		act(() => {
			const folder = testState.model?.getItem("src");
			if (folder && "expand" in folder) folder.expand();
		});
		view.rerender(
			<RepoTree {...props} shareId="expansion-refresh" items={[...items]} />,
		);
		const folder = testState.model?.getItem("src");
		expect(folder && "isExpanded" in folder && folder.isExpanded()).toBe(true);
	});

	it("keeps saved expansion separate between branches", () => {
		const view = render(<RepoTree {...props} shareId="expansion-branches" />);
		act(() => {
			const folder = testState.model?.getItem("src");
			if (folder && "expand" in folder) folder.expand();
			testState.model?.getItem("src/a.ts")?.select();
		});
		view.rerender(
			<RepoTree {...props} shareId="expansion-branches" refName="other" />,
		);
		const folder = testState.model?.getItem("src");
		expect(folder && "isExpanded" in folder && folder.isExpanded()).toBe(false);
	});
});
