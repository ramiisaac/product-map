<!-- generated from capabilities.existing.json@a0cfeac636c93493678311e0715944f5ac4f1d45d5e38e0740ab08da2194e7bb — do not edit -->

# shadcn-ui — capabilities (existing)

Stance: **existing** · Commit: `4baadbc65170` (clean) · Generator: pmap@0.1.1 · Items: 24

## At a glance

| Kind | Count | Areas |
| ---- | ----- | ----- |
| command | 13 | cli |
| package | 3 | sdk |
| route | 8 | api |

## command (13)

| Id | Name | Description | Area | Status | Lives in |
| -- | ---- | ----------- | ---- | ------ | -------- |
| `cap:command:shadcn.add` | shadcn add | add a component to your project | cli | live | `packages/shadcn` |
| `cap:command:shadcn.apply` | shadcn apply | apply a preset to an existing project | cli | live | `packages/shadcn` |
| `cap:command:shadcn.build` | shadcn build | build components for a shadcn registry | cli | live | `packages/shadcn` |
| `cap:command:shadcn.diff` | shadcn diff | [DEPRECATED] Use `add [component] --diff` instead. | cli | live | `packages/shadcn` |
| `cap:command:shadcn.docs` | shadcn docs | get docs, api references and usage examples for components | cli | live | `packages/shadcn` |
| `cap:command:shadcn.eject` | shadcn eject | inline shadcn/tailwind.css and remove the shadcn dependency | cli | live | `packages/shadcn` |
| `cap:command:shadcn.info` | shadcn info | get information about your project | cli | live | `packages/shadcn` |
| `cap:command:shadcn.init` | shadcn init | initialize your project and install dependencies | cli | live | `packages/shadcn` |
| `cap:command:shadcn.mcp` | shadcn mcp | MCP server and configuration commands | cli | live | `packages/shadcn` |
| `cap:command:shadcn.migrate` | shadcn migrate | run a migration. | cli | live | `packages/shadcn` |
| `cap:command:shadcn.preset` | shadcn preset | manage presets | cli | live | `packages/shadcn` |
| `cap:command:shadcn.search` | shadcn search | search items from registries | cli | live | `packages/shadcn` |
| `cap:command:shadcn.view` | shadcn view | view items from the registry | cli | live | `packages/shadcn` |

## package (3)

| Id | Name | Description | Area | Status | Lives in |
| -- | ---- | ----------- | ---- | ------ | -------- |
| `cap:package:helpers` | @shadcn/helpers | Small helpers for developing apps. | sdk | live | `packages/helpers` |
| `cap:package:react` | @shadcn/react | Unstyled components for React. | sdk | live | `packages/react` |
| `cap:package:shadcn` | shadcn | Add components to your apps. | sdk | live | `packages/shadcn` |

## route (8)

| Id | Name | Description | Area | Status | Lives in |
| -- | ---- | ----------- | ---- | ------ | -------- |
| `cap:route:v4-api-search` | /api/search |  | api | live | `apps/v4` |
| `cap:route:v4-init` | /init |  | api | live | `apps/v4` |
| `cap:route:v4-init-md` | /init/md |  | api | live | `apps/v4` |
| `cap:route:v4-init-v0` | /init/v0 |  | api | live | `apps/v4` |
| `cap:route:v4-llm-slug-catchall` | /llm/slug-catchall |  | api | live | `apps/v4` |
| `cap:route:v4-r-registries.json` | /r/registries.json |  | api | live | `apps/v4` |
| `cap:route:v4-rss.xml` | /rss.xml |  | api | live | `apps/v4` |
| `cap:route:v4-typeset.css` | /typeset.css |  | api | live | `apps/v4` |
