import type { DiffViewerSettings } from "./diffViewer";

export const CONFIG_SECTION = "gitToolkit";
export const OPEN_COMMIT_COMMAND = "vscode-plugins-git-toolkit.openCommit";
export const OPEN_FROM_HISTORY_COMMAND = "vscode-plugins-git-toolkit.openFromHistory";
export const COMPARE_FILE_WITH_BRANCH_COMMAND = "vscode-plugins-git-toolkit.compareFileWithBranch";
export const VIEW_TYPE = "vscode-plugins-git-toolkit.commit";

export interface CommitSnapshot {
  readonly authorEmail?: string;
  readonly authorName?: string;
  readonly authoredAt?: string;
  readonly body?: string;
  readonly committedAt?: string;
  readonly hash: string;
  readonly parentHash?: string;
  readonly patch: string;
  readonly patchSizeBytes: number;
  readonly repositoryName: string;
  readonly repositoryUri: string;
  readonly shortHash: string;
  readonly subject: string;
}

export interface CommitTreeSettings {
  readonly diff: DiffViewerSettings;
  readonly flattenEmptyDirectories: boolean;
  readonly maxPatchSizeBytes: number;
  readonly treeWidth: number;
}

export interface CommitTreeUpdateMessage {
  readonly type: "update";
  readonly commit: CommitSnapshot;
  readonly settings: CommitTreeSettings;
}

export interface CommitTreeReadyMessage {
  readonly type: "ready";
}

export interface CommitTreeCopyHashMessage {
  readonly type: "copyHash";
}

export interface CommitTreeOpenFileMessage {
  readonly type: "openFile";
  readonly path: string;
}

export interface CommitTreeCopyFileNameMessage {
  readonly type: "copyFileName";
  readonly path: string;
}

export interface CommitTreeFileNameCopiedMessage {
  readonly type: "fileNameCopied";
  readonly path: string;
}

export interface CommitTreeShowErrorMessage {
  readonly type: "showError";
  readonly message: string;
}

export type CommitTreeWebviewToExtensionMessage =
  | CommitTreeReadyMessage
  | CommitTreeCopyHashMessage
  | CommitTreeOpenFileMessage
  | CommitTreeCopyFileNameMessage;

export type CommitTreeExtensionToWebviewMessage =
  | CommitTreeUpdateMessage
  | CommitTreeFileNameCopiedMessage
  | CommitTreeShowErrorMessage;

/** Validate messages at the webview boundary before handling their payloads. */
export function isCommitTreeWebviewToExtensionMessage(
  value: unknown,
): value is CommitTreeWebviewToExtensionMessage {
  if (typeof value !== "object" || value == null || !("type" in value)) {
    return false;
  }

  if (value.type === "ready" || value.type === "copyHash") {
    return true;
  }

  return (
    (value.type === "openFile" || value.type === "copyFileName") &&
    "path" in value &&
    typeof value.path === "string"
  );
}
