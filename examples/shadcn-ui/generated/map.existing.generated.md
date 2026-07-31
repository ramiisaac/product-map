<!-- generated from maps/map.existing.json@a3d1eb99f467d233565522390bb26552641c119a3b2af2ee1cebc4413f30e4cf — do not edit -->

# shadcn-ui — surface ↔ capability map

Stance: **derived** · Commit: `4baadbc65170` (clean) · Generator: pmap@0.1.0 · Items: 25

## Relationship counts

| Relationship | Count | Meaning |
| ------------ | ----- | ------- |
| bound | 22 | surface is backed by a capability that exists |
| capability-unbound | 2 | no surface references this capability |
| surface-unbound | 1 | surface declares no capability, or names one that does not exist |

## surface-unbound (1)

- `surface:mcp:shadcn` — No declared capability bindings; candidates are proposals only. Candidates: `cap:command:shadcn.mcp` (0.5).

## capability-unbound (2)

- `cap:package:helpers` — Not referenced by any surface binding.
- `cap:package:react` — Not referenced by any surface binding.

## bound (22)

<details><summary>Show all 22</summary>

- `surface:cli:shadcn` ↔ `cap:command:shadcn.add` — command module in packages/shadcn/src/commands
- `surface:cli:shadcn` ↔ `cap:command:shadcn.apply` — command module in packages/shadcn/src/commands
- `surface:cli:shadcn` ↔ `cap:command:shadcn.build` — command module in packages/shadcn/src/commands
- `surface:cli:shadcn` ↔ `cap:command:shadcn.diff` — command module in packages/shadcn/src/commands
- `surface:cli:shadcn` ↔ `cap:command:shadcn.docs` — command module in packages/shadcn/src/commands
- `surface:cli:shadcn` ↔ `cap:command:shadcn.eject` — command module in packages/shadcn/src/commands
- `surface:cli:shadcn` ↔ `cap:command:shadcn.info` — command module in packages/shadcn/src/commands
- `surface:cli:shadcn` ↔ `cap:command:shadcn.init` — command module in packages/shadcn/src/commands
- `surface:cli:shadcn` ↔ `cap:command:shadcn.mcp` — command module in packages/shadcn/src/commands
- `surface:cli:shadcn` ↔ `cap:command:shadcn.migrate` — command module in packages/shadcn/src/commands
- `surface:cli:shadcn` ↔ `cap:command:shadcn.preset` — command module in packages/shadcn/src/commands
- `surface:cli:shadcn` ↔ `cap:command:shadcn.search` — command module in packages/shadcn/src/commands
- `surface:cli:shadcn` ↔ `cap:command:shadcn.view` — command module in packages/shadcn/src/commands
- `surface:cli:shadcn` ↔ `cap:package:shadcn` — bin declared by this package
- `surface:dashboard:v4` ↔ `cap:route:v4-api-search` — route handler inside this app
- `surface:dashboard:v4` ↔ `cap:route:v4-init` — route handler inside this app
- `surface:dashboard:v4` ↔ `cap:route:v4-init-md` — route handler inside this app
- `surface:dashboard:v4` ↔ `cap:route:v4-init-v0` — route handler inside this app
- `surface:dashboard:v4` ↔ `cap:route:v4-llm-slug-catchall` — route handler inside this app
- `surface:dashboard:v4` ↔ `cap:route:v4-r-registries.json` — route handler inside this app
- `surface:dashboard:v4` ↔ `cap:route:v4-rss.xml` — route handler inside this app
- `surface:dashboard:v4` ↔ `cap:route:v4-typeset.css` — route handler inside this app

</details>
