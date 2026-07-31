# Contributing

Contributions are welcome through GitHub issues and pull requests.

## Development

Use Node.js 22 or newer and the pnpm version declared in `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm examples:check
```

Behavior changes should include focused tests. Generated files are produced by `pnpm generate` and checked in CI by `pnpm generate:check`; never hand-edit one. Keep extraction deterministic: do not add timestamps, randomness, machine-specific paths, or network access to normal extraction. Generated manifests must remain canonical and content-hashed.

User-visible package changes require a Changesets entry (`pnpm changeset`). Commit messages follow Conventional Commits. By contributing, you agree that your work is licensed under the MIT License.

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
