import { describe, expect, it, vi } from "vitest";
import { createAsyncTtlCache } from "./async-ttl-cache";

describe("createAsyncTtlCache", () => {
	it("coalesces concurrent loads for the same key", async () => {
		let release: ((value: string) => void) | undefined;
		const pending = new Promise<string>((resolve) => {
			release = resolve;
		});
		const load = vi.fn(() => pending);
		const cache = createAsyncTtlCache<string>({ ttlMs: 1_000 });

		const first = cache.get("repo", load);
		const second = cache.get("repo", load);
		release?.("tree");

		await expect(Promise.all([first, second])).resolves.toEqual([
			"tree",
			"tree",
		]);
		expect(load).toHaveBeenCalledOnce();
	});

	it("does not retain a rejected load", async () => {
		const cache = createAsyncTtlCache<string>({ ttlMs: 1_000 });
		const failed = cache.get("repo", async () => {
			throw new Error("temporary failure");
		});

		await expect(failed).rejects.toThrow("temporary failure");
		await expect(cache.get("repo", async () => "recovered")).resolves.toBe(
			"recovered",
		);
	});
});
