# vscode-plugins

Turborepo workspace for VS Code extensions and related web surfaces.

## Layout

- `extensions/*` - VS Code extension packages. Each extension owns its manifest, source, and Rolldown build config.
- `packages/*` - shared code packages used by extensions and web apps.
- `web/*` - web apps, including the Next.js landing page.

## Tooling

- Package manager: `pnpm`
- Task runner: `turbo`
- Linting: `oxlint`
- Formatting: `oxfmt`
- Package bundling: `rolldown`

## Scripts

```sh
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm format:check
```

Run the complete local CI gate with:

```sh
pnpm check
```

## CI/CD and releases

GitHub Actions runs formatting, linting, type checking, tests, and builds for
pull requests and pushes to `main`. It also packages the Diff Preview extension
as a VSIX and uploads the package as a workflow artifact.

Tags matching `diff-preview-v*` additionally publish the VSIX and its SHA-256
checksum to a GitHub Release. The tag version must match
`extensions/diff-preview/package.json`.

To publish the next patch release from a clean `main` branch:

```sh
pnpm release:diff-preview:patch
git push origin main --follow-tags
```

Use `release:diff-preview:minor` or `release:diff-preview:major` for the
corresponding semantic version change. The release command runs the complete
CI gate before updating the extension manifest, creating the release commit,
and tagging it with the `diff-preview-v<version>` format.
