# mcp-inspector — product map (pmap 0.0.0 @ ac3c1a12, clean)
5 surfaces · 3 capabilities · 3 bound · 2 surface-unbound

SURFACES
  surface:cli:mcp-inspector         .       live  UNBOUND
  surface:cli:mcp-inspector-cli     cli     live  -> 1 bound
  surface:cli:mcp-inspector-client  client  live  -> 1 bound
  surface:cli:mcp-inspector-server  server  live  -> 1 bound
  surface:mcp:inspector-server      server  live  UNBOUND

CAPABILITIES
  package  @modelcontextprotocol/inspector-cli, @modelcontextprotocol/inspector-client, @modelcontextprotocol/inspector-server (3)  cli, client, server (3)

GAPS
  surface-unbound  surface:cli:mcp-inspector
  surface-unbound  surface:mcp:inspector-server
