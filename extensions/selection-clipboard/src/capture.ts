import * as vscode from "vscode";

import { compareRanges, normalizeRange } from "./location";
import type { SelectionRange } from "./protocol";
import type { NewSelection } from "./store";

/**
 * Snapshots one editor range. The range is normalized first (whole-line
 * selections lose their phantom trailing line) so the stored coordinates, the
 * captured text, and the rendered location all describe the same characters.
 */
export function captureSelection(document: vscode.TextDocument, range: vscode.Range): NewSelection {
  const normalized = normalizeRange(
    {
      startLine: range.start.line,
      startCharacter: range.start.character,
      endLine: range.end.line,
      endCharacter: range.end.character,
    },
    (line) => document.lineAt(line).text.length,
  );
  return {
    uri: document.uri.toString(),
    range: normalized,
    text: document.getText(toVscodeRange(normalized)),
    languageId: document.languageId,
  };
}

/** Every selection of the editor in document order (VS Code reports multi-cursor in creation order). */
export function captureSelections(editor: vscode.TextEditor): NewSelection[] {
  return editor.selections
    .map((selection) => captureSelection(editor.document, selection))
    .toSorted((a, b) => compareRanges(a.range, b.range));
}

export function toVscodeRange(range: SelectionRange): vscode.Range {
  return new vscode.Range(range.startLine, range.startCharacter, range.endLine, range.endCharacter);
}
