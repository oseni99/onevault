// @vitest-environment node
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({
	command: (_args: string[]): unknown => undefined,
}));

// Execute the production Lua script in real Redis; mock only the HTTP transport.
vi.mock("@upstash/redis", () => ({
	Redis: class {
		async set(key: string, value: unknown, options?: { ex: number }) {
			return transport.command([
				"SET",
				key,
				JSON.stringify(value),
				...(options ? ["EX", String(options.ex)] : []),
			]);
		}
		async sadd(key: string, member: string) {
			return transport.command(["SADD", key, member]);
		}
		async eval(script: string, keys: string[], args: unknown[]) {
			return transport.command([
				"EVAL",
				script,
				String(keys.length),
				...keys,
				...args.map(String),
			]);
		}
		async get(key: string) {
			const value = transport.command(["GET", key]);
			return typeof value === "string" ? JSON.parse(value) : value;
		}
		async del(...keys: string[]) {
			return transport.command(["DEL", ...keys]);
		}
		async srem(key: string, member: string) {
			return transport.command(["SREM", key, member]);
		}
		async smembers(key: string) {
			return transport.command(["SMEMBERS", key]);
		}
		async hgetall(key: string) {
			return transport.command(["HGETALL", key]);
		}
		multi() {
			const commands: string[][] = [];
			const transaction = {
				set(key: string, value: unknown, options?: { ex: number }) {
					commands.push([
						"SET",
						key,
						JSON.stringify(value),
						...(options ? ["EX", String(options.ex)] : []),
					]);
					return transaction;
				},
				expire(key: string, seconds: number) {
					commands.push(["EXPIRE", key, String(seconds)]);
					return transaction;
				},
				persist(key: string) {
					commands.push(["PERSIST", key]);
					return transaction;
				},
				async exec() {
					return transport.command([
						"EVAL",
						"for _, command in ipairs(cjson.decode(ARGV[1])) do redis.call(unpack(command)) end return 1",
						"0",
						JSON.stringify(commands),
					]);
				},
			};
			return transaction;
		}
	},
}));

import {
	createShare,
	deleteShare,
	listSharesForInstallation,
	recordShareDownload,
	recordShareView,
	updateShareTtl,
} from "./share-store";

