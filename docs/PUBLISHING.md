# Publishing and consuming product-map

`product-map` and `@product-map/spec` are version-locked by Changesets and configured as public packages on the npm registry.

## One-time npm setup

Before the first release, an npm package owner must configure a trusted publisher for each package in npm's package settings:

- Provider: GitHub Actions
- Repository: `ramiisaac/product-map`
- Workflow: `release.yml`
- Environment: leave blank unless the workflow is later assigned one

Trusted publishing requires a public GitHub repository and npm package, Node.js 22.14 or newer, npm CLI 11.5.1 or newer, and `id-token: write`. The workflow uses Node.js 24 and installs a compatible npm CLI.
No long-lived npm token is stored in GitHub.

## Release flow

1. Add a Changesets entry with `pnpm changeset` and commit it with the code.
2. A push to `main` runs all verification and `changesets/action`, which opens or updates the version PR.
3. Merge the version PR. The workflow builds again and publishes through npm trusted publishing with provenance.

The `version` input default in `integrations/github-action/action.yml` is pinned automatically: `version-packages` runs `integrations/github-action/scripts/sync-version.mjs` after `changeset version`, so every version PR rewrites the default to the release it ships and an unscheduled release cannot change what a consumer's freshness gate runs. The script is a no-op while the version is the pre-release 0.0.0 placeholder, which is why the default reads `latest` until the first release. Between merging a version PR and npm finishing the publish, `action.yml@main` briefly references a version not yet on the registry; the window is minutes and the failure is loud and transient.

The workflow does not publish from pull requests and does not push ad-hoc release commits directly to `main`.

## Install

Node.js must satisfy `^22.18.0 || >=24.11.0`, matching the JavaScript and TypeScript parser used for extraction.
No registry mapping or authentication is required for consumers:

```bash
pnpm add -D product-map
pnpm exec pmap init
pnpm exec pmap all
pnpm exec pmap check-fresh
```

Programmatic consumers can import the engine from `product-map` or the manifest contract from `@product-map/spec`.

## Package contents

- `product-map`: ESM CLI/library build, prompt templates, JSON Schemas, README, and MIT license.
- `@product-map/spec`: ESM library build, emitted JSON Schemas, README, and MIT license.

Run `pnpm test:packages` before release to pack both tarballs, inspect their allowlisted contents, install them into a clean temporary project, execute the CLI, and import both public APIs.
