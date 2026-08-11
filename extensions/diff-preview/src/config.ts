import * as vscode from "vscode";
import { DEFAULT_DIFF_VIEWER_SETTINGS } from "@vscode-plugins/pierre-diff-viewer";

import {
  CONFIG_SECTION,
  DIFF_INDICATORS,
  DIFF_STYLES,
  HIGHLIGHTER_TYPES,
  HUNK_SEPARATORS,
  LINE_DIFF_TYPES,
  LINE_HOVER_HIGHLIGHTS,
  OVERFLOW_MODES,
  THEME_TYPES,
} from "./protocol";
import type { DiffPreviewSettings } from "./protocol";

interface ConfigurationReader {
  get<T>(section: string, defaultValue: T): T;
}

export function readPreviewSettings(): DiffPreviewSettings {
  return settingsFromReader(vscode.workspace.getConfiguration(CONFIG_SECTION));
}

export function settingsFromReader(reader: ConfigurationReader): DiffPreviewSettings {
  const defaults = DEFAULT_DIFF_VIEWER_SETTINGS;

  return {
    defaultStyle: enumValue(reader, "view.defaultStyle", DIFF_STYLES, defaults.defaultStyle),
    overflow: enumValue(reader, "view.overflow", OVERFLOW_MODES, defaults.overflow),
    themeType: enumValue(reader, "view.themeType", THEME_TYPES, defaults.themeType),
    darkTheme: nonEmptyString(reader.get("view.darkTheme", defaults.darkTheme), defaults.darkTheme),
    lightTheme: nonEmptyString(
      reader.get("view.lightTheme", defaults.lightTheme),
      defaults.lightTheme,
    ),
    preferredHighlighter: enumValue(
      reader,
      "view.preferredHighlighter",
      HIGHLIGHTER_TYPES,
      defaults.preferredHighlighter,
    ),
    diffIndicators: enumValue(
      reader,
      "view.diffIndicators",
      DIFF_INDICATORS,
      defaults.diffIndicators,
    ),
    hunkSeparators: enumValue(
      reader,
      "view.hunkSeparators",
      HUNK_SEPARATORS,
      defaults.hunkSeparators,
    ),
    lineDiffType: enumValue(reader, "view.lineDiffType", LINE_DIFF_TYPES, defaults.lineDiffType),
    lineHoverHighlight: enumValue(
      reader,
      "view.lineHoverHighlight",
      LINE_HOVER_HIGHLIGHTS,
      defaults.lineHoverHighlight,
    ),
    disableLineNumbers: booleanValue(
      reader.get("view.disableLineNumbers", defaults.disableLineNumbers),
    ),
    disableFileHeader: booleanValue(
      reader.get("view.disableFileHeader", defaults.disableFileHeader),
    ),
    disableBackground: booleanValue(
      reader.get("view.disableBackground", defaults.disableBackground),
    ),
    expandUnchanged: booleanValue(reader.get("view.expandUnchanged", defaults.expandUnchanged)),
    enableLineSelection: booleanValue(
      reader.get("view.enableLineSelection", defaults.enableLineSelection),
    ),
    enableGutterUtility: booleanValue(
      reader.get("view.enableGutterUtility", defaults.enableGutterUtility),
    ),
    useTokenTransformer: booleanValue(
      reader.get("view.useTokenTransformer", defaults.useTokenTransformer),
    ),
    enableTokenInteractionsOnWhitespace: booleanValue(
      reader.get(
        "view.enableTokenInteractionsOnWhitespace",
        defaults.enableTokenInteractionsOnWhitespace,
      ),
    ),
    disableVirtualizationBuffers: booleanValue(
      reader.get("view.disableVirtualizationBuffers", defaults.disableVirtualizationBuffers),
    ),
    stickyHeaders: booleanValue(reader.get("view.stickyHeaders", defaults.stickyHeaders)),
    pointerEventsOnScroll: booleanValue(
      reader.get("view.pointerEventsOnScroll", defaults.pointerEventsOnScroll),
    ),
    showToolbar: booleanValue(reader.get("view.showToolbar", true)),
    showStats: booleanValue(reader.get("view.showStats", true)),
    collapsedContextThreshold: integerValue(
      reader.get("view.collapsedContextThreshold", defaults.collapsedContextThreshold),
      0,
      10000,
      defaults.collapsedContextThreshold,
    ),
    expansionLineCount: integerValue(
      reader.get("view.expansionLineCount", defaults.expansionLineCount),
      1,
      10000,
      defaults.expansionLineCount,
    ),
    maxLineDiffLength: integerValue(
      reader.get("view.maxLineDiffLength", defaults.maxLineDiffLength),
      1,
      100000,
      defaults.maxLineDiffLength,
    ),
    tokenizeMaxLineLength: integerValue(
      reader.get("view.tokenizeMaxLineLength", defaults.tokenizeMaxLineLength),
      1,
      100000,
      defaults.tokenizeMaxLineLength,
    ),
    tokenizeMaxLength: integerValue(
      reader.get("view.tokenizeMaxLength", defaults.tokenizeMaxLength),
      1,
      10000000,
      defaults.tokenizeMaxLength,
    ),
    maxFileSizeBytes: integerValue(
      reader.get("view.maxFileSizeBytes", 10485760),
      1,
      104857600,
      10485760,
    ),
    customCss: stringValue(reader.get("view.customCss", defaults.customCss)),
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
