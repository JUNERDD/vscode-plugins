import * as vscode from "vscode";

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
  return {
    defaultStyle: enumValue(reader, "view.defaultStyle", DIFF_STYLES, "split"),
    overflow: enumValue(reader, "view.overflow", OVERFLOW_MODES, "scroll"),
    themeType: enumValue(reader, "view.themeType", THEME_TYPES, "system"),
    darkTheme: nonEmptyString(reader.get("view.darkTheme", "pierre-dark"), "pierre-dark"),
    lightTheme: nonEmptyString(reader.get("view.lightTheme", "pierre-light"), "pierre-light"),
    preferredHighlighter: enumValue(
      reader,
      "view.preferredHighlighter",
      HIGHLIGHTER_TYPES,
      "shiki-js",
    ),
    diffIndicators: enumValue(reader, "view.diffIndicators", DIFF_INDICATORS, "classic"),
    hunkSeparators: enumValue(reader, "view.hunkSeparators", HUNK_SEPARATORS, "line-info"),
    lineDiffType: enumValue(reader, "view.lineDiffType", LINE_DIFF_TYPES, "word"),
    lineHoverHighlight: enumValue(reader, "view.lineHoverHighlight", LINE_HOVER_HIGHLIGHTS, "line"),
    disableLineNumbers: booleanValue(reader.get("view.disableLineNumbers", false)),
    disableFileHeader: booleanValue(reader.get("view.disableFileHeader", false)),
    disableBackground: booleanValue(reader.get("view.disableBackground", false)),
    expandUnchanged: booleanValue(reader.get("view.expandUnchanged", false)),
    enableLineSelection: booleanValue(reader.get("view.enableLineSelection", true)),
    enableGutterUtility: booleanValue(reader.get("view.enableGutterUtility", false)),
    useTokenTransformer: booleanValue(reader.get("view.useTokenTransformer", false)),
    enableTokenInteractionsOnWhitespace: booleanValue(
      reader.get("view.enableTokenInteractionsOnWhitespace", false),
    ),
    disableVirtualizationBuffers: booleanValue(
      reader.get("view.disableVirtualizationBuffers", false),
    ),
    stickyHeaders: booleanValue(reader.get("view.stickyHeaders", true)),
    pointerEventsOnScroll: booleanValue(reader.get("view.pointerEventsOnScroll", false)),
    showToolbar: booleanValue(reader.get("view.showToolbar", true)),
    showStats: booleanValue(reader.get("view.showStats", true)),
    collapsedContextThreshold: integerValue(
      reader.get("view.collapsedContextThreshold", 1),
      0,
      10000,
      1,
    ),
    expansionLineCount: integerValue(reader.get("view.expansionLineCount", 20), 1, 10000, 20),
    maxLineDiffLength: integerValue(reader.get("view.maxLineDiffLength", 5000), 1, 100000, 5000),
    tokenizeMaxLineLength: integerValue(
      reader.get("view.tokenizeMaxLineLength", 1000),
      1,
      100000,
      1000,
    ),
    tokenizeMaxLength: integerValue(
      reader.get("view.tokenizeMaxLength", 100000),
      1,
      10000000,
      100000,
    ),
    maxFileSizeBytes: integerValue(
      reader.get("view.maxFileSizeBytes", 10485760),
      1,
      104857600,
      10485760,
    ),
    customCss: stringValue(reader.get("view.customCss", "")),
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
