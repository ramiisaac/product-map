<!-- generated from surfaces.existing.json@76dd5abdacbd07a9167f6c39520b950275a8a59f4d4d66b8ef3f492a61eab0b0 — do not edit -->

# netlify-cli — product surfaces (existing)

Stance: **existing** · Commit: `f214e69e4d8b` (clean) · Generator: pmap@0.1.1 · Items: 2

## At a glance

| Surface type | Count | Statuses |
| ------------ | ----- | -------- |
| cli | 2 | live |

## cli

### `surface:cli:netlify` — netlify CLI

Command-line entrypoint `netlify` from netlify-cli.

- Status: **live** · Entry: `netlify` (bin) · Audience: developer
- Lives in: `.`
- Evidence: `package.json`, `src/commands` (confidence: high)
- Bound capabilities (28): `cap:command:netlify.agents`, `cap:command:netlify.api`, `cap:command:netlify.blobs`, `cap:command:netlify.build`, `cap:command:netlify.claim`, `cap:command:netlify.clone`, `cap:command:netlify.completion`, `cap:command:netlify.create`, `cap:command:netlify.database`, `cap:command:netlify.deploy`, `cap:command:netlify.dev`, `cap:command:netlify.dev-exec` … and 16 more

### `surface:cli:ntl` — ntl CLI

Command-line entrypoint `ntl` from netlify-cli.

- Status: **live** · Entry: `ntl` (bin) · Audience: developer
- Lives in: `.`
- Evidence: `package.json`, `./bin/run.js` (confidence: high)
- Bound capabilities: none declared (unbound)
