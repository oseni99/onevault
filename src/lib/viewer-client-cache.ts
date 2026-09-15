import type { ViewerPathPayload, ViewerPayload } from "@/lib/viewer-data";

export type ViewerRequest =
	| { operation: "bootstrap"; slug: string[]; shareId: string }
	| {
			operation: "path";
			shareId: string;
			owner: string;
			repo: string;
			ref: string;
			path: string;
	  };

export type ViewerResponse = ViewerPayload | ViewerPathPayload;

export class ViewerRequestError extends Error {
	constructor(readonly status: number) {
		super(`Viewer request failed with ${status}`);
	}
}

const MAX_ENTRIES = 64;
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
	expiresAt: number;
	value: Promise<ViewerResponse>;
}

const entries = new Map<string, CacheEntry>();
interface RepositoryContextEntry {
	expiresAt: number;
	payload: Extract<ViewerPayload, { kind: "view" }>;
}

const repositoryContexts = new Map<string, RepositoryContextEntry>();

export function getViewerRepositoryContext(
	shareId: string,
): Extract<ViewerPayload, { kind: "view" }> | null {
	const context = repositoryContexts.get(shareId);
	if (!context) return null;
	if (context.expiresAt <= Date.now()) {
		repositoryContexts.delete(shareId);
		return null;
	}
	return context.payload;
}

export function rememberViewerRepositoryContext(
	payload: Extract<ViewerPayload, { kind: "view" }>,
): void {
	repositoryContexts.set(payload.shareId, {
		expiresAt: Date.now() + CACHE_TTL_MS,
		payload,
	});
}

function requestKey(request: ViewerRequest): string {
	return request.operation === "bootstrap"
		? `bootstrap:${request.shareId}:${request.slug.join("/")}`
		: `path:${request.shareId}:${request.owner}/${request.repo}@${request.ref}:${request.path}`;
}

function requestBody(request: ViewerRequest): Record<string, unknown> {
	if (request.operation === "bootstrap") {
		return { slug: request.slug, shareId: request.shareId };
	}
	return request;
}

export function loadViewerRequest(
	request: ViewerRequest,
): Promise<ViewerResponse> {
	const key = requestKey(request);
	const now = Date.now();
	const cached = entries.get(key);
	if (cached && cached.expiresAt > now) {
		entries.delete(key);
		entries.set(key, cached);
		return cached.value;
	}
	if (cached) entries.delete(key);

	const value = fetch("/api/view", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(requestBody(request)),
	}).then(async (response) => {
		if (!response.ok && response.status !== 400 && response.status !== 500) {
			throw new ViewerRequestError(response.status);
		}
		return (await response.json()) as ViewerResponse;
	});

	const guarded = value.catch((error: unknown) => {
		if (entries.get(key)?.value === guarded) entries.delete(key);
		throw error;
	});
	entries.set(key, { expiresAt: now + CACHE_TTL_MS, value: guarded });

	while (entries.size > MAX_ENTRIES) {
		const oldest = entries.keys().next().value;
		if (oldest === undefined) break;
		entries.delete(oldest);
	}

	return guarded;
}

export function prefetchViewerPath(
	request: Extract<ViewerRequest, { operation: "path" }>,
): void {
	void loadViewerRequest(request).catch(() => {
		// Prefetch is opportunistic; navigation will retry a failed request.
	});
}
