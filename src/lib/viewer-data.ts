import type { RenderedRelease } from "@/components/releases-list";
import { getInstallationOctokit } from "@/lib/github-app";
import {
	type Contents,
	type DirEntry,
	getContents,
	getRepoMeta,
	getRepoTree,
	listBranches,
	listReleases,
	type TreeItem,
} from "@/lib/github-repo";
import { isMarkdown, renderMarkdown } from "@/lib/markdown";
import { renderMarkdownGitHub } from "@/lib/markdown-github";
import {
	buildHref,
	parseView,
	resolveRef,
	splitRefFromBranches,
} from "@/lib/repo-path";
import { resolveShare } from "@/lib/share-store";

// Everything the viewer needs to render, as plain serializable data. Produced
// server-side behind the BotID-protected /api/view endpoint and rendered by the
// ViewerContent client component. Server-only rendering (Shiki, GitHub markdown)
// happens here and travels to the client as HTML strings, exactly as it did when
// the page was fully server-rendered.
export type ViewerPayload =
	| { kind: "notice"; title: string; detail?: string }
	// A redirect the client performs with router.replace (readme open, branch-lock).
	| { kind: "redirect"; href: string }
	| {
			kind: "releases";
			shareUsername: string;
			fullName: string;
			refName: string;
			owner: string;
			repo: string;
			shareId: string;
			releases: RenderedRelease[];
	  }
	| {
			kind: "view";
			shareUsername: string;
			fullName: string;
			refName: string;
			owner: string;
			repo: string;
			shareId: string;
			contents: Contents;
			mdHtml: string | null;
			fullTree: TreeItem[] | null;
			sidebarEntries: DirEntry[];
			crumbs: string[];
			path: string;
			branches: string[] | null;
			showReleases: boolean;
			allowDownload: boolean;
	  };

// Path-specific data returned after the repository context has already been
// bootstrapped in the browser. A file click should not carry the tree again.
export type ViewerPathPayload =
	| { kind: "notice"; title: string; detail?: string }
	| {
			kind: "path";
			refName: string;
			path: string;
			crumbs: string[];
			contents: Contents;
			mdHtml: string | null;
	  };

async function renderContentsPreview(
	octokit: ReturnType<typeof getInstallationOctokit>,
	owner: string,
	repo: string,
	contents: Contents,
): Promise<string | null> {
	if (
		contents.kind !== "file" ||
		contents.isBinary ||
		!contents.text ||
		!isMarkdown(contents.name)
	) {
		return null;
	}

	return (
		(await renderMarkdownGitHub(octokit, owner, repo, contents.text)) ??
		renderMarkdown(contents.text)
	);
}

// Live navigation revalidates access on every request, but deliberately skips
// stable repository metadata, branches, and the recursive tree.
export async function resolveViewerPath({
	shareId,
	owner,
	repo,
	ref,
	path,
}: {
	shareId: string;
	owner: string;
	repo: string;
	ref: string;
	path: string;
}): Promise<ViewerPathPayload> {
	if (!shareId || !owner || !repo || !ref || !path) {
		return { kind: "notice", title: "Bad request" };
	}

	const target = await resolveShare(shareId);
	if (!target) {
		return {
			kind: "notice",
			title: "Link invalid or expired",
			detail: "This share link no longer works. Ask the owner for a new one.",
		};
	}
	if (target.owner !== owner || target.repo !== repo) {
		return {
			kind: "notice",
			title: "This link does not match this repository",
		};
	}
	if (target.ref && target.ref !== ref) {
		return {
			kind: "notice",
			title: "This branch is not available for this link",
		};
	}

	try {
		const octokit = getInstallationOctokit(target.installationId);
		const contents = await getContents(octokit, owner, repo, path, ref);
		const mdHtml = await renderContentsPreview(octokit, owner, repo, contents);
		return {
			kind: "path",
			refName: ref,
			path,
			crumbs: path.split("/"),
			contents,
			mdHtml,
		};
	} catch {
		return {
			kind: "notice",
			title: "Something went wrong",
			detail: "This file could not be loaded. Please try again.",
		};
	}
}

