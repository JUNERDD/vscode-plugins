import * as vscode from "vscode";
import { describe, expect, it, vi } from "vitest";

import { activate, deactivate } from "../src/extension";
import { OPEN_PREVIEW_COMMAND, OPEN_PREVIEW_TO_SIDE_COMMAND, VIEW_TYPE } from "../src/protocol";

vi.mock("vscode", () => ({
  commands: {
    executeCommand: vi.fn(() => Promise.resolve(undefined)),
    registerCommand: vi.fn(() => ({
      dispose: vi.fn(),
    })),
  },
  Uri: {
    joinPath: vi.fn((uri, ...parts: string[]) => ({
      fsPath: [uri.fsPath, ...parts].join("/"),
      toString: () => [uri.fsPath, ...parts].join("/"),
    })),
  },
  ViewColumn: {
    Active: 1,
    Beside: 2,
  },
  window: {
    activeTextEditor: undefined,
    registerCustomEditorProvider: vi.fn(() => ({
      dispose: vi.fn(),
    })),
    showOpenDialog: vi.fn(() => Promise.resolve(undefined)),
    showTextDocument: vi.fn(() => Promise.resolve(undefined)),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_section: string, defaultValue: unknown) => defaultValue),
    })),
    onDidChangeConfiguration: vi.fn(() => ({
      dispose: vi.fn(),
    })),
    onDidChangeTextDocument: vi.fn(() => ({
      dispose: vi.fn(),
    })),
  },
}));

describe("extension activation", () => {
  it("registers the custom editor and commands", () => {
    const context = {
      extensionUri: {
        fsPath: "/extension",
        toString: () => "/extension",
      },
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    activate(context);

    expect(vscode.window.registerCustomEditorProvider).toHaveBeenCalledWith(
      VIEW_TYPE,
      expect.any(Object),
      {
        supportsMultipleEditorsPerDocument: true,
      },
    );
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      OPEN_PREVIEW_COMMAND,
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      OPEN_PREVIEW_TO_SIDE_COMMAND,
      expect.any(Function),
    );
    expect(context.subscriptions).toHaveLength(3);
  });

  it("provides a no-op deactivate hook", () => {
    expect(deactivate()).toBeUndefined();
  });
});
