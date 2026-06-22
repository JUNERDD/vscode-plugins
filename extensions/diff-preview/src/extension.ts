import * as path from "node:path";
import * as vscode from "vscode";

import { readPreviewSettings } from "./config";
import {
  CONFIG_SECTION,
  OPEN_PREVIEW_COMMAND,
  OPEN_PREVIEW_TO_SIDE_COMMAND,
  VIEW_TYPE,
} from "./protocol";
import type { DiffPreviewUpdateMessage, DiffPreviewWebviewToExtensionMessage } from "./protocol";
import { buildWebviewHtml } from "./webviewHtml";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new DiffPreviewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      supportsMultipleEditorsPerDocument: true,
    }),
    vscode.commands.registerCommand(OPEN_PREVIEW_COMMAND, (uri?: vscode.Uri) =>
      openPreview(uri, vscode.ViewColumn.Active),
    ),
    vscode.commands.registerCommand(OPEN_PREVIEW_TO_SIDE_COMMAND, (uri?: vscode.Uri) =>
      openPreview(uri, vscode.ViewColumn.Beside),
    ),
  );
}

export function deactivate(): void {}

export class DiffPreviewDocument implements vscode.CustomDocument {
  constructor(readonly uri: vscode.Uri) {}

  dispose(): void {}
}

export class DiffPreviewProvider implements vscode.CustomReadonlyEditorProvider<DiffPreviewDocument> {
  constructor(private readonly extensionUri: vscode.Uri) {}

  openCustomDocument(uri: vscode.Uri): DiffPreviewDocument {
    return new DiffPreviewDocument(uri);
  }

  resolveCustomEditor(
    document: DiffPreviewDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken,
  ): void {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")],
    };
    webviewPanel.webview.html = buildWebviewHtml(webviewPanel.webview, this.extensionUri);

    const disposables: vscode.Disposable[] = [];
    let postRevision = 0;
    const postUpdate = () => {
      const revision = postRevision + 1;
      postRevision = revision;

      void postUpdateMessage(
        document.uri,
        webviewPanel.webview,
        token,
        revision,
        () => postRevision,
      );
    };
    const postUpdateDebounced = debounce(postUpdate, 150);
    const documentWatcher = createDocumentWatcher(document.uri, postUpdateDebounced);

    if (documentWatcher != null) {
      disposables.push(documentWatcher);
    }

    disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (sameUri(event.document.uri, document.uri)) {
          postUpdateDebounced();
        }
      }),
      vscode.workspace.onDidSaveTextDocument((savedDocument) => {
        if (sameUri(savedDocument.uri, document.uri)) {
          postUpdate();
        }
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(CONFIG_SECTION)) {
          postUpdate();
        }
      }),
      webviewPanel.webview.onDidReceiveMessage((message: DiffPreviewWebviewToExtensionMessage) => {
        if (message.type === "ready") {
          postUpdate();
          return;
        }

        if (message.type === "revealText") {
          void vscode.window.showTextDocument(document.uri, { preview: false });
        }
      }),
    );

    webviewPanel.onDidDispose(() => disposeAll(disposables));
  }
}

async function openPreview(
  uri: vscode.Uri | undefined,
  viewColumn: vscode.ViewColumn,
): Promise<void> {
  const targetUri = uri ?? (await pickDiffFile());

  if (targetUri == null) {
    return;
  }

  await vscode.commands.executeCommand("vscode.openWith", targetUri, VIEW_TYPE, {
    preview: false,
    viewColumn,
  });
}

async function pickDiffFile(): Promise<vscode.Uri | undefined> {
  const activeUri = vscode.window.activeTextEditor?.document.uri;

  if (activeUri != null && isDiffLikePath(activeUri.fsPath)) {
    return activeUri;
  }

  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      "Diff files": ["diff", "patch"],
    },
  });

  return picked?.[0];
}

