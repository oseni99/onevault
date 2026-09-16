// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const createShare = vi.hoisted(() =>
	vi.fn(async () => "K7mQ2xV9pR4nT8wB123456"),
);
vi.mock("@/lib/session", () => ({
	getSession: async () => ({ login: "oseni99", installationIds: [1] }),
}));
vi.mock("@/lib/github-app", () => ({
	listInstallationRepos: async () => [
		{ owner: "organization", name: "private" },
	],
	getInstallationOctokit: () => ({}),
}));
vi.mock("@/lib/github-repo", () => ({ listBranches: async () => ["main"] }));
vi.mock("@/lib/share-store", () => ({
	createShare,
	deleteShare: vi.fn(),
	resolveShare: vi.fn(),
	updateShareSettings: vi.fn(),
	updateShareTtl: vi.fn(),
}));

import { POST } from "./route";

describe("share creation URLs", () => {
	it("uses the authenticated username for organization repositories", async () => {
		const response = await POST(
			new Request("https://example.com/api/share", {
				method: "POST",
				body: JSON.stringify({
					installationId: 1,
					owner: "organization",
					repo: "private",
					shareUsername: "spoofed",
				}),
			}),
		);
		expect(await response.json()).toEqual({
			id: "K7mQ2xV9pR4nT8wB123456",
			url: "https://example.com/oseni99/K7mQ2xV9pR4nT8wB123456",
		});
		expect(createShare).toHaveBeenCalledWith(
			expect.objectContaining({
				shareUsername: "oseni99",
				owner: "organization",
				repo: "private",
			}),
			null,
		);
	});
});
