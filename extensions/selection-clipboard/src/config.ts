import * as vscode from "vscode";

import {
  CONFIGURATION_SECTION,
  INCLUDE_CODE_SETTING,
  LOCATION_STYLE_SETTING,
  PATH_STYLE_SETTING,
  type FormatOptions,
  type LocationStyle,
  type PathStyle,
} from "./protocol";

/** Every `selectionClipboard.*` setting that affects how locations are rendered. */
export interface FormatSettings extends FormatOptions {
  pathStyle: PathStyle;
}

/** Mirrors the manifest defaults; also used when a stored value is invalid. */
export const DEFAULT_FORMAT_SETTINGS: Readonly<FormatSettings> = {
  locationStyle: "lineColumn",
  pathStyle: "workspaceRelative",
  includeCode: false,
};

const LOCATION_STYLES: readonly LocationStyle[] = ["lineColumn", "lineRange", "githubAnchor"];
const PATH_STYLES: readonly PathStyle[] = ["workspaceRelative", "absolute"];

/**
 * Reads the current settings on every call so configuration changes apply to
 * the next render or copy without restarting. Hand-edited invalid values fall
 * back to the defaults instead of producing malformed output.
 */
export function readFormatSettings(): FormatSettings {
  const config = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
  return {
    locationStyle: oneOf(
      config.get<unknown>(LOCATION_STYLE_SETTING),
      LOCATION_STYLES,
      DEFAULT_FORMAT_SETTINGS.locationStyle,
    ),
    pathStyle: oneOf(
      config.get<unknown>(PATH_STYLE_SETTING),
      PATH_STYLES,
      DEFAULT_FORMAT_SETTINGS.pathStyle,
    ),
    includeCode: config.get<unknown>(INCLUDE_CODE_SETTING) === true,
  };
}

/**
 * Path written in front of a location.
 *
 * - `workspaceRelative` delegates to `asRelativePath`, which prefixes the folder
 *   name in multi-root workspaces, returns the absolute path for files outside
 *   every folder, and yields the title of untitled documents.
 * - `absolute` uses the file system path for `file` URIs; other schemes have no
 *   file system path, so untitled documents use their title and anything else
 *   the readable URI.
 */
export function resolveDisplayPath(uri: vscode.Uri, pathStyle: PathStyle): string {
  if (pathStyle === "workspaceRelative") {
    const multiRoot = (vscode.workspace.workspaceFolders?.length ?? 0) > 1;
    return vscode.workspace.asRelativePath(uri, multiRoot);
  }
  if (uri.scheme === "file") {
    return uri.fsPath;
  }
  if (uri.scheme === "untitled") {
    return uri.path;
  }
  return uri.toString(true);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}
