# OneLinkVault

OneLinkVault is a personal clone of [`revoconner/github-unlisted`](https://github.com/revoconner/github-unlisted), extensively modified to suit our purposes and needs. It turns a private GitHub repository into a revocable, read-only link that recipients can browse without a GitHub account or collaborator invitation.

## What OneLinkVault does

1. Sign in with GitHub and install the OneLinkVault GitHub App on selected repositories.
2. Create a share link from the dashboard.
3. Send the link to anyone who needs to review the code.
4. Revoke the link at any time or give it an automatic expiration date.

The GitHub App has read-only access. A share link contains an opaque identifier rather than a GitHub credential.

## Features

- Read-only repository browser with a searchable, resizable file tree
- Syntax highlighting with light and dark themes
- Fast file navigation with bounded hover prefetching
- Links locked to a selected branch or opened on the default branch
- Optional branch switcher for recipients
- Optional source archive downloads
- Optional releases and release-asset downloads
- Configurable link expiration and immediate revocation
- Personal share links in the form `/username/random-code`, using the creator's GitHub username and a cryptographically random code. Revoke and recreate older links to use the new format.
- Per-link open count, last-viewed time, 7/30-day daily open charts, and separate source ZIP/release download counts without visitor identification
- Dashboard activity refresh without a full page reload; opens include repeat visits and downloads count successful GitHub handoffs
- Bot protection on the private repository data endpoint
- Responsive desktop and mobile interfaces
- Owner dashboard for creating, copying, configuring, and revoking links

## Privacy and data handling

OneLinkVault fetches repository content through GitHub's API only after validating a share link. Repository metadata, trees, and file contents may be held in bounded, process-local memory caches for up to five minutes to improve navigation. These caches are temporary and are not written to the OneLinkVault database.

Upstash stores share-link configuration, including the GitHub installation, repository, optional branch restriction, permissions, creation time, and expiration. GitHub credentials remain server-side. Vercel Web Analytics provides anonymous, cookieless aggregate traffic measurements.

See the deployed application's `/privacy` page for the complete policy.

## Local development

Requirements:

- Node.js 20.9 or newer
- A GitHub App
- An Upstash Redis database
- A Vercel BotID configuration

Install dependencies and create your environment file:

```bash
npm install
cp .env.example .env.local
```

Fill in the required values, then start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

`.env.example` documents every supported variable. The core deployment values are:

- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_OWNER`, and `NEXT_PUBLIC_SOURCE_REPO_URL`
- GitHub App ID, private key, client credentials, webhook secret, and public app slug
- `SESSION_SECRET`
- Upstash Redis REST URL and read-write token
- Optional default share-link lifetime

Never commit `.env.local` or GitHub App private keys.

## Commands

```bash
npm run dev       # run Next.js locally
npm run build     # create a production build
npm test          # run the Vitest suite
npm run check     # run Biome checks
npm run format    # format the project with Biome
```

## Deployment

The repository includes `vercel.json` for Vercel deployment. Configure all required environment variables in the Vercel project before deploying. Set `NEXT_PUBLIC_SITE_URL` to the production origin so canonical URLs, social metadata, the sitemap, and structured data do not point to localhost.

Configure the GitHub App's callback, setup, and webhook URLs for the production domain:

- `/api/github/callback`
- `/api/github/setup`
- `/api/github/webhook`

## Security model

- Repository access uses short-lived GitHub installation tokens.
- Installation tokens and the GitHub App private key are never sent to recipients.
- Share links are bearer links: anyone who possesses a valid link can use its permissions until it expires or is revoked.
- The viewer endpoint validates the link on every request and uses Vercel BotID to reject automated access.
- Removing repository access or uninstalling the GitHub App invalidates affected links.

Report security concerns privately using the contact address listed in the privacy policy.

## License

OneLinkVault is distributed under the [GNU General Public License v3.0](LICENSE).

This is a personal clone of [`revoconner/github-unlisted`](https://github.com/revoconner/github-unlisted), modified and maintained as OneLinkVault to suit our own workflow and requirements. The OneLinkVault source is maintained at [`oseni99/onevault`](https://github.com/oseni99/onevault).
