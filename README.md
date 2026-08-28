<div align="center">
  <a href="https://brewly.nacholaciar.workers.dev">
    <img src="public/assets/brewly-logo.webp" alt="Brewly" width="180" />
  </a>
  <h1>Brewly</h1>
  <p>
    A fast, keyboard-first explorer for Homebrew formulae and casks.<br />
    Spotlight-style search with static, indexable package pages.
  </p>
  <p>
    <a href="https://brewly.nacholaciar.workers.dev"><strong>Open Brewly →</strong></a>
  </p>
</div>

> Brewly is an independent community project. It is not affiliated with, endorsed by, or maintained by Homebrew.

## Why Brewly?

- Search while you type without downloading the entire Homebrew catalogue.
- Navigate with the keyboard: `⌘ K` / `Ctrl K`, arrow keys, `Enter`, and `Escape`.
- Inspect the install command, dependencies, licence, homepage, and analytics in place.
- Discover formulae and casks newly published to the official Homebrew repositories.
- Give every formula and cask its own static, crawlable URL.
- Ship HTML and CSS by default, with React limited to the search experience.

## Stack

- Astro and TypeScript
- Tailwind CSS v4
- React island for interactive search
- A lazy-loaded static search index, kept separate from the initial page bundle
- Zod for Homebrew API validation
- Bun for scripts and package management
- Cloudflare Workers Static Assets for hosting

## Local development

Requirements: [Bun](https://bun.sh/) 1.4 or newer and Node.js 22 or newer.

```bash
bun install
bun run dev
```

The repository includes a small offline dataset, so development works immediately. To build against the current Homebrew catalogue:

```bash
bun run data:sync
SITE_URL=http://localhost:4321 bun run build
bun run preview
```

The generated catalogue and 14-day new-package feed are stored in `.cache/` and are intentionally not committed. `GITHUB_TOKEN` is optional but recommended for automated builds to increase the GitHub API rate limit.

## Production build

Set the canonical site URL and repository link, synchronise the data, and build:

```bash
cp .env.example .env
bun run data:sync
bun run build
```

The output is written to `dist/`. The search catalogue is emitted as a cacheable static asset and loaded only when the search experience needs it. Run `bun run data:sync` before each scheduled deployment to refresh `/news`.

## Cloudflare

`wrangler.jsonc` configures a static-assets-only Worker. Validate the upload locally with:

```bash
bun run deploy:dry-run
```

`bun run deploy` publishes the contents of `dist/`; use it only after authenticating Wrangler and setting `SITE_URL` to the final deployment URL.

## Project status

Brewly is in its initial public-development stage. The core search and package-page architecture is working; see the issue tracker for planned improvements.

## Releases

Releases are managed by [Release Please](https://github.com/googleapis/release-please) from commits made on `main`:

- `fix: ...` proposes a patch release.
- `feat: ...` proposes a minor release.
- `feat!: ...` or a `BREAKING CHANGE:` footer proposes a breaking release.
- `docs:`, `chore:`, `refactor:` and `test:` do not trigger a release by default.

After changes reach `main`, Release Please creates or updates a release pull request containing the version bump and `CHANGELOG.md`. Merging that pull request creates the Git tag and GitHub Release.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md) before opening a pull request.

## Data and attribution

Package metadata is retrieved from the public [Homebrew JSON API](https://formulae.brew.sh/docs/api/). Homebrew and its catalogue repositories use the BSD 2-Clause licence. Brewly does not copy Homebrew's website implementation or visual identity. See [NOTICE.md](NOTICE.md) for attribution details.

## Licence

Brewly's original source code is available under the [MIT Licence](LICENSE).
