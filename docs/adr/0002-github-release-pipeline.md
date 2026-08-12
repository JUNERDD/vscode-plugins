# ADR 0002: Adapt the `mr` release pipeline for a multi-extension workspace

- Status: Superseded
- Superseded by: [ADR 0003](0003-consolidate-git-toolkit.md)
- Date: 2026-08-11
- Review date: 2027-02-11
- Owner: `@JUNERDD`

## Context

The repository originally adapted the `JUNERDD/mr` pipeline into one workflow for Diff
Preview. That workflow established useful invariants: a single quality gate, strict tag and
manifest version matching, one packaged artifact passed into the release job, SHA-256 output,
and write permission limited to release publication.

Commit Tree introduced a second independently versioned extension. The original workflow still
listened only for `diff-preview-v*`, validated only one manifest, and discarded the Commit Tree
package produced by the root build. Copying that workflow per extension would duplicate policy
and make the checks drift.

## Decision

Adapt the existing pattern rather than introduce a release framework:

1. Use one CI workflow to run the root quality gate and package and verify both extensions.
2. Use one release workflow with an explicit tag-prefix allowlist mapping to exactly one
   extension directory.
3. Keep namespaced tags: `diff-preview-v*` and `commit-tree-v*`.
4. Reuse `scripts/verify-vsix.mjs` locally and in both workflows for archive integrity,
   manifest identity, required files, forbidden files, size, and checksum verification.
5. Pass the verified artifact to a separate least-privilege release job and never rebuild it.
6. Treat an existing release asset as immutable: identical assets are accepted on a retry;
   different content fails instead of being overwritten.
7. Pin actions to full commit SHAs and let Dependabot propose updates.
8. Publish GitHub Releases only. Marketplace and Open VSX publication remain separate future
   decisions because they require verified publisher ownership and external credentials.

## Alternatives considered

- **Duplicate one workflow per extension.** Rejected because the validation and security policy
  would be near clones with independent drift.
- **Use one global `v*` tag.** Rejected because the extensions version and release independently.
- **Adopt Changesets or Release Please.** Rejected for now because two private workspace
  packages do not justify another versioning system and bot workflow.
- **Publish every VSIX for every tag.** Rejected because a tag must identify one immutable
  product release.

## Consequences

- Pull requests validate both products when shared code or tooling changes.
- Release tags fail early when the version, target, ancestry, archive, or asset identity is
  wrong.
- The repository owns a small Node verifier that requires `unzip` on developer and CI hosts.
- Adding another publishable extension requires one release-prefix mapping and inclusion in the
  root verification command.
- Revisit the decision if release frequency, extension count, or marketplace publication makes
  manual semantic version commands a bottleneck.
