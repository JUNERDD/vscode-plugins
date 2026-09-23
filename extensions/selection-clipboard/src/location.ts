import type { FormatOptions, LocationStyle, SelectionRange } from "./protocol";

/**
 * Everything the formatter needs for one clipboard entry. Kept free of
 * `vscode` types so formatting stays unit-testable without the editor runtime.
 */
export interface FormattableEntry {
  /** Display path, already resolved to workspace-relative or absolute by the caller. */
  path: string;
  range: SelectionRange;
  /** Snapshot text; an empty string suppresses the code block. */
  text: string;
  /** Used verbatim as the fenced code block info string. */
  languageId: string;
}

/** True for a caret position (no characters selected). */
export function isEmptyRange(range: SelectionRange): boolean {
  return range.startLine === range.endLine && range.startCharacter === range.endCharacter;
}

/**
 * Document-order comparator so multi-cursor selections, which VS Code reports
 * in creation order, can be emitted top to bottom.
 */
export function compareRanges(a: SelectionRange, b: SelectionRange): number {
  return (
    a.startLine - b.startLine ||
    a.startCharacter - b.startCharacter ||
    a.endLine - b.endLine ||
    a.endCharacter - b.endCharacter
  );
}

/**
 * Drops the phantom trailing line of whole-line selections. Triple-click or
 * Shift+Down leaves the end at character 0 of the following line, which would
 * otherwise render as one extra line that contains nothing selected.
 *
 * @param lineLength UTF-16 length of the given 0-based line, excluding its line break.
 * @returns A range ending at the end of the previous line when trimmed; may be
 * empty (e.g. a single blank line was selected). Callers must not rely on identity.
 */
export function normalizeRange(
  range: SelectionRange,
  lineLength: (line: number) => number,
): SelectionRange {
  if (isEmptyRange(range) || range.endCharacter !== 0 || range.endLine <= range.startLine) {
    return range;
  }
  const endLine = range.endLine - 1;
  let endCharacter = lineLength(endLine);
  // Guard against an inconsistent line length inverting the range on the start line.
  if (endLine === range.startLine) {
    endCharacter = Math.max(endCharacter, range.startCharacter);
  }
  return { ...range, endLine, endCharacter };
}

/**
 * Renders one range as a human/agent-readable location. Output is 1-based;
 * columns are raw UTF-16 offsets with no tab expansion, matching what VS Code
 * accepts in `path:line:col` links.
 */
export function formatLocation(path: string, range: SelectionRange, style: LocationStyle): string {
  const startLine = range.startLine + 1;
  const startColumn = range.startCharacter + 1;

  if (isEmptyRange(range)) {
    switch (style) {
      case "lineColumn":
        return `${path}:${startLine}:${startColumn}`;
      case "lineRange":
        return `${path}:${startLine}`;
      case "githubAnchor":
        return `${path}#L${startLine}C${startColumn}`;
    }
  }

  const endLine = range.endLine + 1;
  // A 0-based exclusive end equals the 1-based inclusive last column; an end at
  // column 0 selected nothing on that line, so show its first column instead of 0.
  const endColumn = range.endCharacter === 0 ? 1 : range.endCharacter;

  switch (style) {
    case "lineColumn":
      return `${path}:${startLine}:${startColumn}-${endLine}:${endColumn}`;
    case "lineRange":
      return startLine === endLine ? `${path}:${startLine}` : `${path}:${startLine}-${endLine}`;
    case "githubAnchor":
      return `${path}#L${startLine}C${startColumn}-L${endLine}C${endColumn}`;
  }
}

/**
 * Picks a backtick fence longer than any backtick run inside the text so
 * embedded Markdown fences cannot terminate the block early.
 */
function fenceFor(text: string): string {
  let longestRun = 0;
  for (const match of text.matchAll(/`+/g)) {
    longestRun = Math.max(longestRun, match[0].length);
  }
  return "`".repeat(Math.max(3, longestRun + 1));
}

/** Location line, followed by a fenced snapshot when code is requested and available. */
export function formatEntry(entry: FormattableEntry, options: FormatOptions): string {
  const location = formatLocation(entry.path, entry.range, options.locationStyle);
  const text = entry.text.replaceAll("\r\n", "\n");
  if (!options.includeCode || text === "") {
    return location;
  }
  const fence = fenceFor(text);
  return `${location}\n${fence}${entry.languageId}\n${text}\n${fence}`;
}

/**
 * Joins entries in caller order. Code blocks get a blank line between them so
 * the result reads as separate Markdown paragraphs.
 */
export function formatEntries(
  entries: readonly FormattableEntry[],
  options: FormatOptions,
): string {
  const separator = options.includeCode ? "\n\n" : "\n";
  return entries.map((entry) => formatEntry(entry, options)).join(separator);
}
