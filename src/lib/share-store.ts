import { randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";
import { recentOpenDays, type ShareMetrics } from "@/lib/share-metrics";

// Maps an opaque shareId -> the install/repo it points at. No credential is
// ever stored or placed in a URL; the installation token is minted on demand.

export interface ShareTarget {
	shareUsername?: string;
	installationId: number;
	owner: string;
	repo: string;
	createdAt?: number;
	expiresAt?: number;
	// Branch this link is locked to. Undefined (every share created before branch locking existed) means "not locked": the viewer resolves the ref from the URL and falls back to the repo default, exactly as before.
	ref?: string;
	// Opt-in branch switcher for an unlocked share. Undefined/false keeps every existing link exactly as it was: other branches stay reachable by URL but are never enumerated to the recipient, because branch names themselves leak information.
	showBranches?: boolean;
	// Opt-in whole-branch zip download. Undefined/false keeps every existing link as it was. The recipient can already read each file, so this grants no new access, but it turns reading into one-click bulk retrieval and that is the owner's call to make.
	allowDownload?: boolean;
	// Opt-in releases tab. Undefined/false keeps every existing link as it was. Releases are genuinely new surface: tags, publish dates, notes and uploaded binaries are not reachable through the file viewer at all.
	showReleases?: boolean;
}

// The per-share settings an owner can change after creation. Deliberately excludes the TTL, which has its own updater with different semantics.
export type ShareSettings = Pick<
	ShareTarget,
	"ref" | "showBranches" | "allowDownload" | "showReleases"
>;

const KEY_PREFIX = "share:";

function viewCountKey(id: string): string {
	return `share-views:${id}`;
}

function lastViewedKey(id: string): string {
	return `share-last-viewed:${id}`;
}

function dailyOpensKey(id: string): string {
	return `share-daily-opens:${id}`;
}

function downloadKey(id: string, kind: "source" | "release"): string {
	return `share-downloads:${id}:${kind}`;
}

function metricKeys(id: string): string[] {
	return [
		viewCountKey(id),
		lastViewedKey(id),
		dailyOpensKey(id),
		downloadKey(id, "source"),
		downloadKey(id, "release"),
	];
}

const HISTORY_SECONDS = 30 * 86400;

function getTtlSeconds(): number | null {
	const raw = process.env.SHARE_LINK_TTL_SECONDS;
	if (!raw) return null;
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

let client: Redis | null = null;

// Accept the Vercel KV names or the native Upstash names. The read-only KV
// token can't write, so use KV_REST_API_TOKEN (read-write).
function getRedis(): Redis {
	if (!client) {
		const url =
			process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
		const token =
			process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
		if (!url || !token) {
			throw new Error(
				"KV not configured: set KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN",
			);
		}
		client = new Redis({ url, token });
	}
	return client;
}

function instKey(installationId: number): string {
	return `inst:${installationId}`;
}

// ttlSeconds: a positive number sets an auto-revoke window, null means never
// expire, undefined falls back to the global SHARE_LINK_TTL_SECONDS env.
export async function createShare(
	target: ShareTarget,
	ttlSeconds?: number | null,
): Promise<string> {
	// 128 bits of randomness, encoded as a compact 22-character URL-safe code.
	const id = randomBytes(16).toString("base64url");
	const ttl = ttlSeconds === undefined ? getTtlSeconds() : ttlSeconds;
	const key = `${KEY_PREFIX}${id}`;
	const redis = getRedis();
	const now = Date.now();
	const record: ShareTarget = {
		...target,
		createdAt: now,
		expiresAt: ttl ? now + ttl * 1000 : undefined,
	};
	if (ttl) {
		await redis.set(key, record, { ex: ttl });
	} else {
		await redis.set(key, record);
	}
	// Reverse index so webhook cleanup can purge an installation's links.
	await redis.sadd(instKey(target.installationId), id);
	return id;
}

// Reset an existing share's auto-revoke window. null clears it (never expires).
export async function updateShareTtl(
	id: string,
	ttlSeconds: number | null,
): Promise<ShareTarget | null> {
	const redis = getRedis();
	const key = `${KEY_PREFIX}${id}`;
	const current = await redis.get<ShareTarget>(key);
	if (!current) return null;
	const next: ShareTarget = {
		...current,
		expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
	};
	const transaction = redis.multi();
	if (ttlSeconds) transaction.set(key, next, { ex: ttlSeconds });
	else transaction.set(key, next);
	for (const metric of metricKeys(id)) {
		if (metric === dailyOpensKey(id)) {
			transaction.expire(
				metric,
				Math.min(ttlSeconds ?? HISTORY_SECONDS, HISTORY_SECONDS),
			);
		} else if (ttlSeconds) transaction.expire(metric, ttlSeconds);
		else transaction.persist(metric);
	}
	await transaction.exec();
	return next;
}

// Change stored settings. Unlike updateShareTtl this must NOT restart the auto-revoke window, so the remaining TTL is read back and re-applied. redis.ttl returns -1 for a key with no expiry and -2 for a missing key. Keys absent from the patch keep their current value; an explicit undefined clears (JSON drops it).
export async function updateShareSettings(
	id: string,
	patch: Partial<ShareSettings>,
): Promise<ShareTarget | null> {
	const redis = getRedis();
	const key = `${KEY_PREFIX}${id}`;
	const current = await redis.get<ShareTarget>(key);
	if (!current) return null;
	const remaining = await redis.ttl(key);
	const next: ShareTarget = { ...current, ...patch };
	if (remaining > 0) {
		await redis.set(key, next, { ex: remaining });
	} else {
		await redis.set(key, next);
	}
	return next;
}

export async function resolveShare(id: string): Promise<ShareTarget | null> {
	const value = await getRedis().get<ShareTarget>(`${KEY_PREFIX}${id}`);
	return value ?? null;
}

// Aggregate link analytics only: no IP address, user agent, or visitor
// identifier is stored. The metrics inherit the share's remaining lifetime.
// Check and write in one script so revocation cannot interleave. Millisecond
// precision also preserves expiry during the share's final partial second.
const RECORD_SHARE_VIEW = `
local remaining = redis.call("PTTL", KEYS[1])
if remaining == -2 then return 0 end

redis.call("INCR", KEYS[2])
redis.call("SET", KEYS[3], ARGV[1])
redis.call("HINCRBY", KEYS[4], ARGV[2], 1)
for _, day in ipairs(redis.call("HKEYS", KEYS[4])) do
  if day < ARGV[3] then redis.call("HDEL", KEYS[4], day) end
end
local history = tonumber(ARGV[4])
if remaining >= 0 then history = math.min(history, remaining) end
redis.call("PEXPIRE", KEYS[4], history)
if remaining >= 0 then
  redis.call("PEXPIRE", KEYS[2], remaining)
  redis.call("PEXPIRE", KEYS[3], remaining)
else
  redis.call("PERSIST", KEYS[2])
end
return 1
`;

export async function recordShareView(id: string): Promise<void> {
	const now = Date.now();
	const days = recentOpenDays({}, now);
	await getRedis().eval(
		RECORD_SHARE_VIEW,
		[
			`${KEY_PREFIX}${id}`,
			viewCountKey(id),
			lastViewedKey(id),
			dailyOpensKey(id),
		],
		[now, days[29].date, days[0].date, HISTORY_SECONDS * 1000],
	);
}

// A download is counted when we hand off a valid GitHub redirect, not when
// the browser finishes saving the file (which this server cannot observe).
export async function recordShareDownload(
	id: string,
	kind: "source" | "release",
): Promise<void> {
	await getRedis().eval(
		`
local remaining = redis.call("PTTL", KEYS[1])
if remaining == -2 then return 0 end
redis.call("INCR", KEYS[2])
if remaining >= 0 then redis.call("PEXPIRE", KEYS[2], remaining)
else redis.call("PERSIST", KEYS[2]) end
return 1
`,
		[`${KEY_PREFIX}${id}`, downloadKey(id, kind)],
		[],
	);
}

// Best-effort cleanup. Access is already enforced at read time (the
// installation token fails if access was revoked); this just keeps KV tidy.
export async function deleteSharesForInstallation(
	installationId: number,
): Promise<void> {
	const redis = getRedis();
	const setKey = instKey(installationId);
	const ids = await redis.smembers(setKey);
	if (ids.length > 0) {
		await redis.del(
			...ids.flatMap((id) => [`${KEY_PREFIX}${id}`, ...metricKeys(id)]),
		);
	}
	await redis.del(setKey);
}

export interface ShareRecord extends ShareTarget, ShareMetrics {
	id: string;
}

export async function listSharesForInstallation(
	installationId: number,
): Promise<ShareRecord[]> {
	const redis = getRedis();
	const setKey = instKey(installationId);
	const ids = await redis.smembers(setKey);
	const out: ShareRecord[] = [];
	for (const id of ids) {
		const t = await redis.get<ShareTarget>(`${KEY_PREFIX}${id}`);
		if (t) {
			const [
				viewCount,
				lastViewedAt,
				sourceDownloads,
				releaseDownloads,
				dailyOpens,
			] = await Promise.all([
				redis.get<number>(viewCountKey(id)),
				redis.get<number>(lastViewedKey(id)),
				redis.get<number>(downloadKey(id, "source")),
				redis.get<number>(downloadKey(id, "release")),
				redis.hgetall<Record<string, number>>(dailyOpensKey(id)),
			]);
			out.push({
				id,
				...t,
				viewCount: viewCount ?? 0,
				lastViewedAt: lastViewedAt ?? undefined,
				sourceDownloads: sourceDownloads ?? 0,
				releaseDownloads: releaseDownloads ?? 0,
				dailyOpens: recentOpenDays(dailyOpens ?? {}),
			});
		} else {
			// Expired/missing: prune the dangling index entry.
			await redis.srem(setKey, id);
		}
	}
	return out;
}

export async function deleteShare(id: string): Promise<ShareTarget | null> {
	const redis = getRedis();
	const t = await redis.get<ShareTarget>(`${KEY_PREFIX}${id}`);
	await redis.del(`${KEY_PREFIX}${id}`, ...metricKeys(id));
	if (t) await redis.srem(instKey(t.installationId), id);
	return t ?? null;
}

export async function deleteSharesForRepos(
	installationId: number,
	fullNames: string[],
): Promise<void> {
	if (fullNames.length === 0) return;
	const redis = getRedis();
	const setKey = instKey(installationId);
	const ids = await redis.smembers(setKey);
	const want = new Set(fullNames.map((f) => f.toLowerCase()));
	for (const id of ids) {
		const t = await redis.get<ShareTarget>(`${KEY_PREFIX}${id}`);
		if (t && want.has(`${t.owner}/${t.repo}`.toLowerCase())) {
			await redis.del(`${KEY_PREFIX}${id}`, ...metricKeys(id));
			await redis.srem(setKey, id);
		}
	}
}
