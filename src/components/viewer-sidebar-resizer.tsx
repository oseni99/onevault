"use client";

import * as React from "react";

export const VIEWER_SIDEBAR_MIN_WIDTH = 200;
export const VIEWER_SIDEBAR_MAX_WIDTH = 600;

export function clampViewerSidebarWidth(width: number): number {
	const viewportMaximum =
		typeof window === "undefined"
			? VIEWER_SIDEBAR_MAX_WIDTH
			: window.innerWidth - 320;
	return Math.min(
		Math.max(VIEWER_SIDEBAR_MIN_WIDTH, viewportMaximum),
		Math.max(VIEWER_SIDEBAR_MIN_WIDTH, width),
	);
}

export function ViewerSidebarResizer({
	width,
	onResize,
	onResizeEnd,
}: {
	width: number | null;
	onResize: (width: number) => void;
	onResizeEnd: (width: number) => void;
}) {
	const drag = React.useRef<{
		pointerId: number;
		startX: number;
		startWidth: number;
	} | null>(null);
	const latestWidth = React.useRef(width ?? 300);

	const resize = (nextWidth: number) => {
		const clamped = clampViewerSidebarWidth(nextWidth);
		latestWidth.current = clamped;
		onResize(clamped);
	};

	return (
		<hr
			className="viewer__sidebar-resizer"
			aria-label="Resize file tree"
			aria-controls="viewer-file-tree"
			aria-orientation="vertical"
			aria-valuemin={VIEWER_SIDEBAR_MIN_WIDTH}
			aria-valuemax={VIEWER_SIDEBAR_MAX_WIDTH}
			aria-valuenow={width ?? 300}
			tabIndex={0}
			onKeyDown={(event) => {
				const sidebar = event.currentTarget.previousElementSibling;
				if (sidebar instanceof HTMLElement) {
					const measuredWidth = sidebar.getBoundingClientRect().width;
					if (measuredWidth > 0) latestWidth.current = measuredWidth;
				}
				let nextWidth: number | null = null;
				if (event.key === "ArrowLeft") nextWidth = latestWidth.current - 16;
				if (event.key === "ArrowRight") nextWidth = latestWidth.current + 16;
				if (event.key === "Home") nextWidth = VIEWER_SIDEBAR_MIN_WIDTH;
				if (event.key === "End") nextWidth = VIEWER_SIDEBAR_MAX_WIDTH;
				if (nextWidth === null) return;
				event.preventDefault();
				resize(nextWidth);
				onResizeEnd(latestWidth.current);
			}}
			onPointerDown={(event) => {
				const sidebar = event.currentTarget.previousElementSibling;
				if (!(sidebar instanceof HTMLElement)) return;
				drag.current = {
					pointerId: event.pointerId,
					startX: event.clientX,
					startWidth: sidebar.getBoundingClientRect().width,
				};
				event.currentTarget.setPointerCapture(event.pointerId);
			}}
			onPointerMove={(event) => {
				const current = drag.current;
				if (!current || current.pointerId !== event.pointerId) return;
				resize(current.startWidth + event.clientX - current.startX);
			}}
			onPointerUp={(event) => {
				if (drag.current?.pointerId !== event.pointerId) return;
				drag.current = null;
				event.currentTarget.releasePointerCapture(event.pointerId);
				onResizeEnd(latestWidth.current);
			}}
			onPointerCancel={(event) => {
				if (drag.current?.pointerId !== event.pointerId) return;
				drag.current = null;
				onResizeEnd(latestWidth.current);
			}}
		/>
	);
}
