/* Generated from src/schemas/responsibility-scope.schema.json by `npm run generate`. Do not edit by hand. */

/**
 * The paths a responsibility may change, declared by the responsibility and enforced by the runner. `never_touch` and workflow paths stay excluded by the runner whatever this allowlist says.
 */
export interface ResponsibilityScope {
  /**
   * The responsibility this scope belongs to.
   */
  responsibility: 'dep-updates' | 'vuln-patch' | 'ci-fix';
  /**
   * Glob allowlist of paths the responsibility may change, relative to each configured directory. No leading `/`, no `..` segment, no backslash, and no brace or extglob syntax (`{`, `}`, `(`, `)`), so expansion cannot produce a `..` segment.
   *
   * @minItems 1
   * @maxItems 100
   */
  paths: [string, ...string[]];
  /**
   * Largest diff, in changed lines, the responsibility may produce.
   */
  max_diff_lines?: number;
}
