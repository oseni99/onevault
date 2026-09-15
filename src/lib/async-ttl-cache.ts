interface AsyncTtlCacheOptions {
	ttlMs: number;
	maxEntries?: number;
}

interface CacheEntry<T> {
	expiresAt: number;
	value: Promise<T>;
}

export interface AsyncTtlCache<T> {
	get(key: string, load: () => Promise<T>): Promise<T>;
}

// A small process-local cache for expensive, immutable-enough reads. Pending
// promises are cached too, so concurrent requests share one upstream call.
export function createAsyncTtlCache<T>({
	ttlMs,
	maxEntries = 64,
}: AsyncTtlCacheOptions): AsyncTtlCache<T> {
	const entries = new Map<string, CacheEntry<T>>();

	return {
		get(key, load) {
			const now = Date.now();
			const cached = entries.get(key);
			if (cached && cached.expiresAt > now) {
				// Refresh insertion order so the size bound behaves like a tiny LRU.
				entries.delete(key);
				entries.set(key, cached);
				return cached.value;
			}
			if (cached) entries.delete(key);

			const value = load().catch((error: unknown) => {
				if (entries.get(key)?.value === value) entries.delete(key);
				throw error;
			});
			entries.set(key, { expiresAt: now + ttlMs, value });

			while (entries.size > maxEntries) {
				const oldest = entries.keys().next().value;
				if (oldest === undefined) break;
				entries.delete(oldest);
			}

			return value;
		},
	};
}
