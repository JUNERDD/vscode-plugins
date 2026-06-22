# Diff Preview

VS Code custom editor for previewing `.diff` and `.patch` files with
[`@pierre/diffs`](https://diffs.com/docs).

## Features

- Opens `.diff` and `.patch` files as a read-only custom preview.
- Renders multi-file patches with split or unified layouts.
- Supports Shiki themes through `@pierre/diffs`.
- Refreshes when the backing text document or `diffPreview.*` settings change.
- Keeps temporary layout toggles inside the Webview session.

## Commands

- `Diff Preview: Open Preview`
- `Diff Preview: Open Preview to Side`

## Configuration

All settings are under `diffPreview.view.*`. The main settings are:

- `defaultStyle`: `split` or `unified`
- `overflow`: `scroll` or `wrap`
- `themeType`, `darkTheme`, `lightTheme`
- `preferredHighlighter`
- `diffIndicators`, `hunkSeparators`, `lineDiffType`
- `disableLineNumbers`, `disableFileHeader`, `disableBackground`
- `expandUnchanged`, `enableLineSelection`, `enableGutterUtility`
- `tokenizeMaxLineLength`, `tokenizeMaxLength`, `maxLineDiffLength`
- `maxFileSizeBytes`
- `customCss`
