# Git Toolkit

[![CI](https://github.com/JUNERDD/vscode-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/JUNERDD/vscode-plugins/actions/workflows/ci.yml)
[![CodeQL](https://github.com/JUNERDD/vscode-plugins/actions/workflows/codeql.yml/badge.svg)](https://github.com/JUNERDD/vscode-plugins/actions/workflows/codeql.yml)
[![License](https://img.shields.io/badge/license-All%20rights%20reserved-lightgrey.svg)](#license)

A focused Turborepo workspace for building, testing, packaging, and releasing the Git Toolkit
VS Code extension.

## Workspace

| Workspace | Purpose |
| --- | --- |
| [`extensions/git-toolkit`](extensions/git-toolkit) | Commit browsing, rich diff and patch previews, and branch-to-working-file comparisons. |

Git Toolkit combines the former Commit Tree and Diff Preview experiences in one extension and
one VSIX. Pierre parsing and rendering stay local to the extension because they now have one
consumer. The consolidation decision and migration boundary are documented in
[`docs/adr/0003-consolidate-git-toolkit.md`](docs/adr/0003-consolidate-git-toolkit.md).

## Install a release

Download the required `.vsix` and matching `.sha256` file from
[GitHub Releases](https://github.com/JUNERDD/vscode-plugins/releases). Verify the checksum,
then install from VS Code with **Extensions: Install from VSIX...** or from a terminal:

```sh
code --install-extension path/to/git-toolkit-0.1.0.vsix --force
```

## Migrate from the former extensions

Git Toolkit uses the new extension ID `vscode-plugins.git-toolkit`. It replaces
`vscode-plugins.commit-tree` and `vscode-plugins.diff-preview`; those extension IDs and their
release tags remain historical and receive no new releases. VS Code treats Git Toolkit as a
separate extension, so uninstall the former extensions and install the Git Toolkit VSIX.

The first Git Toolkit release notes must identify renamed commands and configuration keys. VS
Code does not automatically transfer enabled state or settings that remain scoped to an old
extension or configuration namespace.

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
| `pnpm package:vsix` | Package the Git Toolkit extension. |
| `pnpm verify:vsix` | Verify manifests, required files, forbidden files, size, ZIP integrity, and checksums. |
| `pnpm test:coverage` | Generate workspace coverage reports. |

Generated `dist`, coverage, cache, dependency, and VSIX files are ignored. CI rebuilds
release artifacts from a frozen lockfile.

## CI/CD

The pipeline adapts the proven release shape used by
[`JUNERDD/mr`](https://github.com/JUNERDD/mr) to this workspace:

- **CI** runs the full quality gate and dependency audit on pull requests and `main`, packages
  and validates the Git Toolkit VSIX, and retains it for 14 days.
- **Dependency Review** rejects newly introduced high-severity vulnerable dependencies.
- **CodeQL** scans JavaScript and TypeScript on pull requests, `main`, and a weekly schedule.
- **Dependabot** proposes grouped pnpm and GitHub Actions updates without auto-merging.
- **Release** accepts only `git-toolkit-v*` tags whose version matches the manifest and whose
  commit is reachable from `main`. It publishes an immutable VSIX and SHA-256 file to GitHub
  Releases.

Actions are pinned to full commit SHAs, workflow permissions are read-only by default, and
only the release job receives `contents: write`.

## Release Git Toolkit

From a clean, up-to-date `main` branch, choose the semantic version bump:

```sh
pnpm release:git-toolkit:patch

git push origin main --follow-tags
```

Use the corresponding `:minor` or `:major` command when needed. Tags use
`git-toolkit-v<version>`. The workflow refuses version mismatches, tags outside `main`, invalid
archives, and changed assets on an existing release.

## Contributing and security

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development and review expectations. Report
security issues privately according to [`SECURITY.md`](SECURITY.md), not through a public
issue.

## License

This repository is publicly readable but is not currently distributed under an open-source
license. The project source and extension manifests remain `UNLICENSED`; all rights are
reserved. Third-party components retain their own licenses and attribution files within each
extension.
