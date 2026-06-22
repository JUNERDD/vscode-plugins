# Agent Instructions

This repository is a Turborepo workspace for VS Code extensions, shared TypeScript packages, and Next.js web surfaces. Follow these rules before changing code.

## Repository Shape

- `extensions/*` contains VS Code extension packages. Each extension owns its manifest, activation code, tests, and Rolldown build config.
- `packages/*` contains shared code. Only put code here when it is intentionally reusable across extensions or web apps.
- `web/*` contains Next.js apps. The current landing app uses the App Router and React 19.
- Use `pnpm` from the repository root. Do not add npm/yarn lockfiles.
- Use Oxc for code quality: `oxlint` for linting and `oxfmt` for formatting. Do not introduce ESLint, Prettier, or parallel style systems unless the user explicitly asks.
- Use Rolldown for extension and package bundles.
- Use Vitest for package and extension tests.

## Baseline Commands

Run the narrowest credible validation for the change, and prefer root scripts when touching more than one workspace.

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For local development:

```sh
pnpm dev
pnpm --dir web/landing dev --hostname 127.0.0.1 --port 3000
```

## Reuse Before Building

Before adding a new helper, package, workflow, component, or dependency:

1. Search existing code, docs, package manifests, tests, and README files with domain terms and synonyms.
2. Check whether the capability belongs in `extensions/*`, `packages/*`, or `web/*`.
3. Classify any apparent duplicate by behavior, not just similar code shape: exact copy, near clone, same business rule, repeated workflow, shadow fork, or justified divergence.
4. Reuse only when the existing asset has a clear fit, owner, tests, examples or obvious usage, and lower lifecycle cost than rebuilding.
5. Keep implementations separate when domains are likely to evolve differently or the abstraction would be less clear than the duplication.

Do not create a `packages/*` module as a dumping ground. Shared packages need a stable contract, tests, examples or consumer usage, and an accountable maintenance path. If a material build-vs-reuse decision affects future work, record the decision in an ADR or repository doc with context, alternatives, consequences, and a review date.

When consolidating duplication, move in behavior-preserving steps: add characterization tests, introduce an adapter or shared module, migrate one low-risk consumer, then batch the rest. Do not delete the old path until consumers and rollback are understood.

## Comments And Documentation

Comments should explain intent, constraints, data meaning, contracts, and non-obvious sequencing. Do not translate syntax into prose.

- Prefer JSDoc/TSDoc for exported functions, exported types, classes, public constants, and core configuration objects.
- Add field-level comments only when a field's domain meaning, units, valid combinations, default behavior, or external coupling is not obvious from its name and type.
- Use short line comments for surprising local invariants, integration quirks, ordering constraints, or workarounds.
- For complex multi-stage logic, use numbered guide comments immediately before the phase they explain, such as `// 1. Normalize input before validation`.
- Remove or rewrite outdated, redundant, or low-value comments instead of stacking new comments under them.
- Avoid comments that duplicate type information, obvious control flow, or implementation trivia.

When documenting a function, include `@param` entries only when they explain caller expectations or semantic constraints. Add `@returns` only when the returned value has meaning beyond its type.

## TypeScript And Package Boundaries

- Keep strict TypeScript settings intact.
- Consumers should import shared code through package exports, not by reaching into another workspace's `src` folder.
- Keep package exports explicit. Avoid broad barrel exports that hide dependency cost or make bundling harder to reason about.
- Do not store request-scoped or user-specific mutable data in module scope. Module scope is acceptable for immutable config, static assets, carefully keyed caches, and constants.
- Prefer immutable array methods such as `toSorted()` when modifying data derived from props or state.
- Use `Set` and `Map` for repeated membership and lookup work.

## VS Code Extensions

- Extension entrypoints should remain small and delegate reusable behavior into local modules or `packages/*` when there is a real cross-package contract.
- Keep `vscode` external in Rolldown configs.
- Test activation, command registration, and reusable logic with Vitest. Mock `vscode` APIs in unit tests rather than invoking the editor runtime.
- Treat extension commands, activation events, contribution points, and package manifest fields as public contracts. Changes require tests or a clear manual verification note.

## Next.js And React

Default to Server Components in `web/*`. Add `"use client"` only for interactivity, browser APIs, or stateful UI that cannot stay server-side.

Performance priorities:

- Eliminate async waterfalls. Start independent work early and use `Promise.all()` for independent operations.
- Check cheap synchronous conditions before awaiting expensive flags, network calls, or database work.
- Use Suspense boundaries when they let static layout render while slower content loads.
- Keep RSC-to-client props minimal. Pass only fields the client actually uses.
- Avoid module-level mutable request state in server code.
- Hoist static I/O to module scope only for immutable assets or config.
- Defer analytics, logging, and other non-critical client work until after hydration or idle time.
- Use `next/dynamic` for heavy client-only components.
- Prefer statically analyzable imports and file paths. Avoid dynamic import paths that make bundlers include broad file sets.

Rendering and client behavior:

- Derive state during render when possible instead of syncing derived state through effects.
- Put user-triggered side effects in event handlers rather than modeling them as state plus effect.
- Use functional state updates when next state depends on previous state.
- Use lazy `useState` initializers for expensive initial values.
- Do not define React components inside other components.
- Do not wrap simple primitive expressions in `useMemo`.
- Use explicit ternaries for conditional rendering when a value might be `0`, `NaN`, or another renderable falsy value.
- Use passive listeners for scroll and touch events unless the handler must call `preventDefault()`.

Composition priorities:

- Avoid boolean prop proliferation. Prefer explicit variants and composition over `isEditing`, `isThread`, `showX` mode matrices.
- Use compound components for complex reusable UI with shared context.
- Keep providers responsible for state management. UI components should consume a small `state`, `actions`, and `meta` interface, not know how state is stored.
- Prefer composing `children` for structure. Use render props only when the parent must pass data back into the child render.
- In React 19 code, prefer `ref` as a normal prop and `use()` for context where appropriate.

## Dependency Policy

Before adding a dependency:

- Search for an existing workspace utility, platform package, or native API that already covers the need.
- Check whether the dependency is needed at runtime or only in development.
- Consider bundle size, transitive dependencies, license/security risk, maintenance health, and exit cost.
- Prefer thin wrappers around unstable third-party APIs when multiple workspaces will consume them.
- Keep `pnpm-lock.yaml` updated from the root.

## Change Hygiene

- Preserve unrelated user changes. Do not revert files you did not intentionally edit.
- Keep edits scoped to the relevant workspace and shared contracts.
- Update tests when changing behavior, public contracts, package exports, command registrations, or React component composition.
- After changing generated-output patterns or dependency build scripts, verify `.gitignore` still ignores build output, caches, `node_modules`, `.next`, `dist`, coverage, and temporary files.
- Do not stage, commit, push, tag, or open PRs unless the user explicitly asks.

