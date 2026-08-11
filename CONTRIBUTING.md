# Contributing

## Before opening a change

- Use an issue for bugs or a short proposal for behavior, public contracts, or architecture.
- Keep extension-specific behavior inside its owning `extensions/*` workspace.
- Reuse `packages/*` only when a stable capability has multiple real consumers, tests, and a
  clear owner.
- Preserve the repository's current `UNLICENSED` status. Discuss licensing changes separately
  before submitting them.

## Local setup

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

Node.js and pnpm versions are pinned in `.node-version`, `.nvmrc`, and `package.json`.

## Pull requests

- Keep the change focused and update tests for changed behavior or public contracts.
- Run `pnpm check` before requesting review.
- Run `pnpm package:vsix && pnpm verify:vsix` when packaging behavior changes.
- Do not commit `node_modules`, `dist`, coverage, caches, `.vsix`, checksums, or secrets.
- Use Conventional Commit style for commit subjects; the local commit hook enforces it.

CI must pass before merge. Dependency updates are reviewed like source changes and are never
auto-merged.

## Releases

Release tags are extension-specific:

- `diff-preview-v<version>`
- `commit-tree-v<version>`

Only maintainers should create version commits and tags. GitHub Actions validates the tag,
runs the full quality gate, builds the target VSIX, generates its SHA-256 checksum, and creates
the GitHub Release.
