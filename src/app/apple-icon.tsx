import { ImageResponse } from "next/og";
import { ACCENT } from "@/lib/brand";

// Apple touch icon: same mark, opaque, square (Apple applies its own mask).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "#080a08",
				position: "relative",
			}}
		>
			<div
				style={{
					width: 116,
					height: 116,
					borderRadius: 32,
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
						top: 24,
						width: 45,
						height: 44,
						border: "8px solid #080a08",
						borderBottom: "0",
						borderRadius: "24px 24px 0 0",
					}}
				/>
				<div
					style={{
						width: 72,
						height: 52,
						marginTop: 29,
						borderRadius: 13,
						background: "#080a08",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<div
						style={{
							width: 10,
							height: 17,
							borderRadius: 5,
							background: ACCENT,
						}}
					/>
				</div>
			</div>
		</div>,
		{ ...size },
	);
}
