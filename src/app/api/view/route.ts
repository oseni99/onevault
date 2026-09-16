import { checkBotId } from "botid/server";
import { after, NextResponse } from "next/server";
import { recordShareView } from "@/lib/share-store";
import {
	resolveViewer,
	resolveViewerPath,
	type ViewerPathPayload,
	type ViewerPayload,
} from "@/lib/viewer-data";

// The viewer's data lives behind this endpoint precisely so bots can be turned
// away here. It exposes private-repo contents, so it must never be cached.
export const dynamic = "force-dynamic";

// Deep Analysis (Kasada) on top of the basic challenge check. checkLevel MUST
// match the client registration in src/instrumentation-client.ts, or every
// verification fails.
export async function POST(request: Request): Promise<NextResponse> {
	const verification = await checkBotId({
		advancedOptions: { checkLevel: "deepAnalysis" },
	});

	if (verification.isBot) {
		return NextResponse.json({ kind: "blocked" }, { status: 403 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ kind: "notice", title: "Bad request" } satisfies ViewerPayload,
			{ status: 400 },
		);
	}

	const record = (body ?? {}) as {
		operation?: unknown;
		slug?: unknown;
		shareId?: unknown;
		owner?: unknown;
		repo?: unknown;
		ref?: unknown;
		path?: unknown;
		trackView?: unknown;
	};
	const shareId = typeof record.shareId === "string" ? record.shareId : "";
	if (record.operation === "path") {
		const stringValue = (value: unknown) =>
			typeof value === "string" ? value : "";
		try {
			const payload = await resolveViewerPath({
				shareId,
				owner: stringValue(record.owner),
				repo: stringValue(record.repo),
				ref: stringValue(record.ref),
				path: stringValue(record.path),
			});
			return NextResponse.json(payload);
		} catch (err) {
			console.error("view path resolve failed", err);
			return NextResponse.json(
				{
					kind: "notice",
					title: "Something went wrong",
					detail: "This file could not be loaded. Please try again.",
				} satisfies ViewerPathPayload,
				{ status: 500 },
			);
		}
	}
	const slug = Array.isArray(record.slug)
		? record.slug.filter((s): s is string => typeof s === "string")
		: [];

	try {
		const payload = await resolveViewer(slug, shareId);
		if (
			record.trackView === true &&
			(payload.kind === "view" || payload.kind === "releases")
		) {
			after(async () => {
				try {
					await recordShareView(shareId);
				} catch (error) {
					console.error("share view tracking failed", error);
				}
			});
		}
		return NextResponse.json(payload);
	} catch (err) {
		// The old server component let unexpected throws bubble to Next's error
		// boundary. Here they'd surface as a bare fetch failure, so translate them
		// into a viewer notice the client can render.
		console.error("view resolve failed", err);
		return NextResponse.json(
			{
				kind: "notice",
				title: "Something went wrong",
				detail: "This repository could not be loaded. Please try again.",
			} satisfies ViewerPayload,
			{ status: 500 },
		);
	}
}
