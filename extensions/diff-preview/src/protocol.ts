export const VIEW_TYPE = "vscode-plugins-diff-preview.preview";
export const CONFIG_SECTION = "diffPreview";
export const OPEN_PREVIEW_COMMAND = "vscode-plugins-diff-preview.openPreview";
export const OPEN_PREVIEW_TO_SIDE_COMMAND = "vscode-plugins-diff-preview.openPreviewToSide";

export const DIFF_STYLES = ["split", "unified"] as const;
export const OVERFLOW_MODES = ["scroll", "wrap"] as const;
export const THEME_TYPES = ["system", "light", "dark"] as const;
export const HIGHLIGHTER_TYPES = ["shiki-js", "shiki-wasm"] as const;
export const DIFF_INDICATORS = ["classic", "bars", "none"] as const;
export const HUNK_SEPARATORS = ["simple", "metadata", "line-info", "line-info-basic"] as const;
export const LINE_DIFF_TYPES = ["word-alt", "word", "char", "none"] as const;
export const LINE_HOVER_HIGHLIGHTS = ["disabled", "both", "number", "line"] as const;

export type DiffStyle = (typeof DIFF_STYLES)[number];
export type OverflowMode = (typeof OVERFLOW_MODES)[number];
export type ThemeType = (typeof THEME_TYPES)[number];
export type HighlighterType = (typeof HIGHLIGHTER_TYPES)[number];
export type DiffIndicators = (typeof DIFF_INDICATORS)[number];
export type HunkSeparators = (typeof HUNK_SEPARATORS)[number];
export type LineDiffType = (typeof LINE_DIFF_TYPES)[number];
export type LineHoverHighlight = (typeof LINE_HOVER_HIGHLIGHTS)[number];

export interface DiffPreviewSettings {
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
  showToolbar: boolean;
  showStats: boolean;
  collapsedContextThreshold: number;
  expansionLineCount: number;
  maxLineDiffLength: number;
  tokenizeMaxLineLength: number;
  tokenizeMaxLength: number;
  maxFileSizeBytes: number;
  customCss: string;
}

export interface DiffPreviewUpdateMessage {
  type: "update";
  documentUri: string;
  fileName: string;
  text: string;
  version: number;
  sizeBytes: number;
  tooLarge: boolean;
  settings: DiffPreviewSettings;
}

export interface DiffPreviewReadyMessage {
  type: "ready";
}

export interface DiffPreviewRevealTextMessage {
  type: "revealText";
  documentUri: string;
}

export type DiffPreviewWebviewToExtensionMessage =
  | DiffPreviewReadyMessage
  | DiffPreviewRevealTextMessage;

export type DiffPreviewExtensionToWebviewMessage = DiffPreviewUpdateMessage;
