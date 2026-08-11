import { CodeView } from "@pierre/diffs";
import type { CodeViewOptions, FileContents, FileDiffMetadata } from "@pierre/diffs";

import type { DiffViewerItem } from "./parse";
import type { DiffViewerSettings } from "./settings";

/** Stable file identity exposed to consumer-owned diff-header metadata. */
export interface DiffViewerHeaderFile {
  readonly path: string;
  /** Previous repository-relative path when the diff represents a rename. */
  readonly previousPath?: string;
}

/** Optional consumer hooks applied throughout a viewer's lifecycle. */
export interface PierreDiffViewerOptions {
  /** Render consumer-owned metadata beside a file's built-in diff header. */
  readonly renderFileHeaderMetadata?: (file: DiffViewerHeaderFile) => Element | null | undefined;
}

type PierreHeaderMetadataRenderer = NonNullable<CodeViewOptions<undefined>["renderHeaderMetadata"]>;

/** Imperative lifecycle wrapper for a virtualized Pierre `CodeView`. */
export class PierreDiffViewer {
  private codeView: CodeView | undefined;
  private readonly renderHeaderMetadata: PierreHeaderMetadataRenderer | undefined;

  constructor(
    private readonly container: HTMLElement,
    options: PierreDiffViewerOptions = {},
  ) {
    this.renderHeaderMetadata = createHeaderMetadataRenderer(options.renderFileHeaderMetadata);
  }

  /** Render or reconcile path-addressable items with the supplied viewer settings. */
  render(items: readonly DiffViewerItem[], settings: DiffViewerSettings): void {
    if (this.codeView == null) {
      this.codeView = new CodeView(toCodeViewOptions(settings, this.renderHeaderMetadata));
      this.codeView.setup(this.container);
    } else {
      this.codeView.setOptions(toCodeViewOptions(settings, this.renderHeaderMetadata));
    }

    this.codeView.setItems(items);
    this.codeView.render(true);
  }

  /** Reveal the item identified by a `ParsedDiffFile.id`. */
  scrollToItem(id: string): void {
    this.codeView?.scrollTo({
      type: "item",
      id,
      align: "start",
      behavior: "smooth-auto",
    });
  }

  /** Release Pierre observers and rendered DOM owned by this viewer. */
  cleanUp(): void {
    this.codeView?.cleanUp();
    this.codeView = undefined;
    this.container.textContent = "";
  }
}

function createHeaderMetadataRenderer(
  renderFileHeaderMetadata: PierreDiffViewerOptions["renderFileHeaderMetadata"],
): PierreHeaderMetadataRenderer | undefined {
  if (renderFileHeaderMetadata == null) {
    return undefined;
  }

  return (file: FileContents | FileDiffMetadata) =>
    renderFileHeaderMetadata({
      path: file.name,
      ...(isFileDiffMetadata(file) && file.prevName != null ? { previousPath: file.prevName } : {}),
    });
}

function isFileDiffMetadata(file: FileContents | FileDiffMetadata): file is FileDiffMetadata {
  return "prevName" in file || "hunks" in file;
}

function toCodeViewOptions(
  settings: DiffViewerSettings,
  renderHeaderMetadata: PierreHeaderMetadataRenderer | undefined,
): CodeViewOptions<undefined> {
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
    ...(renderHeaderMetadata == null ? {} : { renderHeaderMetadata }),
  };
}
