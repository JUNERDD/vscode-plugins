import * as vscode from "vscode";

import { captureSelection, captureSelections, toVscodeRange } from "./capture";
import { readFormatSettings, resolveDisplayPath } from "./config";
import { formatEntries, formatLocation, type FormattableEntry } from "./location";
import {
  ADD_SELECTION_COMMAND,
  CLEAR_ALL_COMMAND,
  CONFIGURE_KEYBINDINGS_COMMAND,
  COPY_ALL_COMMAND,
  COPY_ITEM_COMMAND,
  COPY_LOCATION_COMMAND,
  EDIT_NOTE_COMMAND,
  EXTENSION_ID,
  MOVE_DOWN_COMMAND,
  MOVE_UP_COMMAND,
  OPEN_ITEM_COMMAND,
  REMOVE_ITEM_COMMAND,
  UPDATE_RANGE_COMMAND,
  type ALL_COMMANDS,
  type PathStyle,
  type SelectionItem,
} from "./protocol";
import { UnsupportedStateError, type SelectionStore } from "./store";

export type CommandId = (typeof ALL_COMMANDS)[number];
export type CommandHandler = (...args: unknown[]) => Promise<void>;

export interface CommandDependencies {
  store: SelectionStore;
  /** Current tree selection; the fallback target when a command gets no item arguments (e.g. a keybinding). */
  treeSelection: () => readonly SelectionItem[];
}

const STATUS_MESSAGE_TIMEOUT_MS = 3000;

/** Built-in command that opens the Keyboard Shortcuts editor; its argument prefills the search box. */
const OPEN_KEYBINDINGS_COMMAND = "workbench.action.openGlobalKeybindings";

/**
 * Builds one handler per contributed command. The record type forces every
 * command in {@link ALL_COMMANDS} to have a handler. Handlers never reject:
 * failures are reported to the user instead.
 *
 * Tree commands receive `(clickedItem, selectedItems?)` from VS Code. Those
 * objects may be stale renders, so they are resolved by id against the store
 * and unknown ids are ignored. Keybindings pass no arguments, so tree commands
 * then act on the tree selection.
 */
export function createCommandHandlers(
  deps: CommandDependencies,
): Record<CommandId, CommandHandler> {
  const { store } = deps;

  return {
    [COPY_LOCATION_COMMAND]: guarded(() => copyLocation()),
    [ADD_SELECTION_COMMAND]: guarded(() => addSelection(store)),
    [COPY_ALL_COMMAND]: guarded(() => copyAll(store)),
    [CLEAR_ALL_COMMAND]: guarded(() => clearAll(store)),
    [OPEN_ITEM_COMMAND]: guarded((item) => openItem(resolveItem(deps, item))),
    [COPY_ITEM_COMMAND]: guarded((item, selected) =>
      copyItems(resolveTargets(deps, item, selected)),
    ),
    [EDIT_NOTE_COMMAND]: guarded((item) => editNote(store, resolveItem(deps, item))),
    [UPDATE_RANGE_COMMAND]: guarded((item) => updateRange(store, resolveItem(deps, item))),
    [MOVE_UP_COMMAND]: guarded((item) => move(store, resolveItem(deps, item), -1)),
    [MOVE_DOWN_COMMAND]: guarded((item) => move(store, resolveItem(deps, item), 1)),
    [REMOVE_ITEM_COMMAND]: guarded((item, selected) =>
      removeItems(store, resolveTargets(deps, item, selected)),
    ),
    [CONFIGURE_KEYBINDINGS_COMMAND]: guarded(() => configureKeybindings()),
  };
}

async function copyLocation(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage(
      vscode.l10n.t("Open a text editor to copy a selection location."),
    );
    return;
  }

  const settings = readFormatSettings();
  const path = resolveDisplayPath(editor.document.uri, settings.pathStyle);
  const entries = captureSelections(editor).map((capture): FormattableEntry => ({
    path,
    range: capture.range,
    text: capture.text,
    languageId: capture.languageId,
  }));
  await writeLocations(formatEntries(entries, settings), entries.length);
}

async function addSelection(store: SelectionStore): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage(vscode.l10n.t("Open a text editor to add a selection."));
    return;
  }

  // The store applies each add in memory synchronously (dedupe included) and
  // queues writes in call order, so concurrent adds still append in document order.
  const results = await Promise.all(captureSelections(editor).map((capture) => store.add(capture)));
  const added = results.filter((result) => result.added).length;
  const skipped = results.length - added;

  let message: string;
  if (added === 0) {
    message = vscode.l10n.t("Already in the list");
  } else if (skipped > 0) {
    message = vscode.l10n.t("Added {added}; {skipped} already in the list", { added, skipped });
  } else if (added === 1) {
    message = vscode.l10n.t("Added 1 selection to the list");
  } else {
    message = vscode.l10n.t("Added {count} selections to the list", { count: added });
  }
  vscode.window.setStatusBarMessage(message, STATUS_MESSAGE_TIMEOUT_MS);
}

async function copyAll(store: SelectionStore): Promise<void> {
  const items = store.list();
  if (items.length === 0) {
    void vscode.window.showInformationMessage(vscode.l10n.t("The selection list is empty."));
    return;
  }
  await copyItems(items);
}

/** Copies stored snapshots in the given (list) order with the current format settings. */
async function copyItems(items: readonly SelectionItem[]): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const settings = readFormatSettings();
  const entries = items.map((item) => toEntry(item, settings.pathStyle));
  await writeLocations(formatEntries(entries, settings), entries.length);
}

