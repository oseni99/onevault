"use client";

import * as React from "react";

const ITEMS: { q: string; a: React.ReactNode }[] = [
	{
		q: "What is OneLinkVault?",
		a: "OneLinkVault lets you share a private GitHub repository through a read-only link without making the repository public or adding the recipient as a collaborator.",
	},
	{
		q: "Can OneLinkVault access my private repositories?",
		a: "Only the repositories you select when installing the GitHub App. Access is read-only, and repository contents are fetched from GitHub when needed rather than stored in the OneLinkVault database.",
	},
	{
		q: "Who can open a shared link?",
		a: "Anyone who has the link can access the repository content and permissions you selected. Viewers do not need to sign in, so treat a shared link like a password and revoke it if it is exposed.",
	},
	{
		q: "How long does a shared link last?",
		a: "You can give a link an automatic expiration time or let it remain active until you revoke it from your dashboard. Removing the app's repository access also stops the link from working.",
	},
	{
		q: "Do you track visitors?",
		a: (
			<>
				Link owners can see aggregate open and download counts, daily opens for
				the last 30 days, and when their link was last opened. OneLinkVault does
				not store viewer IP addresses or visitor IDs for this feature. It also
				uses cookieless Vercel Web Analytics and does not use advertising or
				cross-site tracking. See the <a href="/privacy">privacy policy</a> for
				details.
			</>
		),
	},
];

export function FaqAccordion() {
	const [open, setOpen] = React.useState(0);

	return (
		<ul className="faq-list">
			{ITEMS.map((item, i) => {
				const isOpen = open === i;
				const qId = `q-${i + 1}`;
				const aId = `a-${i + 1}`;
				return (
					<li className="faq-item" key={item.q}>
						<button
							type="button"
							className="faq-q"
							aria-expanded={isOpen}
							aria-controls={aId}
							id={qId}
							onClick={() => setOpen(isOpen ? -1 : i)}
						>
							<span className="faq-q__text">{item.q}</span>
							<span className="faq-q__icon" aria-hidden="true">
								<svg
									viewBox="0 0 12 12"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.6"
									strokeLinecap="round"
								>
									<line x1="6" y1="2" x2="6" y2="10" />
									<line x1="2" y1="6" x2="10" y2="6" />
								</svg>
							</span>
						</button>
						<section className="faq-a" id={aId} aria-labelledby={qId}>
							<div className="faq-a__inner">
								<div className="faq-a__body">{item.a}</div>
							</div>
						</section>
					</li>
				);
			})}
		</ul>
	);
}
