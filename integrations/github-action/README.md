# product-map GitHub Action

Gate a pull request on product-map freshness. The action runs `pmap check-fresh`, which regenerates the map in memory and byte-compares it against what is committed — so a change to the code that nobody reflected in `docs/reference/product-map/` fails the build.

```yaml
name: product-map
on: [pull_request]

jobs:
  freshness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: ramiisaac/product-map/integrations/github-action@main
```

## Inputs

| Input             | Default       | What it does                                                                                  |
| ----------------- | ------------- | --------------------------------------------------------------------------------------------- |
| `version`         | `latest`      | Version of the `product-map` package to run. Pin it to make the gate reproducible.            |
| `repo`            | `.`           | Repository root to check, relative to the workspace.                                          |
| `command`         | `check-fresh` | Use `validate` for a weaker gate that only checks the manifests parse and are canonical.      |
| `allow-repo-code` | `true`        | Set to `false` to skip the repository's own `product-map.config.mjs` and `extract.local.mjs`. |

## Notes

`check-fresh` deliberately reuses the commit recorded in the committed manifests rather than the commit being built, so a commit that only touches generated artifacts cannot manufacture drift. A clean checkout is enough; no build step or Node setup is required beyond what `npx` provides.
