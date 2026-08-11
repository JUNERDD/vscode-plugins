# Commit Tree

Browse a Git commit in one editor tab with a searchable file tree and a
virtualized multi-file diff powered by
[`@pierre/trees`](https://trees.software/docs) and
[`@pierre/diffs`](https://diffs.com/docs).

## Open a commit

- Run **Commit Tree: Open Commit** and choose a repository and recent commit.
- In VS Code's built-in commit changes editor, click **Open Commit in File
  Tree** in the editor title.
- Use the **Commit Tree** button in the Source Control title bar.

VS Code does not expose a stable API that lets third-party extensions replace
the default click action in Source Control Graph. The editor-title action is
the stable integration path and does not require proposed APIs.

## Features

- Searchable, virtualized file tree with Git statuses and per-file line stats.
- Split and unified Pierre diff layouts.
- Click a file to reveal its diff while preserving the full commit scroll.
- Double-click a file, use its action menu, or use the diff header to open the
  current working-tree file and copy its file name.
- Collapsible, resizable tree with a responsive overlay for narrow editor groups.
- First-parent comparison for merge commits, matching VS Code's commit view.

## Requirements and limits

The built-in Git extension must be enabled and the repository must be local.
Commit Tree reads immutable commit data only; it does not change the working
tree, index, refs, or object database.
Binary changes are listed, but Git patches may not contain renderable text
hunks for them.
Opening a file targets its current working-tree path. Files deleted or moved
after the selected commit remain visible in the diff but cannot be opened from
that path.
