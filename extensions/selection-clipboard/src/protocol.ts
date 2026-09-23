/** Command ID namespace shared by the manifest, registration, and tests. */
const COMMAND_PREFIX = "vscode-plugins-selection-clipboard";

export const COPY_LOCATION_COMMAND = `${COMMAND_PREFIX}.copyLocation`;
export const ADD_SELECTION_COMMAND = `${COMMAND_PREFIX}.addSelection`;
export const COPY_ALL_COMMAND = `${COMMAND_PREFIX}.copyAll`;
export const CLEAR_ALL_COMMAND = `${COMMAND_PREFIX}.clearAll`;
export const OPEN_ITEM_COMMAND = `${COMMAND_PREFIX}.openItem`;
export const COPY_ITEM_COMMAND = `${COMMAND_PREFIX}.copyItem`;
export const EDIT_NOTE_COMMAND = `${COMMAND_PREFIX}.editNote`;
export const UPDATE_RANGE_COMMAND = `${COMMAND_PREFIX}.updateRange`;
export const MOVE_UP_COMMAND = `${COMMAND_PREFIX}.moveUp`;
export const MOVE_DOWN_COMMAND = `${COMMAND_PREFIX}.moveDown`;
export const REMOVE_ITEM_COMMAND = `${COMMAND_PREFIX}.removeItem`;

/** Every contributed command, in manifest order. */
export const ALL_COMMANDS = [
  COPY_LOCATION_COMMAND,
  ADD_SELECTION_COMMAND,
  COPY_ALL_COMMAND,
  CLEAR_ALL_COMMAND,
  OPEN_ITEM_COMMAND,
  COPY_ITEM_COMMAND,
  EDIT_NOTE_COMMAND,
  UPDATE_RANGE_COMMAND,
  MOVE_UP_COMMAND,
  MOVE_DOWN_COMMAND,
  REMOVE_ITEM_COMMAND,
] as const;

/** Editor context submenu that groups the selection actions under one entry. */
export const EDITOR_CONTEXT_SUBMENU_ID = "selectionClipboard.editorContext";

export const VIEW_CONTAINER_ID = "selectionClipboard";
export const ITEMS_VIEW_ID = "selectionClipboard.items";

/** `contextValue` assigned to list entries; menus key item actions off it. */
export const ITEM_CONTEXT_VALUE = "selectionItem";

/** workspaceState key holding a {@link PersistedSelections} document. */
export const ITEMS_STATE_KEY = "selectionClipboard.items";
export const PERSISTED_SELECTIONS_VERSION = 1;

export const CONFIGURATION_SECTION = "selectionClipboard";
export const LOCATION_STYLE_SETTING = "locationStyle";
export const PATH_STYLE_SETTING = "pathStyle";
export const INCLUDE_CODE_SETTING = "includeCode";

/** Maximum UTF-16 code units kept per code snapshot before truncation. */
export const MAX_SNAPSHOT_LENGTH = 20_000;

/**
 * How a range is rendered:
 * - `lineColumn`: `path:12:5-14:20`
 * - `lineRange`: `path:12-14` (`path:12` on one line)
 * - `githubAnchor`: `path#L12C5-L14C20`
 */
export type LocationStyle = "lineColumn" | "lineRange" | "githubAnchor";

/** `workspaceRelative` falls back to the absolute path outside any workspace folder. */
export type PathStyle = "workspaceRelative" | "absolute";

export interface FormatOptions {
  locationStyle: LocationStyle;
  includeCode: boolean;
}

/**
 * Raw VS Code range coordinates: 0-based lines and UTF-16 character offsets,
 * with an exclusive end, exactly as `vscode.Range` reports them.
 */
export interface SelectionRange {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

/** One collected selection. Coordinates and text are a snapshot taken at collection time. */
export interface SelectionItem {
  /** Stable identity used by tree items and commands; from `crypto.randomUUID()`. */
  id: string;
  /** `vscode.Uri.toString()` of the source document. */
  uri: string;
  range: SelectionRange;
  /** Selected text at collection time, capped at {@link MAX_SNAPSHOT_LENGTH}. */
  text: string;
  /** True when {@link text} was cut to the snapshot limit. */
  truncated: boolean;
  /** Document languageId, used as the fenced code block info string. */
  languageId: string;
  note?: string;
  /** Epoch milliseconds. */
  createdAt: number;
}

/** Versioned envelope stored under {@link ITEMS_STATE_KEY}. */
export interface PersistedSelections {
  version: typeof PERSISTED_SELECTIONS_VERSION;
  items: SelectionItem[];
}
