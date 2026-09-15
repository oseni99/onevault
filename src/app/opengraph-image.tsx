import { ogImage } from "@/lib/og";
import { SITE } from "@/lib/seo";

export { contentType, size } from "@/lib/og";
export const alt = SITE.defaultTitle;

export default function Image() {
	return ogImage(
		"Private code, shared on your terms",
		"No collaborator invites, no GitHub account for the recipient. You keep full control.",
	);
}
