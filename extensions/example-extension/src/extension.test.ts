import * as vscode from "vscode";
import { describe, expect, it, vi } from "vitest";

import { activate, deactivate } from "./extension";

vi.mock("vscode", () => ({
  commands: {
    registerCommand: vi.fn(() => ({
      dispose: vi.fn(),
    })),
  },
  window: {
    showInformationMessage: vi.fn(() => Promise.resolve(undefined)),
  },
}));

describe("extension activation", () => {
  it("registers the hello world command", () => {
    const context = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    activate(context);

    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      "vscode-plugins-example.helloWorld",
      expect.any(Function),
    );
    expect(context.subscriptions).toHaveLength(1);
  });

  it("provides a no-op deactivate hook", () => {
    expect(deactivate()).toBeUndefined();
  });
});
