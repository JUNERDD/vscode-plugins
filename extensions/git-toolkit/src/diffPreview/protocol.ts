import type { DiffViewerSettings } from "../diffViewer/settings";

export const VIEW_TYPE = "vscode-plugins-git-toolkit.diffPreview";
export const CONFIG_SECTION = "gitToolkit";
export const OPEN_PREVIEW_COMMAND = "vscode-plugins-git-toolkit.openDiffPreview";
export const OPEN_PREVIEW_TO_SIDE_COMMAND = "vscode-plugins-git-toolkit.openDiffPreviewToSide";

export {
  DIFF_INDICATORS,
  DIFF_STYLES,
  HIGHLIGHTER_TYPES,
  HUNK_SEPARATORS,
  LINE_DIFF_TYPES,
  LINE_HOVER_HIGHLIGHTS,
  OVERFLOW_MODES,
  THEME_TYPES,
} from "../diffViewer/settings";
export type {
  DiffIndicators,
  DiffStyle,
  HighlighterType,
  HunkSeparators,
  LineDiffType,
  LineHoverHighlight,
  OverflowMode,
  ThemeType,
} from "../diffViewer/settings";

export interface DiffPreviewSettings extends DiffViewerSettings {
  showToolbar: boolean;
  showStats: boolean;
  maxFileSizeBytes: number;
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
