import * as vscode from "vscode";

export interface CommitTreeWebviewStrings {
  readonly additionsLabel: string;
  readonly changedFiles: string;
  readonly closeFileTreeTitle: string;
  readonly commitMessageLabel: string;
  readonly copyFileNameTitle: string;
  readonly copyFolderNameTitle: string;
  readonly copyHashTitle: string;
  readonly deletionsLabel: string;
  readonly documentTitle: string;
  readonly emptyCommit: string;
  readonly fileActionsLabel: string;
  readonly fileNameCopiedLabel: string;
  readonly fileTreeLabel: string;
  readonly layoutLabel: string;
  readonly loadingCommit: string;
  readonly loadingRenderer: string;
  readonly openFileTreeTitle: string;
  readonly openWorkingTreeFileTitle: string;
  readonly resizeFileTreeLabel: string;
  readonly searchChangedFilesLabel: string;
  readonly splitLayout: string;
  readonly toggleLineWrappingTitle: string;
  readonly unifiedLayout: string;
  readonly unableRender: string;
  readonly wrapButton: string;
}

export function getWebviewStrings(): CommitTreeWebviewStrings {
  return {
    additionsLabel: vscode.l10n.t("additions"),
    changedFiles: vscode.l10n.t("{files} changed files"),
    closeFileTreeTitle: vscode.l10n.t("Close file tree"),
    commitMessageLabel: vscode.l10n.t("Commit message"),
    copyFileNameTitle: vscode.l10n.t("Copy file name"),
    copyFolderNameTitle: vscode.l10n.t("Copy folder name"),
    copyHashTitle: vscode.l10n.t("Copy full commit hash"),
    deletionsLabel: vscode.l10n.t("deletions"),
    documentTitle: vscode.l10n.t("Commit Tree"),
    emptyCommit: vscode.l10n.t("This commit has no file changes."),
    fileActionsLabel: vscode.l10n.t("File actions"),
    fileNameCopiedLabel: vscode.l10n.t("File name copied"),
    fileTreeLabel: vscode.l10n.t("Changed files"),
    layoutLabel: vscode.l10n.t("Diff layout"),
    loadingCommit: vscode.l10n.t("Loading commit..."),
    loadingRenderer: vscode.l10n.t("Loading Pierre diff renderer..."),
    openFileTreeTitle: vscode.l10n.t("Open file tree"),
    openWorkingTreeFileTitle: vscode.l10n.t("Open working tree file"),
    resizeFileTreeLabel: vscode.l10n.t("Resize file tree"),
    searchChangedFilesLabel: vscode.l10n.t("Search changed files"),
    splitLayout: vscode.l10n.t("Split"),
    toggleLineWrappingTitle: vscode.l10n.t("Toggle line wrapping"),
    unifiedLayout: vscode.l10n.t("Unified"),
    unableRender: vscode.l10n.t("Unable to render this commit."),
    wrapButton: vscode.l10n.t("Wrap"),
  };
}
