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
