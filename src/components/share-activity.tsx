"use client";

import { useState } from "react";
import type { ShareMetrics } from "@/lib/share-metrics";

export function ShareActivity({
	metrics,
	name,
}: {
	metrics: ShareMetrics;
	name: string;
}) {
	const [range, setRange] = useState(7);
	const days = metrics.dailyOpens.slice(-range);
	const maximum = Math.max(1, ...days.map((day) => day.count));
	const total = days.reduce((sum, day) => sum + day.count, 0);
	return (
		<section
			className="share-activity"
			aria-label={`Link activity for ${name}`}
		>
			<div className="share-activity__header">
				<h2>Link activity · {name}</h2>
				<label>
					Period{" "}
					<select
						value={range}
						onChange={(event) => setRange(Number(event.target.value))}
					>
						<option value={7}>Last 7 days</option>
						<option value={30}>Last 30 days</option>
					</select>
				</label>
			</div>
			<p>
				{total} opens in the last {range} days · {metrics.viewCount} all-time
				opens
			</p>
			<div
				className="share-activity__chart"
				role="img"
				aria-label={`Daily opens for the last ${range} days: ${days.map((day) => `${day.date}: ${day.count}`).join(", ")}`}
			>
				{days.map((day) => (
					<div
						className="share-activity__column"
						key={day.date}
						title={`${day.date} (UTC): ${day.count} opens`}
					>
						<div
							className="share-activity__bar"
							style={{ height: `${(day.count / maximum) * 100}%` }}
						/>
					</div>
				))}
			</div>
			<div className="share-activity__dates">
				<span>{days[0]?.date}</span>
				<span>{days.at(-1)?.date} (UTC)</span>
			</div>
			{total === 0 && <p>No opens recorded in this period.</p>}
			<details>
				<summary>View daily counts</summary>
				<table>
					<thead>
						<tr>
							<th scope="col">Date (UTC)</th>
							<th scope="col">Opens</th>
						</tr>
					</thead>
					<tbody>
						{days.map((day) => (
							<tr key={day.date}>
								<th scope="row">{day.date}</th>
								<td>{day.count}</td>
							</tr>
						))}
					</tbody>
				</table>
			</details>
			<p>
				{metrics.sourceDownloads} source ZIP downloads ·{" "}
				{metrics.releaseDownloads} release downloads
			</p>
			<p className="share-activity__note">
				Opens are not unique visitors; repeat opens and your own visits count.
				Downloads count successful handoffs to GitHub, not completed transfers.
				Daily history starts when tracking is enabled.
			</p>
		</section>
	);
}
