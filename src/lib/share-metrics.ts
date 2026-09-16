export interface DailyOpens {
	date: string;
	count: number;
}

export interface ShareMetrics {
	viewCount: number;
	lastViewedAt?: number;
	sourceDownloads: number;
	releaseDownloads: number;
	dailyOpens: DailyOpens[];
}

export function recentOpenDays(
	counts: Record<string, number>,
	now = Date.now(),
): DailyOpens[] {
	const today = new Date(now).toISOString().slice(0, 10);
	const midnight = Date.parse(`${today}T00:00:00Z`);
	return Array.from({ length: 30 }, (_, index) => {
		const date = new Date(midnight - (29 - index) * 86_400_000)
			.toISOString()
			.slice(0, 10);
		return { date, count: Number(counts[date] ?? 0) };
	});
}
