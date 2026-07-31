# product-map — product map (pmap 0.0.0 @ 5097f2ed, dirty)
5 surfaces · 31 capabilities · 27 bound · 7 capability-unbound · 1 surface-unbound

SURFACES
  surface:agent-plugin:product-map             plugins/product-map         live  -> 8 bound
  surface:cli:pmap                             packages/pmap               live  -> 16 bound
  surface:cli:product-map                      packages/pmap               live  -> 1 bound
  surface:github-action:product-map-freshness  integrations/github-action  live  -> 2 bound
  surface:registry:product-map                 .                           live  UNBOUND

CAPABILITIES
  agent-skill  pmap-design-handoff, pmap-guide-extractors, pmap-guide-overview, pmap-ingest, pmap-refresh, pmap-review … (8)                 plugins/product-map (1)
  command      pmap all, pmap bundle, pmap check-fresh, pmap diff, pmap digest, pmap doctor … (15)                                           packages/pmap (1)
  package      @product-map/derive, @product-map/discovery, @product-map/emit, @product-map/engine, @product-map/extract, product-map … (8)  packages/derive, packages/discovery, packages/emit, packages/engine, packages/extract, packages/pmap … (8)

GAPS
  capability-unbound  cap:package:spec
  surface-unbound  surface:registry:product-map
