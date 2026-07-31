---
"product-map": minor
"@product-map/spec": minor
---

First public release of the `product-map.v1` toolchain: the `pmap` CLI, the Zod contract with emitted JSON Schemas, a Claude Code plugin for adopting and maintaining product maps, and a GitHub Action that gates freshness in CI.

Extraction covers 25 repository conventions — package manifests and bins, CLI command trees, Next.js and Hono apps, tRPC routers, Prisma and Drizzle schemas, Supabase functions and migrations, MCP servers, language servers, editor extensions, GitHub Actions, Electron and XcodeGen targets, and Claude Code plugins — and is extensible per repository through `extract.local.mjs`. Manifests are canonical JSON with content hashes, so `pmap check-fresh` is a byte-comparison suitable for a CI gate.

Requires Node 22 or newer.
