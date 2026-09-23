import * as vscode from "vscode";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FormatSettings } from "../src/config";
import { ITEM_CONTEXT_VALUE, OPEN_ITEM_COMMAND } from "../src/protocol";
import { SelectionStore, type MementoLike, type NewSelection } from "../src/store";
import { SelectionTreeProvider } from "../src/treeProvider";

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

  class TreeItem {
    id?: string;
    description?: string;
    resourceUri?: unknown;
    iconPath?: unknown;
    contextValue?: string;
    tooltip?: unknown;
    command?: unknown;
    constructor(
      readonly label: string,
      readonly collapsibleState: number,
    ) {}
  }

  class MarkdownString {
    value = "";
    appendText(text: string): this {
      this.value += `<text>${text}</text>`;
      return this;
    }
    appendMarkdown(markdown: string): this {
      this.value += markdown;
      return this;
    }
  }

  /** Just enough of `vscode.Uri` for `file:` and `untitled:` URIs. */
  class FakeUri {
    readonly scheme: string;
    readonly path: string;
    readonly fsPath: string;
    readonly #value: string;

    constructor(value: string) {
      const colon = value.indexOf(":");
      const rest = value.slice(colon + 1);
      this.scheme = value.slice(0, colon);
      this.path = rest.startsWith("//") ? rest.slice(rest.indexOf("/", 2)) : rest;
      this.fsPath = this.path;
      this.#value = value;
    }

    static parse(value: string): FakeUri {
      return new FakeUri(value);
    }

    toString(): string {
      return this.#value;
    }
  }

  const workspace = {
    workspaceFolders: [{ name: "ws" }] as unknown[] | undefined,
    asRelativePath: vi.fn((uri: FakeUri) =>
      uri.scheme === "file" && uri.path.startsWith("/ws/") ? uri.path.slice(4) : uri.fsPath,
    ),
  };

  return { EventEmitter, FakeUri, MarkdownString, TreeItem, workspace };
});

vi.mock("vscode", () => ({
  env: { language: "en-US" },
  EventEmitter: mocks.EventEmitter,
  l10n: {
    t: (message: string, args?: Record<string, unknown>) =>
      message.replace(/\{(\w+)\}/g, (_match, key: string) => String(args?.[key])),
  },
  MarkdownString: mocks.MarkdownString,
  ThemeIcon: { File: { id: "file" } },
  TreeItem: mocks.TreeItem,
  TreeItemCollapsibleState: { None: 0 },
  Uri: mocks.FakeUri,
  workspace: mocks.workspace,
}));

const DEFAULT_SETTINGS: FormatSettings = {
  locationStyle: "lineColumn",
  pathStyle: "workspaceRelative",
  includeCode: false,
};

function memento(): MementoLike {
  let value: unknown;
  return {
    get: <T>() => value as T | undefined,
    update: (_key, next) => {
      value = next;
      return Promise.resolve();
    },
  };
}

function selection(overrides: Partial<NewSelection> = {}): NewSelection {
  return {
    uri: "file:///ws/src/app/foo.ts",
    range: { startLine: 11, startCharacter: 4, endLine: 13, endCharacter: 20 },
    text: "const a = 1;",
    languageId: "typescript",
    ...overrides,
  };
}

function setup(settings: Partial<FormatSettings> = {}) {
  const store = new SelectionStore(memento(), { createId: () => crypto.randomUUID() });
  const current = { ...DEFAULT_SETTINGS, ...settings };
  const provider = new SelectionTreeProvider(store, () => current);
  return { store, provider, current };
}

function tooltipOf(item: vscode.TreeItem): string {
  return (item.tooltip as vscode.MarkdownString).value;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.workspaceFolders = [{ name: "ws" }];
});

