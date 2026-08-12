# Git Toolkit

Git Toolkit brings commit exploration, rich patch previews, and branch-to-working-tree file
comparisons into one VS Code extension. Its diff surfaces are powered by
[`@pierre/trees`](https://trees.software/docs) and
[`@pierre/diffs`](https://diffs.com/docs).

## Browse a commit

- Run **Git Toolkit: Open Commit** and choose a repository and recent commit.
- In VS Code's built-in commit changes editor, click **Git Toolkit: Open Commit in File Tree**.
- Use the file-tree button in the Source Control title bar.

The commit view combines a searchable changed-file tree with a virtualized multi-file diff. It
supports split and unified layouts, line wrapping, per-file statistics, file navigation, and
first-parent comparison for merge commits.

VS Code does not expose a stable API that lets third-party extensions replace the default click
action in Source Control Graph. The editor-title action is the stable integration path and does
not require proposed APIs.

## Preview diff and patch files

Open a `.diff` or `.patch` file to use the read-only Git Toolkit Diff Preview custom editor. You
can also run **Git Toolkit: Open Diff Preview** or **Git Toolkit: Open Diff Preview to Side**.

The preview supports multi-file patches, split and unified layouts, line wrapping, file headers,
line numbers, parsed statistics, syntax highlighting, and virtualized rendering for large diffs.
Use **Open Text** in the preview toolbar when you want to edit the source document.

## Compare a file with a branch

Open or select a local file, then run **Git Toolkit: Compare File with Branch...** from the
Command Palette, editor toolbar, editor context menu, or Explorer context menu. Choose a local or
remote branch to open VS Code's native side-by-side diff between that branch's version and the
working-tree file.

## Settings

All settings live under `gitToolkit`:

- `gitToolkit.diff.*` controls the shared Pierre renderer used by commit and patch views.
- `gitToolkit.commitTree.*` controls the commit file tree and Git patch size limit.
- `gitToolkit.diffPreview.*` controls the patch preview toolbar, statistics, and file size limit.

## Requirements and limits

Commit browsing and branch comparison require VS Code's built-in Git extension and a local Git
repository. Patch preview works without the Git extension. Git Toolkit's Git features are
read-only: they do not change the working tree, index, refs, or object database.

Binary commit changes are listed, but Git patches may not contain renderable text hunks. Opening
a historical file targets its current working-tree path, so a file moved or deleted after the
selected commit may no longer open from the commit view.

## Migrating from the previous extensions

Git Toolkit replaces the separately installed **Commit Tree** and **Diff Preview** extensions.
Its extension ID is `vscode-plugins.git-toolkit`; command IDs and configuration keys now use the
`vscode-plugins-git-toolkit` and `gitToolkit` namespaces. VS Code treats this as a new extension,
so uninstall the legacy `vscode-plugins.commit-tree` and `vscode-plugins.diff-preview` extensions
after installing Git Toolkit. Reapply any customized legacy settings under the new keys.
