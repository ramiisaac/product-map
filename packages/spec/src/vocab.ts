/**
 * product-map.v1 controlled vocabularies.
 *
 * These arrays are the single source of truth for every enum in the manifest
 * schemas and for the emitted JSON Schemas. Extending a vocabulary is a
 * schema-version-relevant change: additions are backward compatible within
 * v1, removals or renames require a version bump.
 */

export const MANIFEST_KINDS = ["surface", "capability", "map", "diff", "fleet"] as const;
export type ManifestKind = (typeof MANIFEST_KINDS)[number];

export const STANCES = ["existing", "planned", "derived"] as const;
export type Stance = (typeof STANCES)[number];

export const WORKING_TREE_STATES = ["clean", "dirty", "not-applicable"] as const;
export type WorkingTreeState = (typeof WORKING_TREE_STATES)[number];

/** Why a repository's row in a fleet manifest is or is not populated. */
export const FLEET_STATES = ["mapped", "scanned", "not-mapped", "invalid"] as const;
export type FleetState = (typeof FLEET_STATES)[number];

export const SURFACE_TYPES = [
  "marketing",
  "docs",
  "dashboard",
  "admin",
  "playground",
  "explorer",
  "report",
  "vscode",
  "jetbrains",
  "zed",
  "lsp",
  "cli",
  "tui",
  "email",
  "notification",
  "github-action",
  "github-app",
  "mcp",
  "api-docs",
  "sdk-docs",
  "registry",
  "build-plugin",
  "lint-plugin",
  "desktop",
  "macos",
  "browser-extension",
  "agent-plugin",
  "other",
] as const;
export type SurfaceType = (typeof SURFACE_TYPES)[number];

export const ENTRY_KINDS = [
  "route",
  "command",
  "panel",
  "view",
  "extension-point",
  "email-template",
  "mcp-tool",
  "api-doc",
  "generated-artifact",
  "bin",
  "config-file",
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const SURFACE_STATUSES = ["live", "partial", "prototype", "planned", "absent", "stale", "unknown"] as const;
export type SurfaceStatus = (typeof SURFACE_STATUSES)[number];

export const CAPABILITY_KINDS = [
  "route",
  "query",
  "mutation",
  "action",
  "command",
  "event",
  "stream",
  "entity",
  "schema",
  "service",
  "package",
  "config",
  "extension-api",
  "email-contract",
  "lsp-method",
  "diagnostic",
  "webhook",
  "job",
  "queue-job",
  "mcp-tool",
  "check",
  "rule",
  "reporter",
  "plugin-api",
  "report",
  "artifact",
  "agent-skill",
  "agent-subagent",
  "other",
] as const;
export type CapabilityKind = (typeof CAPABILITY_KINDS)[number];

export const SURFACE_AREAS = [
  "web",
  "api",
  "db",
  "cli",
  "tui",
  "lsp",
  "vscode",
  "jetbrains",
  "zed",
  "email",
  "github-action",
  "mcp",
  "sdk",
  "worker",
  "daemon",
  "edge",
  "docs",
  "agent",
  "other",
] as const;
export type SurfaceArea = (typeof SURFACE_AREAS)[number];

export const CAPABILITY_STATUSES = [
  "live",
  "partial",
  "preview",
  "planned",
  "absent",
  "deprecated",
  "unknown",
] as const;
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

export const CONFIDENCES = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

/**
 * Whether anything outside this repository can consume a capability directly.
 * Independent of `status`: a private package is mature and shipping, it is
 * simply not distributed, so it is `status: live` + `reach: internal`.
 */
export const REACHES = ["external", "internal", "unknown"] as const;
export type Reach = (typeof REACHES)[number];

/**
 * The reach an adapter records when it has observed nothing about how the
 * capability is distributed. `internal` appears only where internality is
 * definitional — nothing outside a repository addresses a database table, a
 * lint rule, or a build artifact directly, so that is an analytic truth of the
 * kind rather than a guess. Every remaining kind is context-dependent: an
 * admin dashboard's routes and a private package's commands are as much routes
 * and commands as a public API's, and no generic heuristic can tell them
 * apart, so the default is `unknown` and an adapter overrides it only from
 * observed evidence (the package adapter reads `private`, the CLI adapters
 * follow their package's publication).
 *
 * Keeping this beside the vocabulary rather than in eighteen adapters means a
 * new kind forces the question once, here.
 */
export const DEFAULT_REACH: Record<CapabilityKind, Reach> = {
  route: "unknown",
  query: "unknown",
  mutation: "unknown",
  action: "unknown",
  command: "unknown",
  event: "unknown",
  stream: "unknown",
  entity: "internal",
  schema: "internal",
  service: "internal",
  package: "unknown",
  config: "internal",
  "extension-api": "unknown",
  "email-contract": "unknown",
  "lsp-method": "unknown",
  diagnostic: "internal",
  webhook: "unknown",
  job: "internal",
  "queue-job": "internal",
  "mcp-tool": "unknown",
  check: "internal",
  rule: "internal",
  reporter: "internal",
  "plugin-api": "unknown",
  report: "internal",
  artifact: "internal",
  "agent-skill": "unknown",
  "agent-subagent": "unknown",
  other: "unknown",
};

export const PLACEMENT_VERDICTS = ["correct", "misplaced", "unknown"] as const;
export type PlacementVerdict = (typeof PLACEMENT_VERDICTS)[number];

export const BIND_VIAS = ["explicit", "inferred-high", "candidate-only"] as const;
export type BindVia = (typeof BIND_VIAS)[number];

/**
 * How a surface and a capability relate. Every value describes the LINK and
 * nothing else — deliberately not the stance (the manifest envelope records
 * that), not item-level facts (`placement.verdict` and `reach` live on the
 * item), and not distinctions recoverable from the entry's own shape.
 *
 * `surface-unbound` carrying a `capabilityId` means the surface named a
 * capability that does not exist; without one it declared nothing at all.
 */
export const MAP_RELATIONSHIPS = [
  "bound",
  "bound-proposed",
  "bound-conflict",
  "surface-unbound",
  "capability-unbound",
] as const;
export type MapRelationship = (typeof MAP_RELATIONSHIPS)[number];

/**
 * What happened to an id between two stances, and nothing else. Field-level
 * detail is the entry's `fieldChanges` JSON pointers — a category naming the
 * fields that moved would only restate them, less precisely. `renamed` is
 * produced solely from a declared `renames` config entry; there is no
 * automatic lineage inference.
 */
export const DIFF_CHANGES = ["added", "removed", "changed", "renamed"] as const;
export type DiffChange = (typeof DIFF_CHANGES)[number];

export const SCHEMA_VERSION = "product-map.v1" as const;
