---
name: pmap-validate
description: This skill should be used when the user asks to "validate product-map", "check product-map freshness", "is the product map stale", or wants the read-only CI-style gate for manifests.
allowed-tools: ["Bash", "Read"]
---

# /product-map:validate — read-only manifest gate

Verify the repo's product-map data without writing anything.

## Steps

1. `pnpm exec pmap validate --repo .` — schema shape, id grammar, sort order, stance/kind coherence, contentHash integrity for every manifest on disk.
2. `pnpm exec pmap check-fresh --repo .` — regenerate in memory and byte-compare; exit 1 means the committed data no longer matches the repo.
3. Interpret for the user:
   - `validate` failures → a manifest was hand-edited or corrupted; the fix is regeneration (`/product-map:refresh`), never manual JSON repair.
   - `check-fresh` drift → the repo moved since the last extraction (normal after pulls/merges); list the stale files and offer `/product-map:refresh`.
   - Both green → state the recorded commit and workingTree from `generated/README.generated.md` so the user knows what snapshot they are trusting.
4. This command is safe to wire into CI as a freshness gate — `pmap check-fresh` is designed as the CI primitive (read-only, exit code driven).
