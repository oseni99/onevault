// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	resolveShare: vi.fn(),
	recordShareDownload: vi.fn(),
	after: vi.fn(),
	fetch: vi.fn(),
}));
vi.mock("@/lib/share-store", () => ({
	resolveShare: mocks.resolveShare,
	recordShareDownload: mocks.recordShareDownload,
}));
vi.mock("@/lib/github-app", () => ({
	getInstallationOctokit: () => ({}),
	getInstallationToken: async () => "test",
}));
vi.mock("@/lib/github-repo", () => ({
	getRepoMeta: async () => ({ defaultBranch: "main" }),
	listBranches: async () => ["main"],
	listReleases: async () => [{ tag: "v1", assets: [{ id: 7 }] }],
}));
vi.mock("next/server", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/server")>()),
	after: mocks.after,
}));

import { GET as releaseDownload } from "../release/download/route";
import { GET as sourceDownload } from "./route";

describe("download tracking", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubGlobal("fetch", mocks.fetch);
		mocks.resolveShare.mockResolvedValue({
			installationId: 1,
			owner: "o",
			repo: "r",
			allowDownload: true,
			showReleases: true,
		});
		mocks.fetch.mockResolvedValue(
			new Response(null, {
				status: 302,
				headers: { location: "https://github.com/download" },
			}),
		);
		mocks.recordShareDownload.mockResolvedValue(undefined);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	const cases = [
		{
			label: "source ZIP",
			handler: sourceDownload,
			query: "s=s1",
			kind: "source",
		},
		{
			label: "release asset",
			handler: releaseDownload,
			query: "s=s1&asset=7",
			kind: "release",
		},
		{
			label: "release archive",
			handler: releaseDownload,
			query: "s=s1&tag=v1",
			kind: "release",
		},
	];
	it.each(cases)(
		"counts a $label handoff after the response",
		async ({ handler, query, kind }) => {
			const response = await handler(
				new Request(`http://localhost/api/download?${query}`),
			);
			expect(response.status).toBe(302);
			expect(mocks.recordShareDownload).not.toHaveBeenCalled();
			expect(mocks.after).toHaveBeenCalledOnce();
			await mocks.after.mock.calls[0][0]();
			expect(mocks.recordShareDownload).toHaveBeenCalledExactlyOnceWith(
				"s1",
				kind,
			);
		},
	);
	it.each(cases)(
		"does not count a denied $label",
		async ({ handler, query }) => {
			mocks.resolveShare.mockResolvedValue({
				allowDownload: false,
				showReleases: false,
			});
			expect(
				(await handler(new Request(`http://localhost/api/download?${query}`)))
					.status,
			).toBe(403);
			expect(mocks.after).not.toHaveBeenCalled();
		},
	);
	it.each(cases)(
		"does not count an unsuccessful $label handoff",
		async ({ handler, query }) => {
			mocks.fetch.mockResolvedValue(
				new Response(null, {
					status: 500,
					headers: { location: "https://github.com/error" },
				}),
			);
			expect(
				(await handler(new Request(`http://localhost/api/download?${query}`)))
					.status,
			).toBe(502);
			expect(mocks.after).not.toHaveBeenCalled();
		},
	);
	it("does not break a download if metrics storage fails", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		mocks.recordShareDownload.mockRejectedValue(new Error("offline"));
		expect(
			(await sourceDownload(new Request("http://localhost/api/download?s=s1")))
				.status,
		).toBe(302);
		await expect(mocks.after.mock.calls[0][0]()).resolves.toBeUndefined();
	});
});
