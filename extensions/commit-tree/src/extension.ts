import * as vscode from "vscode";

import { loadCommitSnapshot } from "./commitLoader";
import {
  getCommandUri,
  getGitApi,
  parseScmHistoryItemUri,
  pickCommitRef,
  pickRepository,
} from "./gitApi";
import { GitOutputLimitError } from "./gitRunner";
import { CommitPanelManager } from "./panel";
import { OPEN_COMMIT_COMMAND, OPEN_FROM_HISTORY_COMMAND } from "./protocol";
import { readCommitTreeSettings } from "./config";

export function activate(context: vscode.ExtensionContext): void {
  const panels = new CommitPanelManager(context.extensionUri);

  context.subscriptions.push(
    panels,
    vscode.commands.registerCommand(OPEN_COMMIT_COMMAND, (argument?: unknown) =>
      openCommit(panels, argument),
    ),
    vscode.commands.registerCommand(OPEN_FROM_HISTORY_COMMAND, (argument?: unknown) =>
      openCommit(panels, argument),
    ),
  );
}

export function deactivate(): void {}

async function openCommit(panels: CommitPanelManager, argument?: unknown): Promise<void> {
  try {
    const api = await getGitApi();
    const commandUri = getCommandUri(argument);
    const historyTarget = commandUri == null ? undefined : parseScmHistoryItemUri(commandUri);
    const preferredUri =
      historyTarget?.repositoryUri ??
      (commandUri?.scheme === "file" ? commandUri : vscode.window.activeTextEditor?.document.uri);
    const repository =
      historyTarget == null
        ? await pickRepository(api, preferredUri)
        : api.getRepository(historyTarget.repositoryUri);

    if (repository == null) {
      if (historyTarget != null) {
        throw new Error(vscode.l10n.t("The commit repository is not open in this window."));
      }
      return;
    }

    const commitRef = historyTarget?.commitRef ?? (await pickCommitRef(repository));
    if (commitRef == null) {
      return;
    }

    const settings = readCommitTreeSettings();
    const commit = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t("Opening commit {ref} as a file tree...", {
          ref: commitRef.slice(0, 12),
        }),
      },
      () =>
        loadCommitSnapshot({
          commitRef,
          gitPath: api.git.path,
          maxPatchSizeBytes: settings.maxPatchSizeBytes,
          ...(historyTarget?.parentRef == null ? {} : { parentRef: historyTarget.parentRef }),
          repository,
        }),
    );

    panels.open(commit);
  } catch (error) {
    const message = formatOpenError(error);
    void vscode.window.showErrorMessage(message);
  }
}

function formatOpenError(error: unknown): string {
  if (error instanceof GitOutputLimitError) {
    return vscode.l10n.t("This commit patch is larger than the configured limit ({size}).", {
      size: formatBytes(error.limitBytes),
    });
  }

  const detail = error instanceof Error ? error.message : String(error);
  return vscode.l10n.t("Unable to open commit: {detail}", { detail });
}

function formatBytes(bytes: number): string {
  const mebibytes = bytes / (1024 * 1024);
  return mebibytes >= 1 ? `${mebibytes.toFixed(1)} MiB` : `${Math.round(bytes / 1024)} KiB`;
}
