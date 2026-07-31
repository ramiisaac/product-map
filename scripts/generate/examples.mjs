import { regenerateExamples } from "../examples/regenerate.mjs";

/**
 * The committed example snapshots are rebuilt from pinned public checkouts by
 * running pmap over them, so like the self product map this step owns its own
 * writing rather than declaring artifacts.
 *
 * The checkouts live in gitignored fixtures/ and are absent on a fresh clone
 * and in CI. That is not a failure: the step reports itself skipped, and
 * `pnpm examples:check` remains the offline gate that proves the committed
 * snapshots are pinned, valid, and canonical without needing them.
 */
export default {
  name: "examples",
  apply({ check }) {
    const { skipped, changed } = regenerateExamples({ check, requireFixtures: false });
    if (skipped) {
      console.log("  examples: skipped (no fixtures/ checkouts; run `pnpm examples:setup` to include them)");
      return { changed: [] };
    }
    if (check && changed.length > 0) {
      throw new Error(`example snapshots are stale — run \`pnpm examples:generate\`:\n  ${changed.join("\n  ")}`);
    }
    return { changed: check ? [] : changed };
  },
};