async function createUpdateMessage(uri: vscode.Uri): Promise<DiffPreviewUpdateMessage> {
  const settings = readPreviewSettings();
  const snapshot = await readDocumentSnapshot(uri, settings.maxFileSizeBytes);

  return {
    type: "update",
    documentUri: uri.toString(),
    fileName: path.basename(uri.fsPath) || uri.toString(),
    text: snapshot.text,
    version: snapshot.version,
    sizeBytes: snapshot.sizeBytes,
    tooLarge: snapshot.tooLarge,
    settings,
  };
}

async function postUpdateMessage(
  uri: vscode.Uri,
  webview: vscode.Webview,
  token: vscode.CancellationToken,
  revision: number,
  getCurrentRevision: () => number,
): Promise<void> {
  try {
    const message = await createUpdateMessage(uri);

    if (token.isCancellationRequested || revision !== getCurrentRevision()) {
      return;
    }

    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- VS Code Webview.postMessage has no targetOrigin parameter.
    void webview.postMessage(message);
  } catch (error) {
    if (token.isCancellationRequested || revision !== getCurrentRevision()) {
      return;
    }

    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- VS Code Webview.postMessage has no targetOrigin parameter.
    void webview.postMessage(createReadFailureMessage(uri, getErrorMessage(error)));
  }
}

function createReadFailureMessage(uri: vscode.Uri, message: string): DiffPreviewUpdateMessage {
  return {
    type: "update",
    documentUri: uri.toString(),
    fileName: path.basename(uri.fsPath) || uri.toString(),
    text: `Unable to read ${uri.toString()}\n\n${message}`,
    version: Date.now(),
    sizeBytes: 0,
    tooLarge: false,
    settings: readPreviewSettings(),
  };
}

async function readDocumentSnapshot(
  uri: vscode.Uri,
  maxFileSizeBytes: number,
): Promise<{
  text: string;
  version: number;
  sizeBytes: number;
  tooLarge: boolean;
}> {
  const openDocument = vscode.workspace.textDocuments.find((document) =>
    sameUri(document.uri, uri),
  );

  if (openDocument != null && !openDocument.isClosed) {
    const text = openDocument.getText();
    const sizeBytes = Buffer.byteLength(text, "utf8");

    return {
      text: sizeBytes > maxFileSizeBytes ? "" : text,
      version: openDocument.version,
      sizeBytes,
      tooLarge: sizeBytes > maxFileSizeBytes,
    };
  }

  const stat = await vscode.workspace.fs.stat(uri);

  if (stat.size > maxFileSizeBytes) {
    return {
      text: "",
      version: stat.mtime,
      sizeBytes: stat.size,
      tooLarge: true,
    };
  }

  const bytes = await vscode.workspace.fs.readFile(uri);

  return {
    text: new TextDecoder("utf-8", { fatal: false }).decode(bytes),
    version: stat.mtime,
    sizeBytes: bytes.byteLength,
    tooLarge: false,
  };
}

function isDiffLikePath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return extension === ".diff" || extension === ".patch";
}

function createDocumentWatcher(
  uri: vscode.Uri,
  onChange: () => void,
): vscode.Disposable | undefined {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

  if (workspaceFolder == null) {
    return undefined;
  }

  const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return undefined;
  }

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceFolder, relativePath),
  );
  const changeSubscription = watcher.onDidChange(onChange);
  const createSubscription = watcher.onDidCreate(onChange);
  const deleteSubscription = watcher.onDidDelete(onChange);

  return vscode.Disposable.from(
    changeSubscription,
    createSubscription,
    deleteSubscription,
    watcher,
  );
}

function debounce(callback: () => void, delayMs: number): () => void {
  let timeout: NodeJS.Timeout | undefined;

  return () => {
    if (timeout != null) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(callback, delayMs);
  };
}

function sameUri(first: vscode.Uri, second: vscode.Uri): boolean {
  return first.toString() === second.toString();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function disposeAll(disposables: readonly vscode.Disposable[]): void {
  for (const disposable of disposables) {
    disposable.dispose();
  }
}
