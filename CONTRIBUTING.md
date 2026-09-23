# Contributing

## Before opening a change

- Use an issue for bugs or a short proposal for behavior, public contracts, or architecture.
- Keep extension-specific behavior inside the owning extension, such as `extensions/git-toolkit`
  or `extensions/selection-clipboard`.
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

Each extension versions independently with its own namespaced tag:

- `git-toolkit-v<version>` for Git Toolkit
- `selection-clipboard-v<version>` for Selection Clipboard

Only maintainers should create version commits and tags. For `git-toolkit-v*` tags, GitHub
Actions validates the tag, runs the full quality gate, builds the Git Toolkit VSIX, generates
its SHA-256 checksum, and creates the GitHub Release.

`selection-clipboard-v*` tags are currently produced only by the local
`pnpm release:selection-clipboard:*` version scripts. The release workflow does not accept them
yet, so they do not publish a GitHub Release until that workflow is extended.
