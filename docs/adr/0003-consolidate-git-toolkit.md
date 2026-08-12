# ADR 0003: Consolidate the extensions into Git Toolkit

- Status: Accepted
- Decision date: 2026-08-12
- Review date: 2027-02-12
- Owner: `@JUNERDD`

## Context

Commit Tree and Diff Preview served the same Git review workflow but shipped as separately
installed and versioned extensions. Their webviews already shared Pierre parsing and rendering
through `@vscode-plugins/pierre-diff-viewer`, while manifests, commands, settings, release tags,
CI artifacts, and VSIX contents remained duplicated.

The requested product is one Git Toolkit extension that preserves commit browsing and rich
`.diff` and `.patch` previews while adding comparison of the current file with the same file on
a selected branch. After consolidation, the Pierre adapter has only one consumer, so a private
workspace package would no longer meet the repository's shared-package threshold.

## Decision

1. `extensions/git-toolkit` is the repository's only publishable extension. It owns commit
   browsing, diff and patch preview, branch-file comparison, localization, tests, attribution,
   and VS Code integration.
2. Pierre parsing, settings, rendering, and their tests move into the extension-local
   `src/diffViewer` boundary. They can be extracted again only when a second real consumer and a
   stable cross-workspace contract exist.
3. CI packages and verifies one `git-toolkit-<version>.vsix` artifact. Releases accept only
   `git-toolkit-v<version>` tags and publish that VSIX with its SHA-256 checksum.
4. The extension identity becomes `vscode-plugins.git-toolkit`. Command and configuration
   contributions belong to the Git Toolkit manifest instead of the former extension manifests.
5. The former `vscode-plugins.commit-tree` and `vscode-plugins.diff-preview` identities, tags,
   and release assets remain as historical records but receive no new releases. Because VS Code
   treats the new identity as a separate extension, users migrate by uninstalling the former
   extensions and installing Git Toolkit. The first Git Toolkit release notes must enumerate
   renamed commands and configuration keys; automatic migration or compatibility aliases are
   promised only when implemented and tested explicitly.

## Alternatives considered

1. **Keep two extensions and the shared package.** Rejected because it preserves duplicate
   installation, contribution, packaging, and release surfaces for one product workflow.
2. **Merge into the existing Commit Tree identity.** Rejected because the resulting product is
   broader than Commit Tree and the requested Git Toolkit identity should be unambiguous.
3. **Keep `@vscode-plugins/pierre-diff-viewer` as a one-consumer package.** Rejected because the
   package would add build and ownership boundaries without a reusable contract or second
   consumer.
4. **Flatten all implementation into the extension entrypoint.** Rejected because feature-local
   modules and tests preserve maintainable internal boundaries without pretending they are
   shared APIs.

## Consequences

- Users install one extension and maintainers publish one immutable release artifact.
- Commit browsing and patch preview evolve under one manifest and one compatibility policy.
- Pierre upgrades remain isolated behind an internal tested boundary with no workspace package
  indirection.
- The new extension ID is a deliberate migration break: existing installations do not upgrade
  automatically, and settings tied to old namespaces may require manual review.
- One VSIX is larger than either former extension and all features now share a release cadence.
- Historical tags and releases provide rollback artifacts; restoring either former product line
  would require a new decision rather than silently reviving its release workflow.

At the review date, reassess bundle size, migration feedback, command and setting compatibility,
and whether a second consumer justifies extracting the Pierre boundary again.
