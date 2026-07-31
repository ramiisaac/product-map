import type { CapabilityItem, SurfaceItem } from "./items";
import type { CapabilityManifest, Generator, SurfaceManifest } from "./manifest";
import type { CapabilityKind, Confidence, SurfaceType, WorkingTreeState } from "./vocab";

export type PackageManifest = Record<string, unknown>;

export interface PackageInfo {
  dir: string;
  manifest: PackageManifest;
}

export interface RepoContext {
  root: string;
  repoName: string;
  commit: string | null;
  workingTree: WorkingTreeState;
  packages: PackageInfo[];
  read(relPath: string): string | null;
  exists(relPath: string): boolean;
  listFiles(relDir: string, maxDepth?: number): string[];
}

export interface AdapterOutput {
  surfaces: SurfaceItem[];
  capabilities: CapabilityItem[];
  sources: string[];
}

export interface Adapter {
  name: string;
  detect(ctx: RepoContext): boolean;
  extract(ctx: RepoContext): AdapterOutput;
}

/**
 * How an id collision was settled. Recorded at the point of decision because
 * only dedupe knows both sides: the reason string cannot distinguish two
 * adapters describing one item (benign) from one adapter colliding with itself
 * (a genuine duplicate id).
 */
export type CollisionResolution = "local-authority" | "local-duplicate" | "same-adapter" | "confidence" | "richness";

export interface SkippedCollision {
  winner: string;
  resolvedBy: CollisionResolution;
}

export interface SkippedItem {
  adapter: string;
  id: string;
  reason: string;
  collision?: SkippedCollision;
}

export interface AdapterIssue {
  adapter: string;
  message: string;
}

export interface AdapterEntry<T> {
  adapter: string;
  item: T;
}

export interface ExtractResult {
  surfaces: SurfaceManifest;
  capabilities: CapabilityManifest;
  adaptersRun: string[];
  skipped: SkippedItem[];
  localIssues: string[];
  adapterIssues: AdapterIssue[];
}

export interface MappingOptions {
  candidateThreshold: number;
  maxCandidates: number;
  scoreDecimalPlaces: number;
  minTokenLength: number;
}

export interface RenderOptions {
  descriptionLimit: number;
  collapseThreshold: number;
  commitDisplayLength: number;
  shortCommitDisplayLength: number;
  maxListedItems: number;
  maxListedBinds: number;
  maxListedViews: number;
  maxEvidencePaths: number;
  maxReconciliationItems: number;
}

export interface DigestOptions {
  maxTokens: number;
  charsPerToken: number;
  maxListedNames: number;
  commitDisplayLength: number;
}

export interface DeriveContext {
  generator: Generator;
  mapping: MappingOptions;
  renames?: readonly DeclaredRename[];
}

export type { Confidence };

export interface LocalExtractorOptions {
  command?: string;
  args?: readonly string[];
  timeoutMs?: number;
  maxBufferBytes?: number;
}

export interface ExtractOptions {
  generator: Generator;
  allowRepoCode?: boolean;
  localExtractor?: LocalExtractorOptions;
  config?: RepoConfig;
}

export interface CanonicalPlacementRule {
  where: string;
  canonical: string;
  kinds?: readonly (CapabilityKind | SurfaceType)[];
}

export interface DeclaredBind {
  surface: string;
  capability: string;
  note?: string;
}

export interface DeclaredRename {
  fromId: string;
  toId: string;
  note?: string;
}

export interface AdapterConfig {
  exclude?: readonly string[];
}

export interface OutputConfig {
  markdown?: boolean;
  digest?: boolean;
}

export interface RepoConfig {
  repoName?: string;
  nonProductDirs?: readonly string[];
  canonicalPlacements?: readonly CanonicalPlacementRule[];
  overrides?: Record<string, Partial<SurfaceItem> | Partial<CapabilityItem>>;
  adapters?: AdapterConfig;
  ignore?: readonly string[];
  binds?: readonly DeclaredBind[];
  renames?: readonly DeclaredRename[];
  outputs?: OutputConfig;
  localExtractor?: LocalExtractorOptions;
  mapping?: Partial<MappingOptions>;
  render?: Partial<RenderOptions>;
  digest?: Partial<DigestOptions>;
  discovery?: Partial<RepoContextOptions>;
  concurrency?: number;
}

export interface RepoContextOptions {
  packageSearchDepth?: number;
  listDepth?: number;
  extraSkippedDirs?: readonly string[];
  ignoredStatusPrefix?: string;
}

export interface FleetRepoInput {
  path: string;
  /** True when the manifests were extracted live rather than read from disk. */
  scanned?: boolean;
  surfaces: SurfaceManifest | null;
  capabilities: CapabilityManifest | null;
  hasPlanned: boolean;
  error?: string;
}
