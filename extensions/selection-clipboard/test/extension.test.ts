import * as vscode from "vscode";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { activate, deactivate } from "../src/extension";
import {
  ALL_COMMANDS,
  ITEMS_STATE_KEY,
  ITEMS_VIEW_ID,
  PERSISTED_SELECTIONS_VERSION,
  REMOVE_ITEM_COMMAND,
  type SelectionItem,
} from "../src/protocol";

const mocks = vi.hoisted(() => {
  class EventEmitter<T> {
    readonly #listeners = new Set<(value: T) => void>();
    readonly event = (listener: (value: T) => void) => {
      this.#listeners.add(listener);
      return { dispose: () => this.#listeners.delete(listener) };
    };
    fire(value: T): void {
      for (const listener of this.#listeners) {
        listener(value);
      }
    }
    dispose(): void {
      this.#listeners.clear();
    }
  }

  interface FakeTreeView {
    badge?: { value: number; tooltip: string } | undefined;
    message?: string;
    selection: unknown[];
    dispose: () => void;
  }

  const state = {
    treeView: undefined as FakeTreeView | undefined,
    configurationListener: undefined as
      | ((event: { affectsConfiguration(section: string): boolean }) => void)
      | undefined,
  };

  return { EventEmitter, state };
});

vi.mock("vscode", () => ({
  commands: {
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  },
  env: { clipboard: { writeText: vi.fn(() => Promise.resolve()) }, language: "en" },
  EventEmitter: mocks.EventEmitter,
  l10n: {
    t: (message: string, args?: Record<string, unknown>) =>
      message.replace(/\{(\w+)\}/g, (_match, key: string) => String(args?.[key])),
  },
  window: {
    createTreeView: vi.fn(() => {
      mocks.state.treeView = { selection: [], dispose: vi.fn() };
      return mocks.state.treeView;
    }),
    showErrorMessage: vi.fn(),
  },
  workspace: {
    onDidChangeConfiguration: vi.fn((listener) => {
      mocks.state.configurationListener = listener;
      return { dispose: vi.fn() };
    }),
  },
}));

function item(id: string, line: number): SelectionItem {
  return {
    id,
    uri: "file:///ws/a.ts",
    range: { startLine: line, startCharacter: 0, endLine: line, endCharacter: 1 },
    text: "a",
    truncated: false,
    languageId: "typescript",
    createdAt: 1,
  };
}

function createContext(stored?: unknown) {
  let value = stored;
  return {
    subscriptions: [] as { dispose(): unknown }[],
    workspaceState: {
      get: vi.fn(() => value),
      update: vi.fn((_key: string, next: unknown) => {
        value = next;
        return Promise.resolve();
      }),
    },
  };
}

function registeredHandler(command: string): (...args: unknown[]) => Promise<void> {
  const call = vi
    .mocked(vscode.commands.registerCommand)
    .mock.calls.find(([registered]) => registered === command);
  if (!call) {
    throw new Error(`${command} was not registered`);
  }
  return call[1] as (...args: unknown[]) => Promise<void>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.treeView = undefined;
  mocks.state.configurationListener = undefined;
});

describe("extension activation", () => {
  it("registers every contributed command and the multi-select tree view", () => {
    const context = createContext();

    activate(context as unknown as vscode.ExtensionContext);

    const registered = vi.mocked(vscode.commands.registerCommand).mock.calls.map(([id]) => id);
    expect(registered.toSorted()).toEqual([...ALL_COMMANDS].toSorted());
    expect(vscode.window.createTreeView).toHaveBeenCalledWith(ITEMS_VIEW_ID, {
      treeDataProvider: expect.any(Object),
      canSelectMany: true,
    });
    // store, provider, tree view, badge listener, configuration listener, commands
    expect(context.subscriptions).toHaveLength(5 + ALL_COMMANDS.length);
    expect(context.workspaceState.get).toHaveBeenCalledWith(ITEMS_STATE_KEY);
    expect(mocks.state.treeView?.badge).toBeUndefined();
    expect(mocks.state.treeView?.message).toBeUndefined();
  });

  it("keeps the badge in sync with the item count", async () => {
    const context = createContext({
      version: PERSISTED_SELECTIONS_VERSION,
      items: [item("a", 0), item("b", 1)],
    });

    activate(context as unknown as vscode.ExtensionContext);
    expect(mocks.state.treeView?.badge).toEqual({ value: 2, tooltip: "2 selections" });

    const remove = registeredHandler(REMOVE_ITEM_COMMAND);
    await remove({ id: "a" });
    expect(mocks.state.treeView?.badge).toEqual({ value: 1, tooltip: "1 selection" });

    await remove({ id: "b" });
    expect(mocks.state.treeView?.badge).toBeUndefined();
  });

  it("uses the tree selection when an item command has no arguments", async () => {
    const context = createContext({
      version: PERSISTED_SELECTIONS_VERSION,
      items: [item("a", 0), item("b", 1)],
    });
    activate(context as unknown as vscode.ExtensionContext);
    mocks.state.treeView!.selection = [item("b", 1)];

    await registeredHandler(REMOVE_ITEM_COMMAND)();

    expect(mocks.state.treeView?.badge).toEqual({ value: 1, tooltip: "1 selection" });
  });

  it("refreshes the tree only for relevant configuration changes", () => {
    activate(createContext() as unknown as vscode.ExtensionContext);
    const { treeDataProvider } = vi.mocked(vscode.window.createTreeView).mock.calls[0]![1];
    const listener = vi.fn();
    treeDataProvider.onDidChangeTreeData!(listener);

    mocks.state.configurationListener!({ affectsConfiguration: () => false });
    expect(listener).not.toHaveBeenCalled();

    mocks.state.configurationListener!({
      affectsConfiguration: (section) => section === "selectionClipboard",
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("shows a read-only message for state written by a newer version", () => {
    activate(createContext({ version: 99, items: [] }) as unknown as vscode.ExtensionContext);

    expect(mocks.state.treeView?.message).toBe(
      "Stored selection list was written by a newer version; it is read-only.",
    );
  });

  it("provides a no-op deactivate hook", () => {
    expect(deactivate()).toBeUndefined();
  });
});
