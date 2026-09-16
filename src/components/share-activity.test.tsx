import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { recentOpenDays } from "@/lib/share-metrics";
import { ShareActivity } from "./share-activity";

describe("share activity", () => {
	it("switches the chart period and keeps download types separate", () => {
		const dailyOpens = recentOpenDays(
			{ "2026-09-01": 5, "2026-09-15": 2 },
			Date.parse("2026-09-15T12:00:00Z"),
		);
		render(
			<ShareActivity
				name="o/r"
				metrics={{
					dailyOpens,
					viewCount: 10,
					sourceDownloads: 3,
					releaseDownloads: 4,
				}}
			/>,
		);
		expect(
			screen.getByText("2 opens in the last 7 days · 10 all-time opens"),
		).toBeInTheDocument();
		expect(
			screen.getByText("3 source ZIP downloads · 4 release downloads"),
		).toBeInTheDocument();
		fireEvent.change(screen.getByRole("combobox"), { target: { value: "30" } });
		expect(
			screen.getByText("7 opens in the last 30 days · 10 all-time opens"),
		).toBeInTheDocument();
		expect(screen.getAllByRole("row", { hidden: true })).toHaveLength(31);
	});
	it("shows an empty state without inventing historical opens", () => {
		render(
			<ShareActivity
				name="o/r"
				metrics={{
					dailyOpens: recentOpenDays({}),
					viewCount: 20,
					sourceDownloads: 0,
					releaseDownloads: 0,
				}}
			/>,
		);
		expect(
			screen.getByText("No opens recorded in this period."),
		).toBeInTheDocument();
		expect(
			screen.getByText("0 opens in the last 7 days · 20 all-time opens"),
		).toBeInTheDocument();
	});
});
