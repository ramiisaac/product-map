---
name: pmap-ingest
description: This skill should be used when the user asks to "ingest the design", "ingest planned manifests", "process the Claude Design export", "run the reconcile", or provides surfaces.planned.json / capabilities.planned.json files returned from a Claude Design project.
argument-hint: "<planned-manifest-files...>"
allowed-tools: ["Bash", "Read", "Grep", "Glob"]
---

# /product-map:ingest — the design return leg

Take planned manifests returned from hosted Claude Design, validate them in, and produce the reconciliation plan.

## Steps

1. **Locate the files.** Use the paths the user provided; if they pasted raw JSON instead, save it to temporary files first. Planned manifests may arrive with an empty or absent `contentHash` — ingest stamps it.
2. `pnpm exec pmap ingest <files..> --repo .`
   - **On bounce**: pmap prints an `INGEST BOUNCE` report listing every violation. Relay it verbatim for pasting back into the Claude Design project. Do NOT hand-fix design content — the design agent owns its manifests; only mechanical JSON repair (encoding, truncated paste) is fair game locally.
   - **On success**: the planned manifests are written canonically into `docs/reference/product-map/`.
3. **Refresh the existing side first**: `pnpm exec pmap all --repo .` — this re-extracts reality AND derives the planned-vs-existing map, diffs, and `generated/reconciliation-plan.generated.md` in one pass.
4. **Summarize the reconciliation plan** for the user:
   - Relationship counts from the map (bound / bound-proposed / bound-conflict / surface-unbound / capability-unbound), plus how many unreferenced capabilities are externally reachable.
   - Wave 1 (missing capabilities to build) and which planned surfaces are blocked on it.
   - Wave 4 exposure decisions and needs-owner items (doctrine conflicts, low-confidence design claims) — these need the user, not an agent.
5. **Stop there.** The plan is reviewed by the user before anything is implemented; implementing waves is a separate, explicitly-requested task.
