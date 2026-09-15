import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ViewerSidebarResizer } from "./viewer-sidebar-resizer";

describe("ViewerSidebarResizer", () => {
	it("supports keyboard resizing and commits the chosen width", () => {
		const onResize = vi.fn();
		const onResizeEnd = vi.fn();
		render(
			<ViewerSidebarResizer
				width={300}
				onResize={onResize}
				onResizeEnd={onResizeEnd}
			/>,
		);

		const separator = screen.getByRole("separator", {
			name: "Resize file tree",
		});
		fireEvent.keyDown(separator, { key: "ArrowRight" });
		expect(onResize).toHaveBeenLastCalledWith(316);
		expect(onResizeEnd).toHaveBeenLastCalledWith(316);

		fireEvent.keyDown(separator, { key: "Home" });
		expect(onResize).toHaveBeenLastCalledWith(200);
		expect(onResizeEnd).toHaveBeenLastCalledWith(200);
	});
});
