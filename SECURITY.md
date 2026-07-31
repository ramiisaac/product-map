# Security policy

## Supported versions

Security fixes are applied to the latest published version. This project is pre-1.0, so upgrades may include behavior changes documented in the changelog.

## Executing repository code

By design, `pmap` executes code belonging to the repository it is pointed at:

- `product-map.config.mjs` at the repository root is imported into the pmap process.
- `docs/reference/product-map/extract.local.mjs` is spawned as a child process (`node extract.local.mjs <repoRoot>`, 60-second timeout) and its stdout is parsed.

Both run with the privileges of whoever invoked `pmap`, and both are opt-out rather than opt-in, on the same reasoning as package-manager lifecycle scripts: a repository you are already building and testing can already run code as you.

That reasoning does not hold for a checkout you have not reviewed — an untrusted fork, a pull request from outside your organization, or an automated scan of arbitrary repositories. **Pass `--no-repo-code` in those situations.** It skips both mechanisms entirely; extraction falls back to the generic filesystem extractors, which only read. Because loading a config file means importing it, `--config` is rejected alongside `--no-repo-code` rather than treated as an exception. The examples in this repository are generated with `--no-repo-code` for exactly this reason.

Extraction never writes outside `docs/reference/product-map/` in the target repository, never makes network requests, and never reads credentials or environment configuration.

## Reporting a vulnerability

Please use the repository's [private vulnerability reporting](https://github.com/ramiisaac/product-map/security/advisories/new). Do not disclose a suspected vulnerability in a public issue.

Include the affected version, impact, reproduction steps, and any suggested mitigation. You should receive an acknowledgement within seven days.
