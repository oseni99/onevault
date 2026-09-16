import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	resolveShare: vi.fn(),
	getContents: vi.fn(),
	getRepoMeta: vi.fn(),
}));
vi.mock("@/lib/share-store", () => ({ resolveShare: mocks.resolveShare }));
vi.mock("@/lib/github-app", () => ({ getInstallationOctokit: () => ({}) }));
vi.mock("@/lib/github-repo", () => ({
	getRepoMeta: mocks.getRepoMeta,
	getContents: mocks.getContents,
	getRepoTree: async () => null,
	listBranches: async () => ["main"],
	listReleases: async () => [],
}));
vi.mock("@/lib/markdown", () => ({
	isMarkdown: (name: string) => name.endsWith(".md"),
	renderMarkdown: () => "",
}));
vi.mock("@/lib/markdown-github", () => ({
	renderMarkdownGitHub: async () => "",
}));

import { resolveViewer } from "./viewer-data";

const code = "K7mQ2xV9pR4nT8wB123456";
describe("personal share resolution", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.resolveShare.mockResolvedValue({
			shareUsername: "oseni99",
			owner: "organization",
			repo: "private-repo",
			installationId: 1,
			showReleases: true,
		});
		mocks.getRepoMeta.mockResolvedValue({
			fullName: "organization/private-repo",
			defaultBranch: "main",
		});
		mocks.getContents.mockResolvedValue({ kind: "dir", entries: [] });
	});
	it("looks up the repository from the code rather than the public username", async () => {
		const payload = await resolveViewer(["oseni99", code], code);
		expect(payload).toMatchObject({
			kind: "view",
			owner: "organization",
			repo: "private-repo",
			shareUsername: "oseni99",
		});
		expect(mocks.getRepoMeta).toHaveBeenCalledWith(
			{},
			"organization",
			"private-repo",
		);
	});
	it("rejects a code paired with a different username", async () => {
		expect(await resolveViewer(["someone-else", code], code)).toMatchObject({
			kind: "notice",
		});
		expect(mocks.getRepoMeta).not.toHaveBeenCalled();
	});
	it("rejects a mismatched body code and old repository URLs", async () => {
		await resolveViewer(["oseni99", "other"], code);
		await resolveViewer(["oseni99", "private-repo"], "old-uuid");
		expect(mocks.resolveShare).not.toHaveBeenCalled();
	});
	it("keeps README redirects under the sharing username and code", async () => {
		mocks.getContents.mockResolvedValue({
			kind: "dir",
			entries: [{ name: "README.md", path: "README.md", type: "file" }],
		});
		expect(await resolveViewer(["oseni99", code], code)).toEqual({
			kind: "redirect",
			href: `/oseni99/${code}/blob/main/README.md`,
		});
	});
	it("opens releases under the same personal URL", async () => {
		expect(
			await resolveViewer(["oseni99", code, "releases"], code),
		).toMatchObject({
			kind: "releases",
			shareUsername: "oseni99",
			owner: "organization",
		});
	});
});
