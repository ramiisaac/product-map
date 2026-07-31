## What changed and why

<!-- Describe the behavior change, not the file list. If it fixes an issue, link it. -->

## Verification

<!-- What you ran, and what it said. `pnpm lint typecheck test build examples:check test:packages` is the full gate. -->

## Checklist

- [ ] Behavior changes have focused tests.
- [ ] Extraction stayed deterministic: no timestamps, randomness, machine-specific paths, or network access.
- [ ] Generated files were produced by `pnpm generate`, not hand-edited.
- [ ] User-visible package changes have a Changesets entry (`pnpm changeset`).
