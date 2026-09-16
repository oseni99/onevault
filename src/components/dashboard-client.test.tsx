import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { recentOpenDays } from "@/lib/share-metrics";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/site-drawer", () => ({ SiteDrawer: () => null }));
vi.mock("@/components/nav-links", () => ({ NavLinks: () => null }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));

import { DashboardClient } from "./dashboard-client";

describe("dashboard activity refresh", () => {
	it("refreshes server data and retains the selected repository and chart period", () => {
		const repos = [
			{
				installationId: 1,
				owner: "owner",
				name: "repo",
				fullName: "owner/repo",
				private: true,
			},
		];
		const share = {
			id: "s1",
			owner: "owner",
			repo: "repo",
			viewCount: 1,
			sourceDownloads: 0,
			releaseDownloads: 0,
			dailyOpens: recentOpenDays({}),
		};
		const view = render(
			<DashboardClient login="owner" repos={repos} shares={[share]} />,
		);
		fireEvent.click(screen.getByRole("button", { name: /^repo/ }));
		fireEvent.change(screen.getByRole("combobox", { name: /Period/ }), {
			target: { value: "30" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Refresh activity" }));
		expect(refresh).toHaveBeenCalledOnce();
		view.rerender(
			<DashboardClient
				login="owner"
				repos={repos}
				shares={[{ ...share, viewCount: 2, sourceDownloads: 1 }]}
			/>,
		);
		expect(
			screen.getByRole("region", { name: "Link activity for owner/repo" }),
		).toBeInTheDocument();
		expect(screen.getByRole("combobox", { name: /Period/ })).toHaveValue("30");
		expect(
			screen.getByText("0 opens in the last 30 days · 2 all-time opens"),
		).toBeInTheDocument();
		expect(
			screen.getByText("1 source ZIP downloads · 0 release downloads"),
		).toBeInTheDocument();
	});
});
