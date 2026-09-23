import * as vscode from "vscode";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCommandHandlers, type CommandHandler, type CommandId } from "../src/commands";
import { readFormatSettings, resolveDisplayPath } from "../src/config";
import {
  ADD_SELECTION_COMMAND,
  ALL_COMMANDS,
  CLEAR_ALL_COMMAND,
  CONFIGURE_KEYBINDINGS_COMMAND,
  COPY_ALL_COMMAND,
  COPY_ITEM_COMMAND,
  COPY_LOCATION_COMMAND,
  EDIT_NOTE_COMMAND,
  MOVE_DOWN_COMMAND,
  MOVE_UP_COMMAND,
  OPEN_ITEM_COMMAND,
  REMOVE_ITEM_COMMAND,
  UPDATE_RANGE_COMMAND,
  type SelectionItem,
} from "../src/protocol";
import { SelectionStore, type MementoLike, type NewSelection } from "../src/store";

const mocks = vi.hoisted(() => {
  class Position {
    constructor(
      readonly line: number,
      readonly character: number,
    ) {}
  }

  class Range {
    readonly start: Position;
    readonly end: Position;
    constructor(
      startOrLine: Position | number,
      endOrCharacter: Position | number,
      endLine?: number,
      endCharacter?: number,
    ) {
      if (typeof startOrLine === "number" && typeof endOrCharacter === "number") {
        this.start = new Position(startOrLine, endOrCharacter);
        this.end = new Position(endLine ?? 0, endCharacter ?? 0);
      } else {
        this.start = startOrLine as Position;
        this.end = endOrCharacter as Position;
      }
    }
  }

  /** Constructed as `(anchor, active)`, like the real class. */
  class Selection extends Range {}

  /** Just enough of `vscode.Uri` for `file:`, `untitled:`, and other schemes. */
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

  const settings: Record<string, unknown> = {};
  const workspace = {
    workspaceFolders: [{ name: "ws" }] as unknown[] | undefined,
    getConfiguration: vi.fn(() => ({ get: (key: string) => settings[key] })),
    asRelativePath: vi.fn((uri: FakeUri, includeWorkspaceFolder: boolean) => {
      if (uri.scheme === "file" && uri.path.startsWith("/ws/")) {
        const relative = uri.path.slice("/ws/".length);
        return includeWorkspaceFolder ? `ws/${relative}` : relative;
      }
      return uri.fsPath;
    }),
  };

  const window = {
    activeTextEditor: undefined as unknown,
    setStatusBarMessage: vi.fn(() => ({ dispose: vi.fn() })),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showInputBox: vi.fn(),
    showTextDocument: vi.fn(),
    showWarningMessage: vi.fn(),
  };

  return { FakeUri, Position, Range, Selection, settings, window, workspace };
});

vi.mock("vscode", () => ({
  commands: { executeCommand: vi.fn(() => Promise.resolve()) },
  env: { clipboard: { writeText: vi.fn(() => Promise.resolve()) } },
  l10n: {
    t: (message: string, args?: Record<string, unknown>) =>
      message.replace(/\{(\w+)\}/g, (_match, key: string) => String(args?.[key])),
  },
  Position: mocks.Position,
  Range: mocks.Range,
  Selection: mocks.Selection,
  TextEditorRevealType: { InCenterIfOutsideViewport: 2 },
  Uri: mocks.FakeUri,
  window: mocks.window,
  workspace: mocks.workspace,
}));

const FOO_URI = "file:///ws/src/app/foo.ts";
const BAR_URI = "file:///ws/src/bar.ts";
const LINES = Array.from({ length: 20 }, (_, index) => `line ${index + 1} `.padEnd(30, "x"));

function makeDocument(uri: string, lines: readonly string[], languageId = "typescript") {
  const offsetAt = (position: InstanceType<typeof mocks.Position>): number =>
    lines.slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0) +
    position.character;
  return {
    uri: mocks.FakeUri.parse(uri),
    languageId,
    lineAt: (line: number) => ({ text: lines[line] ?? "" }),
    getText: (range: InstanceType<typeof mocks.Range>) =>
      lines.join("\n").slice(offsetAt(range.start), offsetAt(range.end)),
    validateRange: (range: InstanceType<typeof mocks.Range>) => {
      const clamp = (position: InstanceType<typeof mocks.Position>) => {
        const line = Math.min(position.line, lines.length - 1);
        const character = Math.min(position.character, (lines[line] ?? "").length);
        return new mocks.Position(line, character);
      };
      return new mocks.Range(clamp(range.start), clamp(range.end));
    },
  };
}

