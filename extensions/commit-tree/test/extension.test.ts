import * as vscode from "vscode";
import { describe, expect, it, vi } from "vitest";

import { activate, deactivate } from "../src/extension";
import { OPEN_COMMIT_COMMAND, OPEN_FROM_HISTORY_COMMAND } from "../src/protocol";

vi.mock("vscode", () => ({
  commands: {
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  },
  env: {
    clipboard: { writeText: vi.fn(() => Promise.resolve()) },
  },
  l10n: { t: (value: string) => value },
  ProgressLocation: { Notification: 15 },
  Uri: {
    joinPath: vi.fn((uri, ...parts: string[]) => ({
      fsPath: [uri.fsPath, ...parts].join("/"),
      toString: () => [uri.fsPath, ...parts].join("/"),
    })),
  },
  ViewColumn: { Active: 1 },
  window: {
    activeTextEditor: undefined,
    createWebviewPanel: vi.fn(),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    withProgress: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_section: string, defaultValue: unknown) => defaultValue),
    })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
}));

describe("extension activation", () => {
  it("registers both stable commit entry points", () => {
    const context = {
      extensionUri: { fsPath: "/extension", toString: () => "/extension" },
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    activate(context);

    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      OPEN_COMMIT_COMMAND,
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      OPEN_FROM_HISTORY_COMMAND,
      expect.any(Function),
    );
    expect(context.subscriptions).toHaveLength(3);
  });

  it("provides a no-op deactivate hook", () => {
    expect(deactivate()).toBeUndefined();
  });
});