// Mirrors the old server component ViewPage: same branches, same order, same
// GitHub calls — it just returns data instead of JSX, and returns redirect
// intents instead of throwing Next's redirect().
export async function resolveViewer(
	slug: string[],
	shareId: string,
): Promise<ViewerPayload> {
	if (!shareId || slug[1] !== shareId || !/^[A-Za-z0-9_-]{22}$/.test(shareId)) {
		return {
			kind: "notice",
			title: "A share link is required",
			detail: "Open a new username/code link created from the dashboard.",
		};
	}

	const target = await resolveShare(shareId);
	if (!target) {
		return {
			kind: "notice",
			title: "Link invalid or expired",
			detail: "This share link no longer works. Ask the owner for a new one.",
		};
	}
	if (
		!target.shareUsername ||
		target.shareUsername.toLowerCase() !== slug[0]?.toLowerCase()
	) {
		return {
			kind: "notice",
			title: "This link does not match this repository",
		};
	}
	const parsed = parseView([target.owner, target.repo, ...slug.slice(2)]);
	if (!parsed) return { kind: "notice", title: "Not found" };

	const isReleases = parsed.viewType === "releases";
	if (isReleases && target.showReleases !== true) {
		return {
			kind: "notice",
			title: "Releases are not available for this link",
			detail: "The owner has not turned on the releases view for this share.",
		};
	}

	// Only for an unlocked share whose owner opted in. A locked share must never enumerate branches, which is the point of locking. The releases view addresses no ref, so it never shows the switcher.
	const switcherOn = !isReleases && !target.ref && target.showBranches === true;
	const octokit = getInstallationOctokit(target.installationId);
	let meta: Awaited<ReturnType<typeof getRepoMeta>>;
	let branches: string[] | null;
	try {
		[meta, branches] = await Promise.all([
			getRepoMeta(octokit, target.owner, target.repo),
			switcherOn
				? listBranches(octokit, target.owner, target.repo)
				: Promise.resolve(null),
		]);
	} catch {
		return {
			kind: "notice",
			title: "Access revoked",
			detail: "The app no longer has access to this repository.",
		};
	}

	// A locked share pins one branch. Redirect (rather than error) so deep links that predate the lock, or point at another branch, still land somewhere useful. path is re-split here because a slashed branch name occupies more than one URL segment.
	const resolved = resolveRef(
		target.ref,
		parsed.ref,
		parsed.path,
		meta.defaultBranch,
	);
	const { redirectRef } = resolved;
	let { ref, path } = resolved;

	// With the real branch list in hand, an unlocked share can address a slashed branch too, which is otherwise impossible because parseView can only treat the first segment as the ref.
	if (branches) {
		const split = splitRefFromBranches(parsed.ref, parsed.path, branches);
		if (split) {
			ref = split.ref;
			path = split.path;
		}
	}
	// The releases view addresses no ref, so it is never the target of a lock redirect. Checking the view type here (rather than isReleases) also narrows it to the file views buildHref accepts.
	if (redirectRef && parsed.viewType !== "releases") {
		return {
			kind: "redirect",
			href: buildHref(
				target.shareUsername,
				target.repo,
				parsed.viewType,
				redirectRef,
				path,
				shareId,
			),
		};
	}

	if (isReleases) {
		// Release notes go through markdown-it (html:false) rather than GitHub's renderer: one API call per release would be dozens per page, and the notes do not need issue/@user linking to read correctly.
		const releases: RenderedRelease[] = (
			await listReleases(octokit, target.owner, target.repo)
		).map((r) => ({
			...r,
			bodyHtml: r.body.trim() ? renderMarkdown(r.body) : null,
		}));

		return {
			kind: "releases",
			shareUsername: target.shareUsername,
			fullName: meta.fullName,
			refName: ref,
			owner: target.owner,
			repo: target.repo,
			shareId,
			releases,
		};
	}

	const [contents, tree] = await Promise.all([
		getContents(octokit, target.owner, target.repo, path, ref),
		getRepoTree(octokit, target.owner, target.repo, ref),
	]);

	// The bare repo link opens the README as a file (not a directory listing).
	if (contents.kind === "dir" && path === "") {
		const readme = contents.entries.find(
			(e) =>
				e.type === "file" && /^readme\./i.test(e.name) && isMarkdown(e.name),
		);
		if (readme) {
			return {
				kind: "redirect",
				href: buildHref(
					target.shareUsername,
					target.repo,
					"blob",
					ref,
					readme.path,
					shareId,
				),
			};
		}
	}

	const crumbs = path ? path.split("/") : [];

	// Whole-repo tree for the sidebar (one recursive call). Falls back to the
	// current directory's listing if the ref can't be read or the tree is too
	// large for the API to return in full.
	const fullTree =
		tree && !tree.truncated && tree.items.length > 0 ? tree.items : null;

	// A file view shows its containing folder in the sidebar so navigation
	// stays usable instead of an empty tree.
	let sidebarEntries: DirEntry[] = [];
	if (contents.kind === "dir") {
		sidebarEntries = contents.entries;
	} else if (contents.kind === "file" && fullTree === null) {
		const parentPath = path.includes("/")
			? path.slice(0, path.lastIndexOf("/"))
			: "";
		const parent = await getContents(
			octokit,
			target.owner,
			target.repo,
			parentPath,
			ref,
		);
		if (parent.kind === "dir") sidebarEntries = parent.entries;
	}

	// Markdown files also get a rendered preview, while raw source is rendered
	// client-side by @pierre/diffs.
	const mdHtml = await renderContentsPreview(
		octokit,
		target.owner,
		target.repo,
		contents,
	);

	return {
		kind: "view",
		shareUsername: target.shareUsername,
		fullName: meta.fullName,
		refName: ref,
		owner: target.owner,
		repo: target.repo,
		shareId,
		contents,
		mdHtml,
		fullTree,
		sidebarEntries,
		crumbs,
		path,
		branches,
		showReleases: Boolean(target.showReleases),
		allowDownload: Boolean(target.allowDownload),
	};
}