function selection(
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number,
) {
  return new mocks.Selection(
    new mocks.Position(startLine, startCharacter),
    new mocks.Position(endLine, endCharacter),
  );
}

function makeEditor(
  uri: string,
  selections: InstanceType<typeof mocks.Selection>[],
  lines: readonly string[] = LINES,
) {
  return {
    document: makeDocument(uri, lines),
    selections,
    selection: selections[0],
    revealRange: vi.fn(),
  };
}

function memento(initial?: unknown): MementoLike {
  let value = initial;
  return {
    get: <T>() => value as T | undefined,
    update: (_key, next) => {
      value = next;
      return Promise.resolve();
    },
  };
}

function capture(uri: string, startLine: number, endLine: number, text = "code"): NewSelection {
  return {
    uri,
    range: { startLine, startCharacter: 0, endLine, endCharacter: 4 },
    text,
    languageId: "typescript",
  };
}

interface Harness {
  store: SelectionStore;
  run(command: CommandId, ...args: unknown[]): Promise<void>;
  treeSelection: SelectionItem[];
}

function createHarness(state?: unknown): Harness {
  let nextId = 0;
  const store = new SelectionStore(memento(state), {
    createId: () => `id-${++nextId}`,
    now: () => Date.UTC(2026, 8, 23),
  });
  const harness: Harness = {
    store,
    treeSelection: [],
    run: (command, ...args) => (handlers[command] as CommandHandler)(...args),
  };
  const handlers = createCommandHandlers({ store, treeSelection: () => harness.treeSelection });
  return harness;
}

async function seed(harness: Harness, ...selections: NewSelection[]): Promise<SelectionItem[]> {
  // The store applies each add synchronously and queues writes in call order.
  await Promise.all(selections.map((entry) => harness.store.add(entry)));
  return [...harness.store.list()];
}

function clipboardText(): string | undefined {
  return vi.mocked(vscode.env.clipboard.writeText).mock.lastCall?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(mocks.settings)) {
    delete mocks.settings[key];
  }
  mocks.window.activeTextEditor = undefined;
  mocks.workspace.workspaceFolders = [{ name: "ws" }];
});

describe("command handlers", () => {
  it("provides a handler for every contributed command", () => {
    const handlers = createCommandHandlers({
      store: new SelectionStore(memento()),
      treeSelection: () => [],
    });
    expect(Object.keys(handlers).toSorted()).toEqual([...ALL_COMMANDS].toSorted());
  });
});

describe("copyLocation", () => {
  it("copies a single selection as a workspace-relative line/column range", async () => {
    mocks.window.activeTextEditor = makeEditor(FOO_URI, [selection(11, 4, 13, 20)]);

    await createHarness().run(COPY_LOCATION_COMMAND);

    expect(clipboardText()).toBe("src/app/foo.ts:12:5-14:20");
    expect(mocks.window.setStatusBarMessage).toHaveBeenCalledWith("Copied 1 location", 3000);
  });

  it("emits multi-cursor selections in document order, one per line", async () => {
    mocks.window.activeTextEditor = makeEditor(FOO_URI, [
      selection(9, 2, 9, 2),
      selection(1, 0, 1, 6),
    ]);

    await createHarness().run(COPY_LOCATION_COMMAND);

    expect(clipboardText()).toBe("src/app/foo.ts:2:1-2:6\nsrc/app/foo.ts:10:3");
    expect(mocks.window.setStatusBarMessage).toHaveBeenCalledWith("Copied 2 locations", 3000);
  });

  it("trims whole-line selections and includes the live code when configured", async () => {
    mocks.settings.includeCode = true;
    const lines = ["first", "second line", "third"];
    mocks.window.activeTextEditor = makeEditor(FOO_URI, [selection(1, 0, 2, 0)], lines);

    await createHarness().run(COPY_LOCATION_COMMAND);

    expect(clipboardText()).toBe("src/app/foo.ts:2:1-2:11\n```typescript\nsecond line\n```");
  });

  it("honors the location and path style settings", async () => {
    mocks.settings.locationStyle = "githubAnchor";
    mocks.settings.pathStyle = "absolute";
    mocks.window.activeTextEditor = makeEditor(FOO_URI, [selection(11, 4, 13, 20)]);

    await createHarness().run(COPY_LOCATION_COMMAND);

    expect(clipboardText()).toBe("/ws/src/app/foo.ts#L12C5-L14C20");
  });

  it("warns and copies nothing without an active editor", async () => {
    await createHarness().run(COPY_LOCATION_COMMAND);

    expect(mocks.window.showWarningMessage).toHaveBeenCalledWith(
      "Open a text editor to copy a selection location.",
    );
    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
  });
});

