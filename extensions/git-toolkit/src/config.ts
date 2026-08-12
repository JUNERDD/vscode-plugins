import {
  DEFAULT_DIFF_VIEWER_SETTINGS,
  DIFF_INDICATORS,
  DIFF_STYLES,
  HIGHLIGHTER_TYPES,
  HUNK_SEPARATORS,
  LINE_DIFF_TYPES,
  LINE_HOVER_HIGHLIGHTS,
  OVERFLOW_MODES,
  THEME_TYPES,
  type DiffViewerSettings,
} from "./diffViewer";
import * as vscode from "vscode";

import type { DiffPreviewSettings } from "./diffPreview/protocol";
import { CONFIG_SECTION } from "./protocol";
import type { CommitTreeSettings } from "./protocol";

interface ConfigurationReader {
  get<T>(section: string, defaultValue: T): T;
}

export function readCommitTreeSettings(): CommitTreeSettings {
  return commitTreeSettingsFromReader(vscode.workspace.getConfiguration(CONFIG_SECTION));
}

export function readPreviewSettings(): DiffPreviewSettings {
  return previewSettingsFromReader(vscode.workspace.getConfiguration(CONFIG_SECTION));
}

export function commitTreeSettingsFromReader(reader: ConfigurationReader): CommitTreeSettings {
  return {
    diff: readDiffViewerSettings(reader),
    flattenEmptyDirectories: booleanValue(reader.get("commitTree.flattenEmptyDirectories", true)),
    maxPatchSizeBytes: integerValue(
      reader.get("commitTree.maxPatchSizeBytes", 26214400),
      1048576,
      104857600,
      26214400,
    ),
    treeWidth: integerValue(reader.get("commitTree.treeWidth", 280), 180, 600, 280),
  };
}

export function previewSettingsFromReader(reader: ConfigurationReader): DiffPreviewSettings {
  return {
    ...readDiffViewerSettings(reader),
    maxFileSizeBytes: integerValue(
      reader.get("diffPreview.maxFileSizeBytes", 10485760),
      1,
      104857600,
      10485760,
    ),
    showStats: booleanValue(reader.get("diffPreview.showStats", true)),
    showToolbar: booleanValue(reader.get("diffPreview.showToolbar", true)),
  };
}

function readDiffViewerSettings(reader: ConfigurationReader): DiffViewerSettings {
  const defaults = DEFAULT_DIFF_VIEWER_SETTINGS;

  return {
    defaultStyle: enumValue(reader, "diff.defaultStyle", DIFF_STYLES, defaults.defaultStyle),
    overflow: enumValue(reader, "diff.overflow", OVERFLOW_MODES, defaults.overflow),
    themeType: enumValue(reader, "diff.themeType", THEME_TYPES, defaults.themeType),
    darkTheme: nonEmptyString(reader.get("diff.darkTheme", defaults.darkTheme), defaults.darkTheme),
    lightTheme: nonEmptyString(
      reader.get("diff.lightTheme", defaults.lightTheme),
      defaults.lightTheme,
    ),
    preferredHighlighter: enumValue(
      reader,
      "diff.preferredHighlighter",
      HIGHLIGHTER_TYPES,
      defaults.preferredHighlighter,
    ),
    diffIndicators: enumValue(
      reader,
      "diff.diffIndicators",
      DIFF_INDICATORS,
      defaults.diffIndicators,
    ),
    hunkSeparators: enumValue(
      reader,
      "diff.hunkSeparators",
      HUNK_SEPARATORS,
      defaults.hunkSeparators,
    ),
    lineDiffType: enumValue(reader, "diff.lineDiffType", LINE_DIFF_TYPES, defaults.lineDiffType),
    lineHoverHighlight: enumValue(
      reader,
      "diff.lineHoverHighlight",
      LINE_HOVER_HIGHLIGHTS,
      defaults.lineHoverHighlight,
    ),
    disableLineNumbers: booleanValue(
      reader.get("diff.disableLineNumbers", defaults.disableLineNumbers),
    ),
    disableFileHeader: booleanValue(
      reader.get("diff.disableFileHeader", defaults.disableFileHeader),
    ),
    disableBackground: booleanValue(
      reader.get("diff.disableBackground", defaults.disableBackground),
    ),
    expandUnchanged: booleanValue(reader.get("diff.expandUnchanged", defaults.expandUnchanged)),
    enableLineSelection: booleanValue(
      reader.get("diff.enableLineSelection", defaults.enableLineSelection),
    ),
    enableGutterUtility: booleanValue(
      reader.get("diff.enableGutterUtility", defaults.enableGutterUtility),
    ),
    useTokenTransformer: booleanValue(
      reader.get("diff.useTokenTransformer", defaults.useTokenTransformer),
    ),
    enableTokenInteractionsOnWhitespace: booleanValue(
      reader.get(
        "diff.enableTokenInteractionsOnWhitespace",
        defaults.enableTokenInteractionsOnWhitespace,
      ),
    ),
    disableVirtualizationBuffers: booleanValue(
      reader.get("diff.disableVirtualizationBuffers", defaults.disableVirtualizationBuffers),
    ),
    stickyHeaders: booleanValue(reader.get("diff.stickyHeaders", defaults.stickyHeaders)),
    pointerEventsOnScroll: booleanValue(
      reader.get("diff.pointerEventsOnScroll", defaults.pointerEventsOnScroll),
    ),
    collapsedContextThreshold: integerValue(
      reader.get("diff.collapsedContextThreshold", defaults.collapsedContextThreshold),
      0,
      10000,
      defaults.collapsedContextThreshold,
    ),
    expansionLineCount: integerValue(
      reader.get("diff.expansionLineCount", defaults.expansionLineCount),
      1,
      10000,
      defaults.expansionLineCount,
    ),
    maxLineDiffLength: integerValue(
      reader.get("diff.maxLineDiffLength", defaults.maxLineDiffLength),
      1,
      100000,
      defaults.maxLineDiffLength,
    ),
    tokenizeMaxLineLength: integerValue(
      reader.get("diff.tokenizeMaxLineLength", defaults.tokenizeMaxLineLength),
      1,
      100000,
      defaults.tokenizeMaxLineLength,
    ),
    tokenizeMaxLength: integerValue(
      reader.get("diff.tokenizeMaxLength", defaults.tokenizeMaxLength),
      1,
      10000000,
      defaults.tokenizeMaxLength,
    ),
    customCss: stringValue(reader.get("diff.customCss", defaults.customCss)),
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

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nonEmptyString(value: unknown, fallback: string): string {
  const normalized = stringValue(value).trim();
  return normalized.length > 0 ? normalized : fallback;
}

function integerValue(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}
