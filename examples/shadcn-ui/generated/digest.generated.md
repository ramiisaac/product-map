# shadcn-ui — product map (pmap 0.0.0 @ 4baadbc6, clean)
3 surfaces · 24 capabilities · 22 bound · 2 capability-unbound · 1 surface-unbound

SURFACES
  surface:cli:shadcn    packages/shadcn  live  -> 14 bound
  surface:dashboard:v4  apps/v4          live  -> 8 bound
  surface:mcp:shadcn    packages/shadcn  live  UNBOUND

CAPABILITIES
  command  shadcn add, shadcn apply, shadcn build, shadcn diff, shadcn docs, shadcn eject … (13)  packages/shadcn (1)
  package  @shadcn/helpers, @shadcn/react, shadcn (3)                                             packages/helpers, packages/react, packages/shadcn (3)
  route    /api/search, /init, /init/md, /init/v0, /llm/slug-catchall, /r/registries.json … (8)   apps/v4 (1)

GAPS
  capability-unbound  cap:package:helpers
  capability-unbound  cap:package:react
  surface-unbound  surface:mcp:shadcn
