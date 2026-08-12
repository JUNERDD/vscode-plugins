# ADR 0001: Share the Pierre diff viewer contract

- Status: Superseded
- Superseded by: [ADR 0003](0003-consolidate-git-toolkit.md)
- Decision date: 2026-08-01
- Review date: 2027-02-01
- Owner: VS Code extensions maintainers

## Context

`diff-preview` already parsed patches and managed a Pierre `CodeView`. The new
`commit-tree` extension needs the same behavior, plus file-level metadata and
stable IDs that connect a file tree to the matching diff item. Copying the
renderer would create two independently evolving settings contracts and patch
parsers.

Pierre's official DiffsHub follows the same model: one parsed patch feeds both
the file tree and the multi-file diff. `@pierre/trees` remains beta, so the tree
UI should stay owned by `commit-tree` instead of becoming a workspace-wide
abstraction prematurely.

## Decision

Create the focused private package `@vscode-plugins/pierre-diff-viewer`. It owns:

- the serializable Pierre viewer settings and defaults;
- patch parsing, stable path-based item IDs, file status, and line statistics;
- the imperative `CodeView` setup, update, navigation, and cleanup lifecycle.

`diff-preview` and `commit-tree` consume that package through its public export.
Each extension continues to own its VS Code integration, protocol, toolbar,
size limits, localization, fallback states, and outer Webview layout.

`commit-tree` directly owns its `@pierre/trees` integration. The shared package
does not export tree behavior while that dependency is beta and has only one
consumer.

## Alternatives considered

1. Copy the existing renderer into `commit-tree`. Rejected because settings,
   parsing fixes, and Pierre upgrades would drift.
2. Put the code in the generic `packages/shared` workspace. Rejected because
   the browser-only Pierre lifecycle is a distinct dependency and maintenance
   boundary.
3. Build a broad review-surface framework around both Diffs and Trees. Deferred
   because only the diff contract currently has multiple proven consumers.
4. Import another extension's `src` files directly. Rejected because it breaks
   workspace package boundaries and makes build ordering implicit.

## Consequences

- Pierre diff upgrades and parser fixes have one tested owner.
- Both extensions retain the same rendering defaults without duplicating a
  large options mapper.
- The package has characterization tests and two real consumers, satisfying a
  stable shared-package contract.
- Final Webview bundles still resolve `@pierre/diffs` themselves so Rolldown can
  preserve lazy Shiki language chunks.
- A breaking Pierre API change affects the shared package first, while a Trees
  beta change remains isolated to `commit-tree`.

At the review date, reassess `@pierre/trees` stability, bundle size, the upstream
peer-version warning, and whether a second tree consumer justifies extracting a
shared review-surface abstraction.
