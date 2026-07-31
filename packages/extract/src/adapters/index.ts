import type { Adapter } from "../types";

import { claudePluginAdapter } from "./claude-plugin";
import { trpcRoutersAdapter } from "./trpc-routers";
import { prismaAdapter } from "./prisma-schema";
import { appFrameworksAdapter } from "./app-frameworks";
import { rootScriptCliAdapter } from "./root-script-cli";
import { supabaseMigrationsAdapter } from "./supabase-migrations";
import { xcodegenAdapter } from "./xcodegen";
import { specYamlAdapter } from "./spec-yaml";
import { supabaseFunctionsAdapter } from "./supabase-functions";
import { packageExportsAdapter } from "./package-exports";
import { desktopAdapter } from "./desktop";
import { binsAdapter } from "./bins";
import { cliCommandsAdapter } from "./cli-commands";
import { nextAppsAdapter } from "./next-apps";
import { honoAdapter } from "./hono-api";
import { lspAdapter } from "./lsp";
import { vscodeAdapter } from "./vscode";
import { editorManifestsAdapter } from "./editor-manifests";
import { githubActionAdapter } from "./github-action";
import { emailAdapter } from "./email";
import { reportersAdapter } from "./reporters";
import { dbSchemaAdapter } from "./db-schema";
import { tuiAdapter } from "./tui";
import { workersAdapter } from "./workers";
import { mcpAdapter } from "./mcp";

/** Every adapter, in a deliberate order: higher-confidence sources run first so dedupe keeps them. */
export const ADAPTERS: Adapter[] = [
  claudePluginAdapter,
  trpcRoutersAdapter,
  prismaAdapter,
  appFrameworksAdapter,
  rootScriptCliAdapter,
  supabaseMigrationsAdapter,
  xcodegenAdapter,
  specYamlAdapter,
  supabaseFunctionsAdapter,
  packageExportsAdapter,
  desktopAdapter,
  binsAdapter,
  cliCommandsAdapter,
  nextAppsAdapter,
  honoAdapter,
  lspAdapter,
  vscodeAdapter,
  editorManifestsAdapter,
  githubActionAdapter,
  emailAdapter,
  reportersAdapter,
  dbSchemaAdapter,
  tuiAdapter,
  workersAdapter,
  mcpAdapter,
];
