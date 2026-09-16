// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	checkBotId: vi.fn(),
	resolveViewer: vi.fn(),
	resolveViewerPath: vi.fn(),
	recordShareView: vi.fn(),
	after: vi.fn(),
}));

vi.mock("botid/server", () => ({ checkBotId: mocks.checkBotId }));
vi.mock("@/lib/viewer-data", () => ({
	resolveViewer: mocks.resolveViewer,
	resolveViewerPath: mocks.resolveViewerPath,
}));
vi.mock("@/lib/share-store", () => ({
	recordShareView: mocks.recordShareView,
}));
vi.mock("next/server", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/server")>()),
	after: mocks.after,
}));

import { POST } from "./route";

function request(extra: Record<string, unknown> = {}) {
	return new Request("http://localhost/api/view", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			shareId: "share-1",
			slug: ["owner", "repo"],
			trackView: true,
			...extra,
		}),
	});
}

describe("viewer open tracking", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.checkBotId.mockResolvedValue({ isBot: false });
		mocks.resolveViewer.mockResolvedValue({ kind: "view" });
		mocks.recordShareView.mockResolvedValue(undefined);
	});
	afterEach(() => vi.restoreAllMocks());

	it.each(["view", "releases"])(
		"tracks a successful %s after responding",
		async (kind) => {
			mocks.resolveViewer.mockResolvedValue({ kind });
			const response = await POST(request());
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ kind });
			expect(mocks.after).toHaveBeenCalledOnce();
			expect(mocks.recordShareView).not.toHaveBeenCalled();
			await mocks.after.mock.calls[0][0]();
			expect(mocks.recordShareView).toHaveBeenCalledExactlyOnceWith("share-1");
		},
	);

	it.each([false, undefined, "true"])(
		"does not track when trackView is %s",
		async (trackView) => {
			await POST(request({ trackView }));
			expect(mocks.after).not.toHaveBeenCalled();
		},
	);

	it.each(["notice", "redirect"])(
		"does not count a %s response",
		async (kind) => {
			mocks.resolveViewer.mockResolvedValue({ kind });
			await POST(request());
			expect(mocks.after).not.toHaveBeenCalled();
		},
	);

	it("does not count file navigation or prefetch requests", async () => {
		mocks.resolveViewerPath.mockResolvedValue({ kind: "path" });
		await POST(
			request({
				operation: "path",
				owner: "owner",
				repo: "repo",
				ref: "main",
				path: "a.ts",
			}),
		);
		expect(mocks.resolveViewerPath).toHaveBeenCalledOnce();
		expect(mocks.resolveViewer).not.toHaveBeenCalled();
		expect(mocks.after).not.toHaveBeenCalled();
	});

	it("blocks bots before resolving or tracking a link", async () => {
		mocks.checkBotId.mockResolvedValue({ isBot: true });
		expect((await POST(request())).status).toBe(403);
		expect(mocks.resolveViewer).not.toHaveBeenCalled();
		expect(mocks.after).not.toHaveBeenCalled();
	});

	it("does not count failed viewer requests", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		mocks.resolveViewer.mockRejectedValue(new Error("unavailable"));
		expect((await POST(request())).status).toBe(500);
		expect(mocks.after).not.toHaveBeenCalled();
	});

	it("keeps tracking failures from breaking successful responses", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		mocks.recordShareView.mockRejectedValue(new Error("Redis unavailable"));
		const response = await POST(request());
		await expect(mocks.after.mock.calls[0][0]()).resolves.toBeUndefined();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ kind: "view" });
	});
});