async function removeItems(store: SelectionStore, items: readonly SelectionItem[]): Promise<void> {
  if (items.length > 0) {
    await store.remove(items.map((item) => item.id));
  }
}

async function editNote(store: SelectionStore, item: SelectionItem | undefined): Promise<void> {
  if (!item) {
    return;
  }
  const settings = readFormatSettings();
  const location = formatLocation(
    resolveDisplayPath(vscode.Uri.parse(item.uri), settings.pathStyle),
    item.range,
    settings.locationStyle,
  );
  const note = await vscode.window.showInputBox({
    prompt: vscode.l10n.t("Note for {location}", { location }),
    placeHolder: vscode.l10n.t("Leave empty to remove the note"),
    value: item.note ?? "",
  });
  if (note === undefined) {
    return;
  }
  await store.updateNote(item.id, note);
}

async function updateRange(store: SelectionStore, item: SelectionItem | undefined): Promise<void> {
  if (!item) {
    return;
  }
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage(
      vscode.l10n.t("Open a text editor and select the code to use for this item."),
    );
    return;
  }
  // The item may move to another file; that is the point of re-capturing.
  const replaced = await store.replaceSelection(
    item.id,
    captureSelection(editor.document, editor.selection),
  );
  if (replaced) {
    vscode.window.setStatusBarMessage(
      vscode.l10n.t("Selection updated"),
      STATUS_MESSAGE_TIMEOUT_MS,
    );
  }
}

async function move(
  store: SelectionStore,
  item: SelectionItem | undefined,
  delta: -1 | 1,
): Promise<void> {
  if (item) {
    await store.move(item.id, delta);
  }
}

async function clearAll(store: SelectionStore): Promise<void> {
  if (store.list().length === 0) {
    return;
  }
  const confirm = vscode.l10n.t("Clear");
  const answer = await vscode.window.showWarningMessage(
    vscode.l10n.t("Remove all selections from the list?"),
    { modal: true, detail: vscode.l10n.t("This cannot be undone.") },
    confirm,
  );
  if (answer === confirm) {
    await store.clear();
  }
}

/** Opens the snapshot location, clamped to the current file contents since snapshots do not track edits. */
async function openItem(item: SelectionItem | undefined): Promise<void> {
  if (!item) {
    return;
  }
  const uri = vscode.Uri.parse(item.uri);
  try {
    const editor = await vscode.window.showTextDocument(uri);
    const range = editor.document.validateRange(toVscodeRange(item.range));
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  } catch (error) {
    void vscode.window.showErrorMessage(
      vscode.l10n.t("Unable to open {path}: {detail}", {
        path: resolveDisplayPath(uri, "workspaceRelative"),
        detail: errorDetail(error),
      }),
    );
  }
}

/** Opens the Keyboard Shortcuts editor filtered to this extension's commands. */
async function configureKeybindings(): Promise<void> {
  await vscode.commands.executeCommand(OPEN_KEYBINDINGS_COMMAND, `@ext:${EXTENSION_ID}`);
}

async function writeLocations(text: string, count: number): Promise<void> {
  await vscode.env.clipboard.writeText(text);
  vscode.window.setStatusBarMessage(
    count === 1
      ? vscode.l10n.t("Copied 1 location")
      : vscode.l10n.t("Copied {count} locations", { count }),
    STATUS_MESSAGE_TIMEOUT_MS,
  );
}

function toEntry(item: SelectionItem, pathStyle: PathStyle): FormattableEntry {
  return {
    path: resolveDisplayPath(vscode.Uri.parse(item.uri), pathStyle),
    range: item.range,
    text: item.text,
    languageId: item.languageId,
  };
}

/** Accepts a tree element (anything with a string `id`) or a bare id. */
function idOf(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null && "id" in value) {
    const { id } = value;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

/**
 * Target of a single-item command: the clicked item, else the tree selection
 * when it holds exactly one item (a keybinding gives no arguments, and acting
 * on an arbitrary member of a multi-selection would be surprising).
 */
function resolveItem(deps: CommandDependencies, value: unknown): SelectionItem | undefined {
  let target = value;
  if (target === undefined) {
    const selection = deps.treeSelection();
    target = selection.length === 1 ? selection[0] : undefined;
  }
  const id = idOf(target);
  return id === undefined ? undefined : deps.store.get(id);
}

/**
 * Multi-select semantics: the selected items when VS Code passes them, else the
 * clicked item, else the tree's current selection. Returned in list order.
 */
function resolveTargets(
  deps: CommandDependencies,
  item: unknown,
  selected: unknown,
): SelectionItem[] {
  let candidates: readonly unknown[];
  if (Array.isArray(selected) && selected.length > 0) {
    candidates = selected;
  } else if (item !== undefined) {
    candidates = [item];
  } else {
    candidates = deps.treeSelection();
  }
  const ids = new Set(candidates.map(idOf));
  return deps.store.list().filter((entry) => ids.has(entry.id));
}

function guarded(handler: (...args: unknown[]) => Promise<void>): CommandHandler {
  return async (...args) => {
    try {
      await handler(...args);
    } catch (error) {
      void vscode.window.showErrorMessage(describeError(error));
    }
  };
}

function describeError(error: unknown): string {
  if (error instanceof UnsupportedStateError) {
    return vscode.l10n.t("Stored selection list was written by a newer version; it is read-only.");
  }
  return vscode.l10n.t("Selection Clipboard: {detail}", { detail: errorDetail(error) });
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
