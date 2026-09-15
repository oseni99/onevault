import { SITE } from "@/lib/seo";

export function SiteFooter() {
	return (
		<footer className="site-footer">
			<p>
				<span className="footer-signal" /> Private code, shared on your terms.
			</p>
			<div className="footer-links">
				<a href="/privacy">Privacy</a>
				<a href={SITE.repo} target="_blank" rel="noopener">
					Open-source foundation <span aria-hidden="true">↗</span>
				</a>
			</div>
		</footer>
	);
}
