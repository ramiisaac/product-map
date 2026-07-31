const SEGMENT_WILDCARD = "[^/]*";
const GLOBSTAR = ".*";
const SINGLE_CHARACTER = "[^/]";

function escapeLiteral(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function toRegExpSource(pattern: string): string {
  let source = "";
  let index = 0;
  while (index < pattern.length) {
    const char = pattern[index];
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        source += GLOBSTAR;
        index += pattern[index + 2] === "/" ? 3 : 2;
        continue;
      }
      source += SEGMENT_WILDCARD;
      index += 1;
      continue;
    }
    if (char === "?") {
      source += SINGLE_CHARACTER;
      index += 1;
      continue;
    }
    source += escapeLiteral(char ?? "");
    index += 1;
  }
  return `^${source}$`;
}

export interface PathMatcher {
  (path: string): boolean;
  readonly patterns: readonly string[];
}

const TRAILING_DESCENDANTS = /\/+\*\*$/;

/**
 * Slash-separated path matching for `*`, `**`, and `?`. A pattern matches both
 * a directory it names and everything beneath it, so `packages/legacy` and
 * `packages/legacy/**` behave identically — the surprising alternative is a
 * rule that appears to exclude a directory but keeps extracting its contents.
 */
export function createPathMatcher(patterns: readonly string[]): PathMatcher {
  const expressions = patterns.flatMap((pattern) => {
    const base = pattern.replace(TRAILING_DESCENDANTS, "").replace(/\/+$/, "");
    return [new RegExp(toRegExpSource(base)), new RegExp(toRegExpSource(`${base}/**`))];
  });
  const matcher = (path: string): boolean => expressions.some((expression) => expression.test(path));
  return Object.assign(matcher, { patterns });
}
