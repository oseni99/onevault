import { afterEach, describe, expect, it, vi } from "vitest";

const pathRequest = {
	operation: "path" as const,
	shareId: "share-1",
	owner: "owner",
	repo: "repo",
	ref: "main",
	path: "src/a.ts",
};

const pathPayload = {
	kind: "path" as const,
	refName: "main",
	path: "src/a.ts",
	crumbs: ["src", "a.ts"],
	contents: {
		kind: "file" as const,
		name: "a.ts",
		text: "export {};",
		isBinary: false,
		size: 10,
	},
	mdHtml: null,
};

describe("viewer client cache", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
		vi.resetModules();
	});

	it("coalesces a prefetch and navigation for the same path", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			status: 200,
			json: async () => pathPayload,
		}));
		vi.stubGlobal("fetch", fetchMock);
		const { loadViewerRequest } = await import("./viewer-client-cache");

		const prefetch = loadViewerRequest(pathRequest);
		const navigation = loadViewerRequest(pathRequest);

		await expect(Promise.all([prefetch, navigation])).resolves.toEqual([
			pathPayload,
			pathPayload,
		]);
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("keeps repository context only for the live-cache window", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		const { getViewerRepositoryContext, rememberViewerRepositoryContext } =
			await import("./viewer-client-cache");
		const payload = {
			kind: "view" as const,
			fullName: "owner/repo",
			refName: "main",
			owner: "owner",
			repo: "repo",
			shareId: "share-1",
			contents: pathPayload.contents,
			mdHtml: null,
			fullTree: [{ path: "src/a.ts", type: "file" as const }],
			sidebarEntries: [],
			crumbs: ["src", "a.ts"],
			path: "src/a.ts",
			branches: null,
			showReleases: false,
			allowDownload: false,
		};

		rememberViewerRepositoryContext(payload);
		expect(getViewerRepositoryContext("share-1")).toBe(payload);

		vi.advanceTimersByTime(120_001);
		expect(getViewerRepositoryContext("share-1")).toBe(payload);

		vi.advanceTimersByTime(180_000);
		expect(getViewerRepositoryContext("share-1")).toBeNull();
	});
});
