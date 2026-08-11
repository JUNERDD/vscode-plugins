# Pierre Diff Viewer

Shared, browser-side façade around `@pierre/diffs` for this workspace's VS Code webviews.

It owns the stable viewer settings contract, patch parsing with path-based item IDs, aggregate
and per-file statistics, and the imperative `CodeView` lifecycle. Extension-specific toolbar,
file-size, messaging, and localization policies stay in their owning extension.

```ts
import {
  DEFAULT_DIFF_VIEWER_SETTINGS,
  PierreDiffViewer,
  parseDiffDocument,
} from "@vscode-plugins/pierre-diff-viewer";

const document = parseDiffDocument(patch, { cacheKey: commit, version: 1 });
const viewer = new PierreDiffViewer(container);
viewer.render(document.items, DEFAULT_DIFF_VIEWER_SETTINGS);
viewer.scrollToItem(document.files[0]?.id ?? "");
```

The package build deliberately keeps `@pierre/diffs` external. Final webview builds resolve it
and retain Rolldown's natural Shiki language chunk splitting.
