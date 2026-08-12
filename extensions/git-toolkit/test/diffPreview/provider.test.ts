import * as vscode from "vscode";
import { describe, expect, it, vi } from "vitest";

import { registerDiffPreview } from "../../src/diffPreview/provider";
import {
  OPEN_PREVIEW_COMMAND,
  OPEN_PREVIEW_TO_SIDE_COMMAND,
  VIEW_TYPE,
} from "../../src/diffPreview/protocol";

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

describe("registerDiffPreview", () => {
  it("registers the custom editor and commands", () => {
    const context = {
      extensionUri: {
        fsPath: "/extension",
        toString: () => "/extension",
      },
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    registerDiffPreview(context);

    expect(VIEW_TYPE).toBe("vscode-plugins-git-toolkit.diffPreview");
    expect(OPEN_PREVIEW_COMMAND).toBe("vscode-plugins-git-toolkit.openDiffPreview");
    expect(OPEN_PREVIEW_TO_SIDE_COMMAND).toBe("vscode-plugins-git-toolkit.openDiffPreviewToSide");
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
});
