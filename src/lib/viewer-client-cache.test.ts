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

	it("sends the view-tracking flag only with bootstrap requests", async () => {
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) => ({
				ok: true,
				status: 200,
				json: async () => pathPayload,
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const { loadViewerRequest } = await import("./viewer-client-cache");

		await loadViewerRequest({
			operation: "bootstrap",
			slug: ["owner", "repo"],
			shareId: "share-bootstrap",
			trackView: true,
		});
		await loadViewerRequest(pathRequest);

		expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
			slug: ["owner", "repo"],
			shareId: "share-bootstrap",
			trackView: true,
		});
		expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual(
			pathRequest,
		);
	});

	it("coalesces a prefetch and navigation for the same path", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			status: 200,
			json: async () => pathPayload,
		}));
		vi.stubGlobal("fetch", fetchMock);
		const { loadViewerRequest, prefetchViewerPath } = await import(
			"./viewer-client-cache"
		);

		prefetchViewerPath(pathRequest);
		const navigation = loadViewerRequest(pathRequest);

		await expect(navigation).resolves.toEqual(pathPayload);
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("limits speculative requests while allowing immediate navigation", async () => {
		let finish!: () => void;
		const pending = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const fetchMock = vi.fn(async () => {
			await pending;
			return { ok: true, status: 200, json: async () => pathPayload };
		});
		vi.stubGlobal("fetch", fetchMock);
		const { loadViewerRequest, prefetchViewerPath } = await import(
			"./viewer-client-cache"
		);
		prefetchViewerPath(pathRequest);
		prefetchViewerPath(pathRequest);
		for (let index = 0; index < 1000; index += 1) {
			prefetchViewerPath({ ...pathRequest, path: `file-${index}.ts` });
		}
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const navigation = loadViewerRequest({
			...pathRequest,
			path: "clicked.ts",
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
		finish();
		await navigation;
		// Let speculative completion release its slots.
		await new Promise((resolve) => setTimeout(resolve, 0));
		prefetchViewerPath({ ...pathRequest, path: "later.ts" });
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it("releases prefetch slots after failures so navigation can retry", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
		vi.stubGlobal("fetch", fetchMock);
		const { loadViewerRequest, prefetchViewerPath } = await import(
			"./viewer-client-cache"
		);
		prefetchViewerPath(pathRequest);
		prefetchViewerPath({ ...pathRequest, path: "b.ts" });
		await new Promise((resolve) => setTimeout(resolve, 0));
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => pathPayload,
		});
		prefetchViewerPath(pathRequest);
		await expect(loadViewerRequest(pathRequest)).resolves.toEqual(pathPayload);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("keeps repository context only for the live-cache window", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		const { getViewerRepositoryContext, rememberViewerRepositoryContext } =
			await import("./viewer-client-cache");
		const payload = {
			kind: "view" as const,
			shareUsername: "owner",
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
