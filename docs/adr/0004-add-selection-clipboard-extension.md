# ADR 0004: Add Selection Clipboard as a separate extension

- Status: Accepted
- Decision date: 2026-09-23
- Review date: 2027-03-23
- Owner: `@JUNERDD`
- Amends: [ADR 0003](0003-consolidate-git-toolkit.md), decision 1 ("only publishable
  extension") and the CI part of decision 3

## Context

[ADR 0003](0003-consolidate-git-toolkit.md) consolidated Commit Tree and Diff Preview into Git
Toolkit and made it the repository's only publishable extension. Repository tooling followed
that decision: `scripts/verify-vsix.mjs` required Git Toolkit webview entries for every package,
the root `verify:vsix` script and CI verified and uploaded one VSIX, and the release workflow
accepts only `git-toolkit-v*` tags.

The requested Selection Clipboard extension copies precise editor selection locations such as
`src/app/foo.ts:12:5-14:20` and keeps a per-workspace Activity Bar list of collected selections.
It has no Git, diff, or webview behavior. The user explicitly requested a new extension rather
than a Git Toolkit feature.

## Decision

1. Add `extensions/selection-clipboard` as a second publishable extension with its own identity,
   `vscode-plugins.selection-clipboard`, its own manifest, localization, tests, attribution, and
   version line.
2. Keep it separate from Git Toolkit because the domains are unrelated, the two extensions share
   no runtime dependencies or code, and they should release on independent cadences.
3. Keep location formatting, persistence, and tree rendering local to the extension. Do not add
   a `packages/*` module: the capability has one consumer and no stable cross-workspace contract.
4. Make repository tooling multi-extension:
   - `scripts/verify-vsix.mjs` applies common checks to every VSIX and looks up
     extension-specific required entries by manifest `name`; Git Toolkit keeps its webview
     entries, and Selection Clipboard needs only the common files and its `main` entry.
   - The root `verify:vsix` script and CI package, verify, and upload both VSIX files as
     separate artifacts.
   - Local `release:selection-clipboard:{major,minor,patch}` scripts create
     `selection-clipboard-v<version>` tags.
5. Leave `.github/workflows/release.yml` unchanged in this decision. Publishing
   `selection-clipboard-v*` tags requires a separately approved change to that workflow.

ADR 0003 remains in force for Git Toolkit itself: its consolidated identity, local Pierre
boundary, migration policy, and `git-toolkit-v*` release flow are unchanged.

## Alternatives considered

1. **Fold the feature into Git Toolkit.** Rejected because selection locations are unrelated to
   Git review, would couple release cadence and compatibility policy to an unrelated product,
   and would contradict the explicit request for a new extension.
2. **Create a shared package for location formatting.** Rejected because the formatter has one
   consumer. A package would add build and ownership boundaries without a reusable contract,
   which `AGENTS.md` and ADR 0003 both discourage.
3. **Duplicate verification and CI steps per extension.** Rejected because the archive,
   manifest, forbidden-file, size, and checksum policy should stay in one verifier; only the
   required-entry list differs per extension.

## Consequences

- The repository is again a multi-extension workspace. README, CONTRIBUTING, CODEOWNERS, and
  issue templates name both products.
- Pull requests package and verify both VSIX files, so a packaging regression in either
  extension blocks merge.
- Adding another extension requires a `verify:vsix` argument, a CI upload step, and a row in
  the verifier's extra-entry map only if it ships entries beyond the common set.
- The release workflow is still single-extension. Selection Clipboard VSIX files are built
  locally or taken from CI artifacts until `release.yml` gains a tag-prefix mapping for
  `selection-clipboard-v*`; pushing such a tag does not publish a release today.
- If a second consumer for location formatting appears, extracting a shared package requires a
  new decision with a stable contract and tests.

At the review date, reassess whether the release workflow supports both extensions, whether
per-extension CI steps should become a matrix, and whether the two extensions still have
distinct domains and release cadences.
