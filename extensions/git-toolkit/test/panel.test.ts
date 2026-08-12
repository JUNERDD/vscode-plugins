import * as vscode from "vscode";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state: { receiveMessage: ((message: unknown) => void) | undefined } = {
    receiveMessage: undefined,
  };
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- vi.hoisted callbacks cannot safely capture module-scope helpers.
  const disposable = () => ({ dispose: vi.fn() });
  const webview = {
    asWebviewUri: vi.fn((uri: { toString(): string }) => uri),
    cspSource: "vscode-webview:",
    html: "",
    onDidReceiveMessage: vi.fn((listener: (message: unknown) => void) => {
      state.receiveMessage = listener;
      return disposable();
    }),
    postMessage: vi.fn(() => Promise.resolve(true)),
  };
  const panel = {
    dispose: vi.fn(),
    onDidDispose: vi.fn(() => disposable()),
    reveal: vi.fn(),
    webview,
  };

  return {
    clipboardWriteText: vi.fn(() => Promise.resolve()),
    createWebviewPanel: vi.fn(() => panel),
    executeCommand: vi.fn(() => Promise.resolve()),
    fileStat: vi.fn(() => Promise.resolve({ type: 1 })),
    onDidChangeConfiguration: vi.fn(() => disposable()),
    panel,
    showInformationMessage: vi.fn(() => Promise.resolve(undefined)),
    showWarningMessage: vi.fn(() => Promise.resolve(undefined)),
    state,
    webview,
  };
});

vi.mock("vscode", () => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- vi.mock factories are hoisted ahead of module-scope helpers.
  const createUri = (fsPath: string) => ({
    fsPath,
    scheme: "file",
    toString: () => `file://${fsPath}`,
  });

  return {
    commands: { executeCommand: mocks.executeCommand },
    env: {
      clipboard: { writeText: mocks.clipboardWriteText },
      language: "en",
    },
    l10n: {
      t: (template: string, values?: Record<string, string>) =>
        template.replaceAll(/\{(?<key>\w+)\}/g, (match, key: string) => values?.[key] ?? match),
    },
    Uri: {
      file: (fsPath: string) => createUri(fsPath),
      joinPath: (uri: { fsPath: string }, ...parts: string[]) =>
        createUri([uri.fsPath, ...parts].join("/")),
      parse: (value: string) => createUri(new URL(value).pathname),
    },
    ViewColumn: { Active: 1 },
    window: {
      createWebviewPanel: mocks.createWebviewPanel,
      showInformationMessage: mocks.showInformationMessage,
      showWarningMessage: mocks.showWarningMessage,
    },
    workspace: {
      fs: { stat: mocks.fileStat },
      getConfiguration: vi.fn(() => ({
        get: vi.fn((_section: string, defaultValue: unknown) => defaultValue),
      })),
      onDidChangeConfiguration: mocks.onDidChangeConfiguration,
    },
  };
});

import { CommitPanelManager } from "../src/panel";
import type { CommitSnapshot } from "../src/protocol";

describe("CommitPanelManager file actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.receiveMessage = undefined;
    mocks.fileStat.mockResolvedValue({ type: 1 });
  });

  it("opens a repository-relative working tree file", async () => {
    openPanel();

    mocks.state.receiveMessage?.({ type: "openFile", path: "src/a.ts" });

    await vi.waitFor(() => {
      expect(mocks.executeCommand).toHaveBeenCalledWith(
        "vscode.open",
        expect.objectContaining({ fsPath: "/repo/project/src/a.ts" }),
      );
    });
    expect(mocks.fileStat).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: "/repo/project/src/a.ts" }),
    );
  });

  it("copies only the file name", async () => {
    openPanel();

    mocks.state.receiveMessage?.({ type: "copyFileName", path: "src/nested/a.ts" });

    await vi.waitFor(() => {
      expect(mocks.clipboardWriteText).toHaveBeenCalledWith("a.ts");
      expect(mocks.webview.postMessage).toHaveBeenCalledWith({
        type: "fileNameCopied",
        path: "src/nested/a.ts",
      });
    });
    expect(mocks.showInformationMessage).toHaveBeenCalledWith("File name copied: a.ts");
  });

  it("does not report copy success when the clipboard write fails", async () => {
    mocks.clipboardWriteText.mockRejectedValueOnce(new Error("clipboard unavailable"));
    openPanel();

    mocks.state.receiveMessage?.({ type: "copyFileName", path: "src/a.ts" });

    await vi.waitFor(() => {
      expect(mocks.showWarningMessage).toHaveBeenCalledWith("Unable to copy file name.");
    });
    expect(mocks.webview.postMessage).not.toHaveBeenCalledWith({
      type: "fileNameCopied",
      path: "src/a.ts",
    });
  });

  it("ignores forged paths outside the repository", async () => {
    openPanel();

    mocks.state.receiveMessage?.({ type: "openFile", path: "../secret.txt" });
    mocks.state.receiveMessage?.({ type: "copyFileName", path: "/tmp/secret.txt" });
    await Promise.resolve();

    expect(mocks.fileStat).not.toHaveBeenCalled();
    expect(mocks.executeCommand).not.toHaveBeenCalled();
    expect(mocks.clipboardWriteText).not.toHaveBeenCalled();
  });

  it("explains when a historical path no longer exists", async () => {
    mocks.fileStat.mockRejectedValueOnce(new Error("missing"));
    openPanel();

    mocks.state.receiveMessage?.({ type: "openFile", path: "src/deleted.ts" });

    await vi.waitFor(() => {
      expect(mocks.showWarningMessage).toHaveBeenCalledWith(
        "Unable to open src/deleted.ts from the working tree. The file may have been moved or deleted.",
      );
    });
    expect(mocks.executeCommand).not.toHaveBeenCalled();
  });
});

function openPanel(): void {
  const manager = new CommitPanelManager({
    fsPath: "/extension",
    scheme: "file",
    toString: () => "file:///extension",
  } as vscode.Uri);
  manager.open(createCommit());
}

function createCommit(): CommitSnapshot {
  return {
    hash: "1234567890abcdef1234567890abcdef12345678",
    patch: "diff",
    patchSizeBytes: 4,
    repositoryName: "project",
    repositoryUri: "file:///repo/project",
    shortHash: "1234567890",
    subject: "test",
  };
}