describe("addSelection", () => {
  it("adds selections and reports duplicates", async () => {
    const harness = createHarness();
    mocks.window.activeTextEditor = makeEditor(FOO_URI, [selection(1, 0, 2, 5)]);

    await harness.run(ADD_SELECTION_COMMAND);
    expect(mocks.window.setStatusBarMessage).toHaveBeenLastCalledWith(
      "Added 1 selection to the list",
      3000,
    );

    await harness.run(ADD_SELECTION_COMMAND);
    expect(mocks.window.setStatusBarMessage).toHaveBeenLastCalledWith("Already in the list", 3000);

    mocks.window.activeTextEditor = makeEditor(FOO_URI, [
      selection(5, 1, 5, 1),
      selection(1, 0, 2, 5),
    ]);
    await harness.run(ADD_SELECTION_COMMAND);
    expect(mocks.window.setStatusBarMessage).toHaveBeenLastCalledWith(
      "Added 1; 1 already in the list",
      3000,
    );

    const items = harness.store.list();
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      uri: FOO_URI,
      range: { startLine: 1, startCharacter: 0, endLine: 2, endCharacter: 5 },
      text: `${LINES[1]}\nline `,
      languageId: "typescript",
    });
    expect(items[1]?.range).toEqual({
      startLine: 5,
      startCharacter: 1,
      endLine: 5,
      endCharacter: 1,
    });
  });

  it("adds multiple selections in document order", async () => {
    const harness = createHarness();
    mocks.window.activeTextEditor = makeEditor(FOO_URI, [
      selection(8, 0, 8, 3),
      selection(2, 0, 2, 3),
    ]);

    await harness.run(ADD_SELECTION_COMMAND);

    expect(harness.store.list().map((item) => item.range.startLine)).toEqual([2, 8]);
    expect(mocks.window.setStatusBarMessage).toHaveBeenCalledWith(
      "Added 2 selections to the list",
      3000,
    );
  });

  it("warns without an active editor", async () => {
    await createHarness().run(ADD_SELECTION_COMMAND);

    expect(mocks.window.showWarningMessage).toHaveBeenCalledWith(
      "Open a text editor to add a selection.",
    );
  });

  it("reports read-only state written by a newer version", async () => {
    const harness = createHarness({ version: 99, items: [] });
    mocks.window.activeTextEditor = makeEditor(FOO_URI, [selection(1, 0, 1, 4)]);

    await harness.run(ADD_SELECTION_COMMAND);

    expect(mocks.window.showErrorMessage).toHaveBeenCalledWith(
      "Stored selection list was written by a newer version; it is read-only.",
    );
  });

  it("reports unexpected failures with their detail", async () => {
    const harness = createHarness();
    vi.spyOn(harness.store, "add").mockRejectedValueOnce(new Error("disk full"));
    mocks.window.activeTextEditor = makeEditor(FOO_URI, [selection(1, 0, 1, 4)]);

    await harness.run(ADD_SELECTION_COMMAND);

    expect(mocks.window.showErrorMessage).toHaveBeenCalledWith("Selection Clipboard: disk full");
  });
});

