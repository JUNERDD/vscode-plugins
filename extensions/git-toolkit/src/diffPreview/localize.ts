import * as vscode from "vscode";

export interface DiffPreviewWebviewStrings {
  title: string;
  layoutLabel: string;
  splitLayout: string;
  unifiedLayout: string;
  toggleLineWrappingTitle: string;
  wrapButton: string;
  toggleLineNumbersTitle: string;
  lineNumberButton: string;
  toggleFileHeadersTitle: string;
  fileHeaderButton: string;
  openTextButton: string;
  loadingPreview: string;
  loadingRenderer: string;
  unableLoadRenderer: string;
  unableParseDiff: string;
  tooLarge: string;
  stats: string;
}

export function getWebviewStrings(): DiffPreviewWebviewStrings {
  return {
    title: vscode.l10n.t("Diff Preview"),
    layoutLabel: vscode.l10n.t("Layout"),
    splitLayout: vscode.l10n.t("Split"),
    unifiedLayout: vscode.l10n.t("Unified"),
    toggleLineWrappingTitle: vscode.l10n.t("Toggle line wrapping"),
    wrapButton: vscode.l10n.t("Wrap"),
    toggleLineNumbersTitle: vscode.l10n.t("Toggle line numbers"),
    lineNumberButton: "#",
    toggleFileHeadersTitle: vscode.l10n.t("Toggle file headers"),
    fileHeaderButton: vscode.l10n.t("Header"),
    openTextButton: vscode.l10n.t("Open Text"),
    loadingPreview: vscode.l10n.t("Loading Diff Preview..."),
    loadingRenderer: vscode.l10n.t("Loading diff renderer..."),
    unableLoadRenderer: vscode.l10n.t("Unable to load diff renderer."),
    unableParseDiff: vscode.l10n.t("Unable to parse diff file."),
    tooLarge: vscode.l10n.t("{fileName} is {size}, above gitToolkit.diffPreview.maxFileSizeBytes."),
    stats: vscode.l10n.t("Files: {files}  +{additions}  -{deletions}  Hunks: {hunks}  {size}"),
  };
}

export function getDiffFileFilterLabel(): string {
  return vscode.l10n.t("Diff files");
}

export function getReadFailureText(uri: vscode.Uri, message: string): string {
  return vscode.l10n.t("Unable to read {uri}\n\n{message}", {
    message,
    uri: uri.toString(),
  });
}
