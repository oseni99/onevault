import "@/styles/global.css";
import { NavLinks } from "@/components/nav-links";
import { SiteDrawer } from "@/components/site-drawer";
import { SiteFooter } from "@/components/site-footer";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function Wordmark() {
	return (
		<a className="wordmark" href="/" aria-label="OneLinkVault home">
			<span className="mark" aria-hidden="true">
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<path
						d="M5.5 3.5h7v3.25H15v7.75H3V6.75h2.5V3.5Z"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinejoin="round"
					/>
					<circle cx="9" cy="10.5" r="1.35" fill="currentColor" />
				</svg>
			</span>
			<span className="word">
				<span className="pre">onelink</span>
				<span className="post">vault</span>
			</span>
		</a>
	);
}

function ProductPreview() {
	return (
		<div
			className="product-preview"
			role="img"
			aria-label="Preview of a shared private repository"
		>
			<div className="product-preview__chrome">
				<div className="window-dots" aria-hidden="true">
					<i />
					<i />
					<i />
				</div>
				<span>onelinkvault / shared repository</span>
				<span className="preview-live">
					<i /> read only
				</span>
			</div>
			<div className="product-preview__body">
				<aside className="preview-tree">
					<p className="preview-label">FILES</p>
					<ul>
						<li>
							<span>⌄</span> src
						</li>
						<li className="is-nested">
							<span>◇</span> app
						</li>
						<li className="is-nested is-active">
							<span>◇</span> architecture.ts
						</li>
						<li>
							<span>⌄</span> docs
						</li>
						<li>
							<span>◇</span> README.md
						</li>
						<li>
							<span>◇</span> package.json
						</li>
					</ul>
				</aside>
				<section className="preview-code">
					<div className="preview-code__head">
						<span>architecture.ts</span>
						<span>TypeScript</span>
					</div>
					<div className="code-lines" aria-hidden="true">
						<p>
							<b>01</b>
							<span className="code-pink">export</span>{" "}
							<span className="code-purple">const</span> system = &#123;
						</p>
						<p>
							<b>02</b>&nbsp;&nbsp;access:{" "}
							<span className="code-green">&quot;read-only&quot;</span>,
						</p>
						<p>
							<b>03</b>&nbsp;&nbsp;visibility:{" "}
							<span className="code-green">&quot;unlisted&quot;</span>,
						</p>
						<p>
							<b>04</b>&nbsp;&nbsp;expires:{" "}
							<span className="code-purple">true</span>,
						</p>
						<p>
							<b>05</b>&nbsp;&nbsp;control:{" "}
							<span className="code-green">&quot;yours&quot;</span>,
						</p>
						<p>
							<b>06</b>&#125;;
						</p>
					</div>
					<div className="preview-note">
						<span>✓</span>
						<div>
							<strong>Private by default</strong>
							<small>Repository contents are fetched on demand.</small>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}

export default async function Page() {
	const session = await getSession();

	return (
		<div className="page-shell home-shell">
			<header className="topbar">
				<Wordmark />

				<NavLinks signedIn={Boolean(session)} active="home" />

				<a className="nav-cta" href={session ? "/app" : "/api/github/login"}>
					{session ? "Dashboard" : "Sign in"}
					<span aria-hidden="true">↗</span>
				</a>

				<SiteDrawer signedIn={Boolean(session)} active="home" />
			</header>

			<main className="hero">
				<section className="hero__copy">
					<div className="hero__eyebrow">
						<span className="eyebrow-dot" /> Private repository sharing
					</div>
					<h1 className="hero__title">
						Show the work.
						<br />
						<span>Keep the code private.</span>
					</h1>
					<p className="hero__sub">
						Create a secure, read-only link to any private GitHub repository. No
						collaborator invites. No account required for the person viewing it.
					</p>
					<div className="hero-cta">
						<a
							className="btn btn--outline-accent"
							href={session ? "/app" : "/api/github/login"}
						>
							{session ? "Open your vault" : "Connect GitHub"}
							<span aria-hidden="true">→</span>
						</a>
						<a className="hero-cta__secondary" href="#how-it-works">
							See how it works <span aria-hidden="true">↓</span>
						</a>
					</div>
					<ul className="trust-row" aria-label="Product benefits">
						<li>
							<span>01</span> Read only
						</li>
						<li>
							<span>02</span> Revoke anytime
						</li>
						<li>
							<span>03</span> No recipient login
						</li>
					</ul>
				</section>
				<section className="hero__visual">
					<div className="preview-orbit preview-orbit--one" />
					<div className="preview-orbit preview-orbit--two" />
					<ProductPreview />
					<div className="floating-chip floating-chip--top">
						<span>●</span> link active
					</div>
					<div className="floating-chip floating-chip--bottom">
						expires in 7 days
					</div>
				</section>
			</main>

			<section
				className="how-strip"
				id="how-it-works"
				aria-label="How it works"
			>
				<p>
					<span>01</span> Select a repository
				</p>
				<i aria-hidden="true">→</i>
				<p>
					<span>02</span> Create a private link
				</p>
				<i aria-hidden="true">→</i>
				<p>
					<span>03</span> Share your work
				</p>
			</section>
			<SiteFooter />
		</div>
	);
}