describe("copyAll", () => {
  it("shows a message when the list is empty", async () => {
    await createHarness().run(COPY_ALL_COMMAND);

    expect(mocks.window.showInformationMessage).toHaveBeenCalledWith(
      "The selection list is empty.",
    );
    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("copies every item in list order using stored snapshots", async () => {
    const harness = createHarness();
    await seed(harness, capture(FOO_URI, 9, 9, "later"), capture(BAR_URI, 0, 1, "a\nb"));
    mocks.settings.includeCode = true;

    await harness.run(COPY_ALL_COMMAND);

    expect(clipboardText()).toBe(
      [
        "src/app/foo.ts:10:1-10:4\n```typescript\nlater\n```",
        "src/bar.ts:1:1-2:4\n```typescript\na\nb\n```",
      ].join("\n\n"),
    );
    expect(mocks.window.setStatusBarMessage).toHaveBeenCalledWith("Copied 2 locations", 3000);
  });

  it("resolves display paths with the current path style", async () => {
    const harness = createHarness();
    await seed(harness, capture(FOO_URI, 0, 0), capture("untitled:Untitled-1", 2, 2));
    mocks.settings.pathStyle = "absolute";
    mocks.settings.locationStyle = "lineRange";

    await harness.run(COPY_ALL_COMMAND);

    expect(clipboardText()).toBe("/ws/src/app/foo.ts:1\nUntitled-1:3");
  });
});

describe("copyItem and removeItem target resolution", () => {
  it("prefers the multi-selection and keeps list order", async () => {
    const harness = createHarness();
    const [first, , third] = await seed(
      harness,
      capture(FOO_URI, 0, 0),
      capture(FOO_URI, 1, 1),
      capture(FOO_URI, 2, 2),
    );

    await harness.run(COPY_ITEM_COMMAND, first, [third, first]);

    expect(clipboardText()).toBe("src/app/foo.ts:1:1-1:4\nsrc/app/foo.ts:3:1-3:4");
  });

  it("falls back to the clicked item, then to the tree selection", async () => {
    const harness = createHarness();
    const [first, second] = await seed(harness, capture(FOO_URI, 0, 0), capture(FOO_URI, 1, 1));

    await harness.run(COPY_ITEM_COMMAND, second, []);
    expect(clipboardText()).toBe("src/app/foo.ts:2:1-2:4");

    harness.treeSelection = [second!, first!];
    await harness.run(COPY_ITEM_COMMAND);
    expect(clipboardText()).toBe("src/app/foo.ts:1:1-1:4\nsrc/app/foo.ts:2:1-2:4");
  });

  it("ignores unknown items", async () => {
    const harness = createHarness();
    await seed(harness, capture(FOO_URI, 0, 0));

    await harness.run(COPY_ITEM_COMMAND, { id: "missing" });

    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("uses the latest stored version of a stale tree element", async () => {
    const harness = createHarness();
    const [first] = await seed(harness, capture(FOO_URI, 0, 0));
    await harness.store.replaceSelection(first!.id, capture(BAR_URI, 4, 4));

    await harness.run(COPY_ITEM_COMMAND, first);

    expect(clipboardText()).toBe("src/bar.ts:5:1-5:4");
  });

  it("removes every selected item", async () => {
    const harness = createHarness();
    const [first, second, third] = await seed(
      harness,
      capture(FOO_URI, 0, 0),
      capture(FOO_URI, 1, 1),
      capture(FOO_URI, 2, 2),
    );

    await harness.run(REMOVE_ITEM_COMMAND, first, [first, third]);
    expect(harness.store.list()).toEqual([second]);

    await harness.run(REMOVE_ITEM_COMMAND, second);
    expect(harness.store.list()).toEqual([]);
  });
});

describe("editNote", () => {
  it("prefills the current note and keeps it when cancelled", async () => {
    const harness = createHarness();
    const [item] = await seed(harness, capture(FOO_URI, 0, 0));
    await harness.store.updateNote(item!.id, "keep me");
    mocks.window.showInputBox.mockResolvedValueOnce(undefined);

    await harness.run(EDIT_NOTE_COMMAND, item);

    expect(mocks.window.showInputBox).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Note for src/app/foo.ts:1:1-1:4",
        value: "keep me",
      }),
    );
    expect(harness.store.get(item!.id)?.note).toBe("keep me");
  });

  it("updates or clears the note", async () => {
    const harness = createHarness();
    const [item] = await seed(harness, capture(FOO_URI, 0, 0));

    mocks.window.showInputBox.mockResolvedValueOnce("  why this matters ");
    await harness.run(EDIT_NOTE_COMMAND, item);
    expect(harness.store.get(item!.id)?.note).toBe("why this matters");

    mocks.window.showInputBox.mockResolvedValueOnce("");
    await harness.run(EDIT_NOTE_COMMAND, item);
    expect(harness.store.get(item!.id)).not.toHaveProperty("note");
  });
});

describe("updateRange", () => {
  it("re-captures the primary selection, possibly in another file", async () => {
    const harness = createHarness();
    const [item] = await seed(harness, capture(FOO_URI, 0, 0));
    mocks.window.activeTextEditor = makeEditor(BAR_URI, [
      selection(3, 0, 3, 4),
      selection(7, 0, 7, 4),
    ]);

    await harness.run(UPDATE_RANGE_COMMAND, item);

    expect(harness.store.get(item!.id)).toMatchObject({
      uri: BAR_URI,
      range: { startLine: 3, startCharacter: 0, endLine: 3, endCharacter: 4 },
      text: "line",
    });
    expect(mocks.window.setStatusBarMessage).toHaveBeenCalledWith("Selection updated", 3000);
  });

  it("warns without an active editor", async () => {
    const harness = createHarness();
    const [item] = await seed(harness, capture(FOO_URI, 0, 0));

    await harness.run(UPDATE_RANGE_COMMAND, item);

    expect(mocks.window.showWarningMessage).toHaveBeenCalledWith(
      "Open a text editor and select the code to use for this item.",
    );
  });
});

describe("moveUp and moveDown", () => {
  it("reorders items", async () => {
    const harness = createHarness();
    const [first, second] = await seed(harness, capture(FOO_URI, 0, 0), capture(FOO_URI, 1, 1));

    await harness.run(MOVE_UP_COMMAND, second);
    expect(harness.store.list().map((item) => item.id)).toEqual([second!.id, first!.id]);

    await harness.run(MOVE_DOWN_COMMAND, second);
    expect(harness.store.list().map((item) => item.id)).toEqual([first!.id, second!.id]);
  });
});

describe("single-item commands without arguments", () => {
  it("act on the tree selection only when it holds exactly one item", async () => {
    const harness = createHarness();
    const [first, second, third] = await seed(
      harness,
      capture(FOO_URI, 0, 0),
      capture(FOO_URI, 1, 1),
      capture(FOO_URI, 2, 2),
    );

    harness.treeSelection = [third!];
    await harness.run(MOVE_UP_COMMAND);
    expect(harness.store.list().map(({ id }) => id)).toEqual([first!.id, third!.id, second!.id]);

    harness.treeSelection = [first!, second!];
    await harness.run(MOVE_DOWN_COMMAND);
    harness.treeSelection = [];
    await harness.run(MOVE_DOWN_COMMAND);
    expect(harness.store.list().map(({ id }) => id)).toEqual([first!.id, third!.id, second!.id]);

    harness.treeSelection = [second!];
    mocks.window.showInputBox.mockResolvedValueOnce("from keyboard");
    await harness.run(EDIT_NOTE_COMMAND);
    expect(harness.store.get(second!.id)?.note).toBe("from keyboard");
  });
});

describe("configureKeybindings", () => {
  it("opens the Keyboard Shortcuts editor filtered to this extension", async () => {
    await createHarness().run(CONFIGURE_KEYBINDINGS_COMMAND);

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      "workbench.action.openGlobalKeybindings",
      "@ext:vscode-plugins.selection-clipboard",
    );
  });
});

