# VS Code Plugins

[![CI](https://github.com/JUNERDD/vscode-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/JUNERDD/vscode-plugins/actions/workflows/ci.yml)
[![CodeQL](https://github.com/JUNERDD/vscode-plugins/actions/workflows/codeql.yml/badge.svg)](https://github.com/JUNERDD/vscode-plugins/actions/workflows/codeql.yml)
[![License](https://img.shields.io/badge/license-All%20rights%20reserved-lightgrey.svg)](#license)

A focused Turborepo workspace for building, testing, packaging, and releasing VS Code
extensions.

## Projects

| Workspace | Purpose |
| --- | --- |
| [`extensions/diff-preview`](extensions/diff-preview) | Read-only custom editor for rich `.diff` and `.patch` previews. |
| [`extensions/commit-tree`](extensions/commit-tree) | Searchable commit file tree with a virtualized multi-file diff. |
| [`packages/pierre-diff-viewer`](packages/pierre-diff-viewer) | Tested adapter shared by both extensions for Pierre parsing and rendering. |

The extensions keep independent manifests, tests, localization, attribution, and VSIX
contents. Shared behavior lives in `packages/*` only when it has multiple real consumers.
The architectural decision is documented in
[`docs/adr/0001-share-pierre-diff-viewer.md`](docs/adr/0001-share-pierre-diff-viewer.md).

## Install a release

Download the required `.vsix` and matching `.sha256` file from
[GitHub Releases](https://github.com/JUNERDD/vscode-plugins/releases). Verify the checksum,
then install from VS Code with **Extensions: Install from VSIX...** or from a terminal:

```sh
code --install-extension path/to/extension.vsix --force
```

## Development

Requirements:

- Node.js 22.18.0, pinned in `.node-version` and `.nvmrc`
- pnpm 11.3.0, pinned through `packageManager`
- `unzip`, used to validate generated VSIX archives

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

Useful commands:

| Command | Purpose |
| --- | --- |
| `pnpm audit:dependencies` | Reject known high-severity dependency vulnerabilities. |
| `pnpm dev` | Run workspace development tasks. |
| `pnpm check` | Format check, lint, typecheck, test, and build every workspace. |
| `pnpm package:vsix` | Package every publishable extension. |
| `pnpm verify:vsix` | Verify manifests, required files, forbidden files, size, ZIP integrity, and checksums. |
| `pnpm test:coverage` | Generate workspace coverage reports. |

Generated `dist`, coverage, cache, dependency, and VSIX files are ignored. CI rebuilds
release artifacts from a frozen lockfile.

## CI/CD

The pipeline adapts the proven release shape used by
[`JUNERDD/mr`](https://github.com/JUNERDD/mr) to this multi-extension workspace:

- **CI** runs the full quality gate and dependency audit on pull requests and `main`, packages
  both extensions, validates each VSIX, and retains the artifacts for 14 days.
- **Dependency Review** rejects newly introduced high-severity vulnerable dependencies.
- **CodeQL** scans JavaScript and TypeScript on pull requests, `main`, and a weekly schedule.
- **Dependabot** proposes grouped pnpm and GitHub Actions updates without auto-merging.
- **Release** accepts only namespaced tags whose version matches the target manifest and
  whose commit is reachable from `main`. It publishes an immutable VSIX and SHA-256 file
  to GitHub Releases.

Actions are pinned to full commit SHAs, workflow permissions are read-only by default, and
only the release job receives `contents: write`.

## Release an extension

From a clean, up-to-date `main` branch, choose the extension and semantic version bump:

```sh
pnpm release:diff-preview:patch
# or
pnpm release:commit-tree:patch

git push origin main --follow-tags
```

Use the corresponding `:minor` or `:major` command when needed. Tags use
`diff-preview-v<version>` and `commit-tree-v<version>` respectively. The workflow refuses
cross-extension tags, version mismatches, tags outside `main`, invalid archives, and changed
assets on an existing release.

## Contributing and security

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development and review expectations. Report
security issues privately according to [`SECURITY.md`](SECURITY.md), not through a public
issue.

## License

This repository is publicly readable but is not currently distributed under an open-source
license. The project source and extension manifests remain `UNLICENSED`; all rights are
reserved. Third-party components retain their own licenses and attribution files within each
extension.
