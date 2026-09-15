import { ImageResponse } from "next/og";
import { ACCENT } from "@/lib/brand";

// SourceVault mark: a compact lock inside the acid-lime brand tile.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

function Mark({ radius }: { radius: number }) {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "#080a08",
				borderRadius: radius,
				position: "relative",
			}}
		>
			<div
				style={{
					width: 330,
					height: 330,
					borderRadius: 92,
					background: ACCENT,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					position: "relative",
				}}
			>
				<div
					style={{
						position: "absolute",
						top: 70,
						width: 128,
						height: 126,
						border: "24px solid #080a08",
						borderBottom: "0",
						borderRadius: "70px 70px 0 0",
					}}
				/>
				<div
					style={{
						width: 208,
						height: 148,
						marginTop: 84,
						borderRadius: 38,
						background: "#080a08",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<div
						style={{
							width: 30,
							height: 48,
							borderRadius: 16,
							background: ACCENT,
						}}
					/>
				</div>
			</div>
		</div>
	);
}

export default function Icon() {
	return new ImageResponse(<Mark radius={104} />, { ...size });
}