describe("clearAll", () => {
  it("clears only after modal confirmation", async () => {
    const harness = createHarness();
    await seed(harness, capture(FOO_URI, 0, 0));

    mocks.window.showWarningMessage.mockResolvedValueOnce(undefined);
    await harness.run(CLEAR_ALL_COMMAND);
    expect(mocks.window.showWarningMessage).toHaveBeenCalledWith(
      "Remove all selections from the list?",
      expect.objectContaining({ modal: true }),
      "Clear",
    );
    expect(harness.store.list()).toHaveLength(1);

    mocks.window.showWarningMessage.mockResolvedValueOnce("Clear");
    await harness.run(CLEAR_ALL_COMMAND);
    expect(harness.store.list()).toHaveLength(0);
  });

  it("does not prompt when the list is already empty", async () => {
    await createHarness().run(CLEAR_ALL_COMMAND);

    expect(mocks.window.showWarningMessage).not.toHaveBeenCalled();
  });
});

describe("openItem", () => {
  it("clamps the snapshot range to the current file and selects it", async () => {
    const harness = createHarness();
    const [item] = await seed(harness, {
      uri: FOO_URI,
      range: { startLine: 1, startCharacter: 2, endLine: 40, endCharacter: 3 },
      text: "",
      languageId: "typescript",
    });
    const editor = makeEditor(FOO_URI, [], ["short", "lines", "only"]);
    mocks.window.showTextDocument.mockResolvedValueOnce(editor);

    await harness.run(OPEN_ITEM_COMMAND, item);

    expect(mocks.window.showTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({ scheme: "file", path: "/ws/src/app/foo.ts" }),
    );
    const selected = editor.selection;
    expect(selected).toBeInstanceOf(mocks.Selection);
    expect(selected?.start).toEqual(new mocks.Position(1, 2));
    expect(selected?.end).toEqual(new mocks.Position(2, 3));
    expect(editor.revealRange).toHaveBeenCalledWith(
      expect.objectContaining({ start: selected?.start, end: selected?.end }),
      vscode.TextEditorRevealType.InCenterIfOutsideViewport,
    );
  });

  it("reports files that can no longer be opened", async () => {
    const harness = createHarness();
    const [item] = await seed(harness, capture(FOO_URI, 0, 0));
    mocks.window.showTextDocument.mockRejectedValueOnce(new Error("file not found"));

    await harness.run(OPEN_ITEM_COMMAND, item);

    expect(mocks.window.showErrorMessage).toHaveBeenCalledWith(
      "Unable to open src/app/foo.ts: file not found",
    );
  });

  it("ignores unknown items", async () => {
    await createHarness().run(OPEN_ITEM_COMMAND, { id: "missing" });

    expect(mocks.window.showTextDocument).not.toHaveBeenCalled();
  });
});

