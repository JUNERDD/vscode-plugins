import * as path from "node:path";
import * as vscode from "vscode";

import { readCommitTreeSettings } from "./config";
import { getWebviewStrings } from "./localize";
import type { CommitSnapshot, CommitTreeExtensionToWebviewMessage } from "./protocol";
import { CONFIG_SECTION, isCommitTreeWebviewToExtensionMessage, VIEW_TYPE } from "./protocol";
import { buildWebviewHtml } from "./webviewHtml";

export class CommitPanelManager implements vscode.Disposable {
  private readonly panels = new Map<string, CommitPanel>();

  constructor(private readonly extensionUri: vscode.Uri) {}

  open(commit: CommitSnapshot): void {
    const key = getCommitKey(commit);
    const existing = this.panels.get(key);

    if (existing != null) {
      existing.reveal();
      return;
    }

    const panel = new CommitPanel(this.extensionUri, commit, () => this.panels.delete(key));
    this.panels.set(key, panel);
  }

  dispose(): void {
    for (const panel of this.panels.values()) {
      panel.dispose();
    }

    this.panels.clear();
  }
}

class CommitPanel implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private disposed = false;

  private readonly panel: vscode.WebviewPanel;

  constructor(
    extensionUri: vscode.Uri,
    private readonly commit: CommitSnapshot,
    onDispose: () => void,
  ) {
    this.panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      `${commit.shortHash} · ${commit.subject}`,
      vscode.ViewColumn.Active,
      {
        enableFindWidget: true,
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist")],
        retainContextWhenHidden: false,
      },
    );
    this.panel.webview.html = buildWebviewHtml(
      this.panel.webview,
      extensionUri,
      getWebviewStrings(),
    );

    this.disposables.push(
      this.panel.webview.onDidReceiveMessage((message: unknown) => {
        if (!isCommitTreeWebviewToExtensionMessage(message)) {
          return;
        }

        if (message.type === "ready") {
          this.postUpdate();
          return;
        }

        if (message.type === "copyHash") {
          void copyCommitHash(this.commit.hash);
          return;
        }

        if (message.type === "openFile") {
          void openWorkingTreeFile(this.commit, message.path);
          return;
        }

        void this.copyFileName(message.path);
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(CONFIG_SECTION)) {
          this.postUpdate();
        }
      }),
      this.panel.onDidDispose(() => {
        if (this.disposed) {
          return;
        }

        this.disposed = true;
        disposeAll(this.disposables);
        onDispose();
      }),
    );
  }

  reveal(): void {
    this.panel.reveal(vscode.ViewColumn.Active, false);
  }

  dispose(): void {
    if (!this.disposed) {
      this.panel.dispose();
    }
  }

  private async copyFileName(gitPath: string): Promise<void> {
    let fileName: string | undefined;
    try {
      fileName = await copyFileNameToClipboard(gitPath);
    } catch {
      await vscode.window.showWarningMessage(vscode.l10n.t("Unable to copy file name."));
      return;
    }
    if (fileName == null) {
      return;
    }

    if (!this.disposed) {
      this.sendWebviewMessage({ type: "fileNameCopied", path: gitPath });
    }
    void vscode.window.showInformationMessage(
      vscode.l10n.t("File name copied: {name}", { name: fileName }),
    );
  }

  private sendWebviewMessage(message: CommitTreeExtensionToWebviewMessage): void {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- VS Code Webview.postMessage has no targetOrigin parameter.
    void this.panel.webview.postMessage(message);
  }

  private postUpdate(): void {
    this.sendWebviewMessage({
      type: "update" as const,
      commit: this.commit,
      settings: readCommitTreeSettings(),
    });
  }
}

async function copyCommitHash(hash: string): Promise<void> {
  await vscode.env.clipboard.writeText(hash);
  await vscode.window.showInformationMessage(vscode.l10n.t("Commit hash copied."));
}

async function openWorkingTreeFile(commit: CommitSnapshot, gitPath: string): Promise<void> {
  const targetUri = resolveWorkingTreeFileUri(commit.repositoryUri, gitPath);
  if (targetUri == null) {
    return;
  }

  try {
    await vscode.workspace.fs.stat(targetUri);
    await vscode.commands.executeCommand("vscode.open", targetUri);
  } catch {
    await vscode.window.showWarningMessage(
      vscode.l10n.t(
        "Unable to open {path} from the working tree. The file may have been moved or deleted.",
        { path: gitPath },
      ),
    );
  }
}

async function copyFileNameToClipboard(gitPath: string): Promise<string | undefined> {
  const segments = parseSafeGitPath(gitPath);
  const fileName = segments?.at(-1);
  if (fileName == null) {
    return undefined;
  }

  await vscode.env.clipboard.writeText(fileName);
  return fileName;
}

function resolveWorkingTreeFileUri(repositoryUri: string, gitPath: string): vscode.Uri | undefined {
  const segments = parseSafeGitPath(gitPath);
  if (segments == null) {
    return undefined;
  }

  const rootUri = vscode.Uri.parse(repositoryUri);
  if (rootUri.scheme !== "file") {
    return undefined;
  }

  const targetPath = path.resolve(rootUri.fsPath, ...segments);
  const relativePath = path.relative(rootUri.fsPath, targetPath);
  if (
    relativePath.length === 0 ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return undefined;
  }

  return vscode.Uri.file(targetPath);
}

function parseSafeGitPath(gitPath: string): readonly string[] | undefined {
  if (
    gitPath.length === 0 ||
    gitPath.includes("\0") ||
    gitPath.includes("\\") ||
    path.posix.isAbsolute(gitPath)
  ) {
    return undefined;
  }

  const segments = gitPath.split("/");
  return segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
    ? undefined
    : segments;
}

function getCommitKey(commit: CommitSnapshot): string {
  return `${commit.repositoryUri}\0${commit.parentHash ?? ""}\0${commit.hash}`;
}

function disposeAll(disposables: readonly vscode.Disposable[]): void {
  for (const disposable of disposables) {
    disposable.dispose();
  }
}
