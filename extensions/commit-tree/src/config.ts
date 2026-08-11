import {
  DEFAULT_DIFF_VIEWER_SETTINGS,
  type DiffViewerSettings,
} from "@vscode-plugins/pierre-diff-viewer";
import * as vscode from "vscode";

import { CONFIG_SECTION } from "./protocol";
import type { CommitTreeSettings } from "./protocol";

interface ConfigurationReader {
  get<T>(section: string, defaultValue: T): T;
}

export function readCommitTreeSettings(): CommitTreeSettings {
  return settingsFromReader(vscode.workspace.getConfiguration(CONFIG_SECTION));
}

export function settingsFromReader(reader: ConfigurationReader): CommitTreeSettings {
  const defaultStyle = enumValue(
    reader,
    "view.defaultStyle",
    ["split", "unified"] as const,
    "split",
  );
  const overflow = enumValue(reader, "view.overflow", ["scroll", "wrap"] as const, "scroll");
  const diff = {
    ...DEFAULT_DIFF_VIEWER_SETTINGS,
    defaultStyle,
    overflow,
    stickyHeaders: booleanValue(reader.get("view.stickyHeaders", true)),
  } satisfies DiffViewerSettings;

  return {
    diff,
    flattenEmptyDirectories: booleanValue(reader.get("view.flattenEmptyDirectories", true)),
    maxPatchSizeBytes: integerValue(
      reader.get("view.maxPatchSizeBytes", 26214400),
      1048576,
      104857600,
      26214400,
    ),
    treeWidth: integerValue(reader.get("view.treeWidth", 280), 180, 600, 280),
  };
}

function enumValue<TValues extends readonly string[]>(
  reader: ConfigurationReader,
  section: string,
  values: TValues,
  fallback: TValues[number],
): TValues[number] {
  const value = reader.get(section, fallback);
  return values.includes(value) ? value : fallback;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function integerValue(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}