describe("config", () => {
  it("falls back to defaults for invalid settings", () => {
    mocks.settings.locationStyle = "nope";
    mocks.settings.pathStyle = 3;
    mocks.settings.includeCode = "yes";

    expect(readFormatSettings()).toEqual({
      locationStyle: "lineColumn",
      pathStyle: "workspaceRelative",
      includeCode: false,
    });
    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("selectionClipboard");
  });

  it("reads valid settings", () => {
    mocks.settings.locationStyle = "lineRange";
    mocks.settings.pathStyle = "absolute";
    mocks.settings.includeCode = true;

    expect(readFormatSettings()).toEqual({
      locationStyle: "lineRange",
      pathStyle: "absolute",
      includeCode: true,
    });
  });

  it("prefixes the folder name only in multi-root workspaces", () => {
    const uri = mocks.FakeUri.parse(FOO_URI) as unknown as vscode.Uri;

    expect(resolveDisplayPath(uri, "workspaceRelative")).toBe("src/app/foo.ts");
    mocks.workspace.workspaceFolders = [{ name: "ws" }, { name: "other" }];
    expect(resolveDisplayPath(uri, "workspaceRelative")).toBe("ws/src/app/foo.ts");
    expect(mocks.workspace.asRelativePath).toHaveBeenLastCalledWith(uri, true);
    mocks.workspace.workspaceFolders = undefined;
    expect(resolveDisplayPath(uri, "workspaceRelative")).toBe("src/app/foo.ts");
    expect(mocks.workspace.asRelativePath).toHaveBeenLastCalledWith(uri, false);
  });

  it("uses a scheme-appropriate absolute path", () => {
    const parse = (value: string) => mocks.FakeUri.parse(value) as unknown as vscode.Uri;

    expect(resolveDisplayPath(parse(FOO_URI), "absolute")).toBe("/ws/src/app/foo.ts");
    expect(resolveDisplayPath(parse("untitled:Untitled-1"), "absolute")).toBe("Untitled-1");
    expect(resolveDisplayPath(parse("vscode-vfs://github/o/r/a.ts"), "absolute")).toBe(
      "vscode-vfs://github/o/r/a.ts",
    );
  });
});
