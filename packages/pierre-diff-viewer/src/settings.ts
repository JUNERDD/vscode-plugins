/** Supported side-by-side and stacked diff layouts. */
export const DIFF_STYLES = ["split", "unified"] as const;

/** Supported horizontal overflow behaviors. */
export const OVERFLOW_MODES = ["scroll", "wrap"] as const;

/** Supported theme-selection modes. */
export const THEME_TYPES = ["system", "light", "dark"] as const;

/** Shiki engines exposed by Pierre Diffs. */
export const HIGHLIGHTER_TYPES = ["shiki-js", "shiki-wasm"] as const;

/** Supported markers for added and deleted lines. */
export const DIFF_INDICATORS = ["classic", "bars", "none"] as const;

/** Built-in hunk separator variants supported by `CodeView`. */
export const HUNK_SEPARATORS = ["simple", "metadata", "line-info", "line-info-basic"] as const;

/** Supported granularities for inline change highlighting. */
export const LINE_DIFF_TYPES = ["word-alt", "word", "char", "none"] as const;

/** Supported hover-highlight scopes for diff lines. */
export const LINE_HOVER_HIGHLIGHTS = ["disabled", "both", "number", "line"] as const;

/** Diff layout rendered by Pierre. */
export type DiffStyle = (typeof DIFF_STYLES)[number];

/** Horizontal overflow behavior for rendered lines. */
export type OverflowMode = (typeof OVERFLOW_MODES)[number];

/** Theme mode used to choose between configured light and dark themes. */
export type ThemeType = (typeof THEME_TYPES)[number];

/** Shiki engine used by Pierre. */
export type HighlighterType = (typeof HIGHLIGHTER_TYPES)[number];

/** Added/deleted line indicator style. */
export type DiffIndicators = (typeof DIFF_INDICATORS)[number];

/** Hunk separator style. */
export type HunkSeparators = (typeof HUNK_SEPARATORS)[number];

/** Inline change comparison granularity. */
export type LineDiffType = (typeof LINE_DIFF_TYPES)[number];

/** Line region highlighted on hover. */
export type LineHoverHighlight = (typeof LINE_HOVER_HIGHLIGHTS)[number];

/**
 * Serializable options shared by every Pierre `CodeView` consumer in the workspace.
 *
 * UI policies such as toolbars and document-size limits intentionally live with each consumer.
 */
export interface DiffViewerSettings {
  defaultStyle: DiffStyle;
  overflow: OverflowMode;
  themeType: ThemeType;
  darkTheme: string;
  lightTheme: string;
  preferredHighlighter: HighlighterType;
  diffIndicators: DiffIndicators;
  hunkSeparators: HunkSeparators;
  lineDiffType: LineDiffType;
  lineHoverHighlight: LineHoverHighlight;
  disableLineNumbers: boolean;
  disableFileHeader: boolean;
  disableBackground: boolean;
  expandUnchanged: boolean;
  enableLineSelection: boolean;
  enableGutterUtility: boolean;
  useTokenTransformer: boolean;
  enableTokenInteractionsOnWhitespace: boolean;
  disableVirtualizationBuffers: boolean;
  stickyHeaders: boolean;
  pointerEventsOnScroll: boolean;
  collapsedContextThreshold: number;
  expansionLineCount: number;
  maxLineDiffLength: number;
  tokenizeMaxLineLength: number;
  tokenizeMaxLength: number;
  customCss: string;
}

/** Defaults retained from the original diff-preview extension configuration contract. */
export const DEFAULT_DIFF_VIEWER_SETTINGS: Readonly<DiffViewerSettings> = Object.freeze({
  defaultStyle: "split",
  overflow: "scroll",
  themeType: "system",
  darkTheme: "pierre-dark",
  lightTheme: "pierre-light",
  preferredHighlighter: "shiki-js",
  diffIndicators: "classic",
  hunkSeparators: "line-info",
  lineDiffType: "word",
  lineHoverHighlight: "line",
  disableLineNumbers: false,
  disableFileHeader: false,
  disableBackground: false,
  expandUnchanged: false,
  enableLineSelection: true,
  enableGutterUtility: false,
  useTokenTransformer: false,
  enableTokenInteractionsOnWhitespace: false,
  disableVirtualizationBuffers: false,
  stickyHeaders: true,
  pointerEventsOnScroll: false,
  collapsedContextThreshold: 1,
  expansionLineCount: 20,
  maxLineDiffLength: 5000,
  tokenizeMaxLineLength: 1000,
  tokenizeMaxLength: 100000,
  customCss: "",
});
