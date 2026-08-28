# Contributing to Brewly

Thank you for helping improve Brewly.

## Before you start

1. Search existing issues and pull requests.
2. Open an issue before large architectural or visual changes.
3. Keep the product independent from Homebrew's brand and visual identity.

## Development workflow

```bash
bun install
bun run dev
```

Use the bundled sample catalogue for focused UI work. Run `bun run data:sync` when changing API normalisation, search indexing, or package pages.

Before submitting a pull request:

```bash
bun run check
SITE_URL=http://localhost:4321 bun run build
bun run deploy:dry-run
```

## Pull requests

- Keep each pull request focused.
- Explain the user-facing problem and the chosen solution.
- Include screenshots for visible changes on desktop and mobile.
- Add or update tests when behaviour changes.
- Do not commit `.cache/`, `dist/`, credentials, or local environment files.

By contributing, you agree that your contribution may be distributed under the MIT Licence.
