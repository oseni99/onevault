import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recentOpenDays } from "@/lib/share-metrics";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/site-drawer", () => ({ SiteDrawer: () => null }));
vi.mock("@/components/nav-links", () => ({ NavLinks: () => null }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));

import { DashboardClient } from "./dashboard-client";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe("dashboard expiration settings", () => {
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
		shareUsername: "owner",
		expiresAt: Date.parse("2030-09-23T12:00:00Z"),
		viewCount: 0,
		sourceDownloads: 0,
		releaseDownloads: 0,
		dailyOpens: recentOpenDays({}),
	};
	function setup(shares = [share]) {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
		const view = render(
			<DashboardClient login="owner" repos={repos} shares={shares} />,
		);
		fireEvent.click(screen.getByRole("button", { name: /^repo/ }));
		return { fetchMock, view };
	}
	async function save() {
		fireEvent.click(screen.getByRole("button", { name: "Set" }));
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Set" })).toBeEnabled(),
		);
	}
	function enableDownloads() {
		fireEvent.click(
			within(
				screen.getByRole("tablist", {
					name: "Viewers can download repo as a zip",
				}),
			).getByRole("tab", { name: "Yes" }),
		);
	}

	it("shows the saved expiry and preserves it when only downloads change", async () => {
		const { fetchMock } = setup();
		expect(
			screen.getByRole("combobox", { name: "Auto-revoke unit" }),
		).toHaveValue("keep");
		expect(
			screen.getByText(new Date(share.expiresAt).toLocaleString()),
		).toHaveAttribute("datetime", "2030-09-23T12:00:00.000Z");
		enableDownloads();
		await save();
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.allowDownload).toBe(true);
		expect(body).not.toHaveProperty("ttlSeconds");
	});

	it.each([
		{ unit: "days", seconds: 7 * 86400 },
		{ unit: "never", seconds: null },
	])("saves an explicit $unit change only once", async ({ unit, seconds }) => {
		const { fetchMock } = setup();
		fireEvent.change(
			screen.getByRole("combobox", { name: "Auto-revoke unit" }),
			{ target: { value: unit } },
		);
		if (unit === "days")
			fireEvent.change(
				screen.getByRole("spinbutton", { name: "Auto-revoke amount" }),
				{ target: { value: "7" } },
			);
		await save();
		expect(JSON.parse(fetchMock.mock.calls[0][1].body).ttlSeconds).toBe(
			seconds,
		);
		expect(
			screen.getByRole("combobox", { name: "Auto-revoke unit" }),
		).toHaveValue("keep");
		enableDownloads();
		await save();
		expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty(
			"ttlSeconds",
		);
	});

	it("retains an expiration edit when saving fails so it can be retried", async () => {
		const { fetchMock } = setup();
		fetchMock.mockResolvedValueOnce({
			ok: false,
			json: async () => ({ error: "Try again" }),
		});
		fireEvent.change(
			screen.getByRole("combobox", { name: "Auto-revoke unit" }),
			{ target: { value: "weeks" } },
		);
		await save();
		expect(
			screen.getByRole("combobox", { name: "Auto-revoke unit" }),
		).toHaveValue("weeks");
		await save();
		expect(JSON.parse(fetchMock.mock.calls[1][1].body).ttlSeconds).toBe(604800);
	});

	it("does not reuse a creation draft when updating the newly created link", async () => {
		const { fetchMock, view } = setup([]);
		fireEvent.change(
			screen.getByRole("combobox", { name: "Auto-revoke unit" }),
			{ target: { value: "weeks" } },
		);
		fireEvent.click(screen.getByRole("button", { name: "Share" }));
		await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
		expect(JSON.parse(fetchMock.mock.calls[0][1].body).ttlSeconds).toBe(604800);
		view.rerender(
			<DashboardClient login="owner" repos={repos} shares={[share]} />,
		);
		enableDownloads();
		await save();
		expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty(
			"ttlSeconds",
		);
	});
});

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
