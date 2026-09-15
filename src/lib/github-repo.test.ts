import type { Octokit } from "octokit";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("repository cache isolation", () => {
	afterEach(() => vi.resetModules());

	it("preserves case-sensitive refs and paths while normalizing repository names", async () => {
		const getContent = vi.fn(
			async ({ path, ref }: { path: string; ref: string }) => ({
				data: {
					type: "file",
					name: path,
					size: 1,
					content: Buffer.from(`${ref}:${path}`).toString("base64"),
				},
			}),
		);
		const octokit = { rest: { repos: { getContent } } } as unknown as Octokit;
		const { getContents } = await import("./github-repo");
		for (const [ref, path] of [
			["main", "A.ts"],
			["main", "a.ts"],
			["Main", "a.ts"],
		]) {
			expect(
				await getContents(octokit, "Owner", "Repo", path, ref),
			).toMatchObject({ text: `${ref}:${path}` });
		}
		await getContents(octokit, "owner", "repo", "A.ts", "main");
		expect(getContent).toHaveBeenCalledTimes(3);
	});

	it("does not reuse a tree from a differently cased branch", async () => {
		const getTree = vi.fn(async ({ tree_sha }: { tree_sha: string }) => ({
			data: {
				tree: [{ path: `${tree_sha}.ts`, type: "blob" }],
				truncated: false,
			},
		}));
		const octokit = { rest: { git: { getTree } } } as unknown as Octokit;
		const { getRepoTree } = await import("./github-repo");
		expect(await getRepoTree(octokit, "Owner", "Repo", "Main")).toMatchObject({
			items: [{ path: "Main.ts" }],
		});
		expect(await getRepoTree(octokit, "owner", "repo", "main")).toMatchObject({
			items: [{ path: "main.ts" }],
		});
		await getRepoTree(octokit, "owner", "repo", "Main");
		expect(getTree).toHaveBeenCalledTimes(2);
	});
});