function hasRedis(): boolean {
	try {
		execFileSync("redis-server", ["--version"], { stdio: "ignore" });
		execFileSync("redis-cli", ["--version"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

// Requires redis-server and redis-cli on PATH. No production database is used.
describe.skipIf(!hasRedis())("share view retention (real Redis)", () => {
	let directory: string;
	let server: ChildProcess;
	let stopped: Promise<void>;
	const command = (...args: string[]) => transport.command(args);
	const keys = (id: string) => [
		`share:${id}`,
		`share-views:${id}`,
		`share-last-viewed:${id}`,
	];

	beforeAll(async () => {
		vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.invalid");
		vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test");
		directory = await mkdtemp(join(tmpdir(), "share-retention-"));
		const socket = join(directory, "redis.sock");
		server = spawn("redis-server", [
			"--port",
			"0",
			"--unixsocket",
			socket,
			"--save",
			"",
			"--appendonly",
			"no",
			"--dir",
			directory,
		]);
		stopped = new Promise((resolve) => server.once("exit", () => resolve()));
		await new Promise<void>((resolve, reject) => {
			let output = "";
			server.once("error", reject);
			server.once("exit", (code) =>
				reject(new Error(`Redis exited: ${code}\n${output}`)),
			);
			server.stdout?.on("data", (data: Buffer) => {
				output += data.toString();
				if (output.toLowerCase().includes("ready to accept connections"))
					resolve();
			});
		});
		transport.command = (args) =>
			JSON.parse(
				execFileSync("redis-cli", ["-s", socket, "--json", ...args], {
					encoding: "utf8",
				}),
			);
	});

	afterAll(async () => {
		server?.kill("SIGTERM");
		await stopped;
		if (directory) await rm(directory, { recursive: true, force: true });
		vi.unstubAllEnvs();
	});

	it("creates compact independent codes and stores the sharing username", async () => {
		const target = {
			installationId: 77,
			owner: "org",
			repo: "private",
			shareUsername: "oseni99",
		};
		const first = await createShare(target, 60);
		const second = await createShare(target, 60);
		expect(first).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(second).not.toBe(first);
		expect(JSON.parse(String(command("GET", `share:${first}`)))).toMatchObject(
			target,
		);
		expect(command("TTL", `share:${first}`)).toBeGreaterThan(0);
	});

	it("expires both metrics with a share in its final partial second", async () => {
		const [share, count, last] = keys("expiring");
		command("SET", share, "{}", "PX", "400");
		expect(command("TTL", share)).toBe(0);
		await recordShareView("expiring");
		expect(command("GET", count)).toBe("1");
		expect(Number(command("GET", last))).toBeGreaterThan(0);
		for (const key of [count, last]) {
			expect(command("PTTL", key)).toBeGreaterThanOrEqual(0);
			expect(command("PEXPIRETIME", key)).toBe(command("PEXPIRETIME", share));
		}
		await delay(450);
		expect(command("EXISTS", share, count, last)).toBe(0);
		await recordShareView("expiring");
		expect(command("EXISTS", count, last)).toBe(0);
	});

	it("preserves expiry when updating existing metrics", async () => {
		const [share, count, last] = keys("repeat");
		command("SET", share, "{}", "PX", "10000");
		await recordShareView("repeat");
		await recordShareView("repeat");
		expect(command("GET", count)).toBe("2");
		for (const key of [count, last]) {
			expect(command("PEXPIRETIME", key)).toBe(command("PEXPIRETIME", share));
		}
	});

	it("keeps metrics for a non-expiring link", async () => {
		const [share, count, last] = keys("permanent");
		command("SET", share, "{}");
		await recordShareView("permanent");
		await recordShareView("permanent");
		expect(command("GET", count)).toBe("2");
		expect(command("PTTL", count)).toBe(-1);
		expect(command("PTTL", last)).toBe(-1);
	});

	it("does not create metrics for a missing link", async () => {
		await recordShareView("missing");
		expect(command("EXISTS", ...keys("missing"))).toBe(0);
	});

	it("does not recreate metrics after revocation", async () => {
		const [share, count, last] = keys("revoked");
		command("SET", share, JSON.stringify({ installationId: 1 }));
		await recordShareView("revoked");
		await deleteShare("revoked");
		await recordShareView("revoked");
		expect(command("EXISTS", share, count, last)).toBe(0);
	});

	it("groups opens by UTC day and discards history outside the chart window", async () => {
		const now = Date.parse("2026-09-16T00:01:00Z");
		const clock = vi.spyOn(Date, "now").mockReturnValue(now);
		try {
			command("SET", "share:history", "{}");
			command(
				"HSET",
				"share-daily-opens:history",
				"2026-08-17",
				"8",
				"2026-08-18",
				"2",
			);
			await recordShareView("history");
			await recordShareView("history");
			expect(
				command("HGET", "share-daily-opens:history", "2026-08-17"),
			).toBeNull();
			expect(command("HGET", "share-daily-opens:history", "2026-08-18")).toBe(
				"2",
			);
			expect(command("HGET", "share-daily-opens:history", "2026-09-16")).toBe(
				"2",
			);
		} finally {
			clock.mockRestore();
		}
	});

	it("keeps download types separate and deletes all activity on revocation", async () => {
		command(
			"SET",
			"share:downloads",
			JSON.stringify({ installationId: 1 }),
			"PX",
			"10000",
		);
		await recordShareView("downloads");
		await recordShareDownload("downloads", "source");
		await recordShareDownload("downloads", "source");
		await recordShareDownload("downloads", "release");
		const metrics = [
			"share-daily-opens:downloads",
			"share-downloads:downloads:source",
			"share-downloads:downloads:release",
		];
		expect(command("GET", metrics[1])).toBe("2");
		expect(command("GET", metrics[2])).toBe("1");
		for (const metric of metrics)
			expect(command("PEXPIRETIME", metric)).toBe(
				command("PEXPIRETIME", "share:downloads"),
			);
		await deleteShare("downloads");
		await recordShareDownload("downloads", "source");
		expect(command("EXISTS", ...metrics)).toBe(0);
	});

	it("updates expiry for every metric and caps daily history retention", async () => {
		command("SET", "share:ttl", "{}");
		await recordShareView("ttl");
		await recordShareDownload("ttl", "source");
		await recordShareDownload("ttl", "release");
		const metrics = [
			...keys("ttl").slice(1),
			"share-daily-opens:ttl",
			"share-downloads:ttl:source",
			"share-downloads:ttl:release",
		];
		await updateShareTtl("ttl", 60);
		for (const metric of metrics)
			expect(command("PEXPIRETIME", metric)).toBe(
				command("PEXPIRETIME", "share:ttl"),
			);
		await updateShareTtl("ttl", null);
		for (const metric of metrics.filter((key) => !key.includes("daily")))
			expect(command("TTL", metric)).toBe(-1);
		expect(command("TTL", "share-daily-opens:ttl")).toBeGreaterThan(0);
		expect(command("TTL", "share-daily-opens:ttl")).toBeLessThanOrEqual(
			30 * 86400,
		);
	});

	it("lists zero-filled daily history and default counts for existing links", async () => {
		command(
			"SET",
			"share:legacy",
			JSON.stringify({ installationId: 42, owner: "o", repo: "r" }),
		);
		command("SADD", "inst:42", "legacy");
		const [share] = await listSharesForInstallation(42);
		expect(share).toMatchObject({
			viewCount: 0,
			sourceDownloads: 0,
			releaseDownloads: 0,
		});
		expect(share.dailyOpens).toHaveLength(30);
		expect(share.dailyOpens.every((day) => day.count === 0)).toBe(true);
		await recordShareView("legacy");
		const [updated] = await listSharesForInstallation(42);
		expect(updated.dailyOpens.at(-1)?.count).toBe(1);
	});
});
