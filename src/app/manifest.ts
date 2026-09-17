import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

// Colours are literal site tokens (mirror global.css --bg / --accent).
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: SITE.name,
		short_name: "OneLinkVault",
		description: SITE.description,
		start_url: "/",
		display: "standalone",
		background_color: "#0d1117",
		theme_color: "#0d1117",
		icons: [
			{ src: "/icon", sizes: "512x512", type: "image/png" },
			{ src: "/apple-icon", sizes: "180x180", type: "image/png" },
		],
	};
}
