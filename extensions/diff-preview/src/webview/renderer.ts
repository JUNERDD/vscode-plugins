import { CodeView, parsePatchFiles, processFile } from "@pierre/diffs";
import type { CodeViewItem, CodeViewOptions, FileDiffMetadata, Hunk } from "@pierre/diffs";

import type { DiffPreviewSettings } from "../protocol";

export interface DiffStats {
  files: number;
  additions: number;
  deletions: number;
  hunks: number;
}

interface ParseResult {
  items: CodeViewItem[];
  stats: DiffStats;
}

export interface RenderRequest {
  settings: DiffPreviewSettings;
  sizeBytes: number;
  text: string;
  version: number;
}

export class DiffPreviewRuntime {
  private codeView: CodeView | undefined;

  constructor(private readonly viewer: HTMLElement) {}

  render(request: RenderRequest): DiffStats {
    const parsed = parseDiffDocument(request.text, request.version);

    if (parsed.items.length === 0) {
      throw new Error("No file diffs were found in this document.");
    }

    if (this.codeView == null) {
      this.codeView = new CodeView(toCodeViewOptions(request.settings));
      this.codeView.setup(this.viewer);
    } else {
      this.codeView.setOptions(toCodeViewOptions(request.settings));
    }

    this.codeView.setItems(parsed.items);
    this.codeView.render(true);

    return parsed.stats;
  }

  cleanUp(): void {
    if (this.codeView != null) {
      this.codeView.cleanUp();
      this.codeView = undefined;
    }

    this.viewer.textContent = "";
  }
}

function parseDiffDocument(text: string, version: number): ParseResult {
  const patches = parsePatchFiles(text, `diff-preview:${version}`, true);
  const items: CodeViewItem[] = [];
  const stats: DiffStats = {
    files: 0,
    additions: 0,
    deletions: 0,
    hunks: 0,
  };

  for (const [patchIndex, patch] of patches.entries()) {
    for (const [fileIndex, fileDiff] of patch.files.entries()) {
      stats.files += 1;
      addFileStats(stats, fileDiff);
      items.push({
        id: `${patchIndex}:${fileIndex}:${fileDiff.prevName ?? ""}:${fileDiff.name}`,
        type: "diff",
        fileDiff,
        version,
      });
    }
  }

  if (items.length === 0) {
    const singleFile = processFile(text, {
      cacheKey: `diff-preview:${version}:single`,
      throwOnError: true,
    });

    if (singleFile != null) {
      stats.files = 1;
      addFileStats(stats, singleFile);
      items.push({
        id: `single:${singleFile.prevName ?? ""}:${singleFile.name}`,
        type: "diff",
        fileDiff: singleFile,
        version,
      });
    }
  }

  return { items, stats };
}

function addFileStats(stats: DiffStats, fileDiff: FileDiffMetadata): void {
  stats.hunks += fileDiff.hunks.length;

  for (const hunk of fileDiff.hunks) {
    const counts = countHunkChanges(hunk);
    stats.additions += counts.additions;
    stats.deletions += counts.deletions;
  }
}

function countHunkChanges(hunk: Hunk): Pick<DiffStats, "additions" | "deletions"> {
  let additions = 0;
  let deletions = 0;

  for (const content of hunk.hunkContent) {
    if (content.type === "change") {
      additions += content.additions;
      deletions += content.deletions;
    }
  }

  return { additions, deletions };
}

function toCodeViewOptions(settings: DiffPreviewSettings): CodeViewOptions<undefined> {
  return {
    theme: {
      dark: settings.darkTheme,
      light: settings.lightTheme,
    },
    themeType: settings.themeType,
    preferredHighlighter: settings.preferredHighlighter,
    diffStyle: settings.defaultStyle,
    overflow: settings.overflow,
    diffIndicators: settings.diffIndicators,
    hunkSeparators: settings.hunkSeparators,
    lineDiffType: settings.lineDiffType,
    lineHoverHighlight: settings.lineHoverHighlight,
    disableLineNumbers: settings.disableLineNumbers,
    disableFileHeader: settings.disableFileHeader,
    disableBackground: settings.disableBackground,
    expandUnchanged: settings.expandUnchanged,
    enableLineSelection: settings.enableLineSelection,
    enableGutterUtility: settings.enableGutterUtility,
    useTokenTransformer: settings.useTokenTransformer,
    enableTokenInteractionsOnWhitespace: settings.enableTokenInteractionsOnWhitespace,
    disableVirtualizationBuffers: settings.disableVirtualizationBuffers,
    stickyHeaders: settings.stickyHeaders,
    pointerEventsOnScroll: settings.pointerEventsOnScroll,
    collapsedContextThreshold: settings.collapsedContextThreshold,
    expansionLineCount: settings.expansionLineCount,
    maxLineDiffLength: settings.maxLineDiffLength,
    tokenizeMaxLineLength: settings.tokenizeMaxLineLength,
    tokenizeMaxLength: settings.tokenizeMaxLength,
    unsafeCSS: settings.customCss,
  };
}