describe("SelectionTreeProvider", () => {
  it("lists store items as a flat list", async () => {
    const { store, provider } = setup();
    await store.add(selection());
    await store.add(selection({ uri: "file:///ws/b.ts" }));

    const children = provider.getChildren();

    expect(children).toEqual(store.list());
    expect(provider.getChildren(children[0])).toEqual([]);
  });

  it("renders label, description, icon, context value, and open command", async () => {
    const { store, provider } = setup();
    const { item } = await store.add(selection());

    const treeItem = provider.getTreeItem(item);

    expect(treeItem.label).toBe("foo.ts:12:5-14:20");
    expect(treeItem.description).toBe("src/app");
    expect(treeItem.id).toBe(item.id);
    expect(treeItem.resourceUri).toMatchObject({ scheme: "file", path: "/ws/src/app/foo.ts" });
    expect(treeItem.iconPath).toBe(vscode.ThemeIcon.File);
    expect(treeItem.contextValue).toBe(ITEM_CONTEXT_VALUE);
    expect(treeItem.command).toEqual({
      command: OPEN_ITEM_COMMAND,
      title: "Go to Selection",
      arguments: [item],
    });
  });

  it("prefers the note as description and omits it at a folder root", async () => {
    const { store, provider } = setup();
    const { item: noted } = await store.add(selection());
    await store.updateNote(noted.id, "entry point");
    const { item: rootFile } = await store.add(selection({ uri: "file:///ws/README.md" }));

    expect(provider.getTreeItem(store.get(noted.id)!).description).toBe("entry point");
    expect(provider.getTreeItem(rootFile).description).toBeUndefined();
  });

  it("follows the current location style for the label suffix", async () => {
    const { store, provider, current } = setup();
    const { item } = await store.add(selection());

    current.locationStyle = "githubAnchor";
    expect(provider.getTreeItem(item).label).toBe("foo.ts#L12C5-L14C20");

    current.locationStyle = "lineRange";
    expect(provider.getTreeItem(item).label).toBe("foo.ts:12-14");
  });

  it("builds a tooltip with location, note, time, and fenced snapshot", async () => {
    const { store, provider } = setup({ pathStyle: "absolute" });
    const { item } = await store.add(selection({ text: "use ```fences```\nok" }));
    await store.updateNote(item.id, "why");

    const tooltip = tooltipOf(provider.getTreeItem(store.get(item.id)!));

    expect(tooltip).toContain("<text>/ws/src/app/foo.ts:12:5-14:20</text>");
    expect(tooltip).toContain("<text>Note: why</text>");
    expect(tooltip).toMatch(/<text>Collected .+<\/text>/);
    expect(tooltip).toContain("\n````typescript\nuse ```fences```\nok\n````\n");
    expect(tooltip).not.toContain("Preview truncated.");
  });

  it("limits the snapshot preview and marks truncation", async () => {
    const { store, provider } = setup();
    const text = Array.from({ length: 50 }, (_, index) => `line ${index}`).join("\n");
    const { item } = await store.add(selection({ text }));

    const tooltip = tooltipOf(provider.getTreeItem(item));

    expect(tooltip).toContain("line 29\n```");
    expect(tooltip).not.toContain("line 30");
    expect(tooltip).toContain("<text>Preview truncated.</text>");
  });

  it("marks snapshots that were truncated at collection time", async () => {
    const { store, provider } = setup();
    const { item } = await store.add(selection({ text: "x".repeat(25_000) }));

    const tooltip = tooltipOf(provider.getTreeItem(item));

    expect(item.truncated).toBe(true);
    expect(tooltip).toContain("<text>Preview truncated.</text>");
    expect(tooltip).toContain(
      "<text>The code snapshot was truncated when it was collected.</text>",
    );
  });

  it("omits the code block for caret positions", async () => {
    const { store, provider } = setup();
    const { item } = await store.add(
      selection({
        range: { startLine: 1, startCharacter: 2, endLine: 1, endCharacter: 2 },
        text: "",
      }),
    );

    expect(provider.getTreeItem(item).label).toBe("foo.ts:2:3");
    expect(tooltipOf(provider.getTreeItem(item))).not.toContain("```");
  });

  it("uses the document title for untitled documents", async () => {
    const { store, provider } = setup();
    const { item } = await store.add(selection({ uri: "untitled:Untitled-1" }));

    const treeItem = provider.getTreeItem(item);

    expect(treeItem.label).toBe("Untitled-1:12:5-14:20");
    expect(treeItem.description).toBeUndefined();
  });

  it("fires onDidChangeTreeData on store changes and refresh, until disposed", async () => {
    const { store, provider } = setup();
    const listener = vi.fn();
    provider.onDidChangeTreeData(listener);

    await store.add(selection());
    provider.refresh();
    expect(listener).toHaveBeenCalledTimes(2);

    provider.dispose();
    await store.add(selection({ uri: "file:///ws/other.ts" }));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
