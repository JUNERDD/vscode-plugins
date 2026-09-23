import * as vscode from "vscode";

import { readFormatSettings, resolveDisplayPath, type FormatSettings } from "./config";
import { formatLocation } from "./location";
import { ITEM_CONTEXT_VALUE, OPEN_ITEM_COMMAND, type SelectionItem } from "./protocol";
import type { SelectionStore } from "./store";

/** Tooltip previews stay readable; the full snapshot is still what gets copied. */
const TOOLTIP_MAX_LINES = 30;
const TOOLTIP_MAX_CHARACTERS = 4_000;

/**
 * Flat list view over the store. Labels and tooltips are computed from the
 * current settings on every render, so {@link refresh} is enough to apply a
 * configuration change to existing entries.
 */
export class SelectionTreeProvider
  implements vscode.TreeDataProvider<SelectionItem>, vscode.Disposable
{
  readonly #store: SelectionStore;
  readonly #readSettings: () => FormatSettings;
  readonly #onDidChangeTreeData = new vscode.EventEmitter<SelectionItem | undefined>();
  readonly #storeSubscription: vscode.Disposable;

  readonly onDidChangeTreeData = this.#onDidChangeTreeData.event;

  constructor(store: SelectionStore, readSettings: () => FormatSettings = readFormatSettings) {
    this.#store = store;
    this.#readSettings = readSettings;
    this.#storeSubscription = store.onDidChange(() => this.refresh());
  }

  /** Re-renders every entry. */
  refresh(): void {
    this.#onDidChangeTreeData.fire(undefined);
  }

  getChildren(element?: SelectionItem): SelectionItem[] {
    return element ? [] : [...this.#store.list()];
  }

  getTreeItem(item: SelectionItem): vscode.TreeItem {
    const settings = this.#readSettings();
    const uri = vscode.Uri.parse(item.uri);
    const suffix = formatLocation("", item.range, settings.locationStyle);

    const treeItem = new vscode.TreeItem(
      `${basename(uri)}${suffix}`,
      vscode.TreeItemCollapsibleState.None,
    );
    treeItem.id = item.id;
    treeItem.resourceUri = uri;
    // ThemeIcon.File tells VS Code to pick the file-icon-theme icon for resourceUri.
    treeItem.iconPath = vscode.ThemeIcon.File;
    treeItem.contextValue = ITEM_CONTEXT_VALUE;
    const description = item.note ?? parentDirectory(resolveDisplayPath(uri, "workspaceRelative"));
    if (description !== undefined) {
      treeItem.description = description;
    }
    treeItem.tooltip = buildTooltip(item, uri, settings);
    treeItem.command = {
      command: OPEN_ITEM_COMMAND,
      title: vscode.l10n.t("Go to Selection"),
      arguments: [item],
    };
    return treeItem;
  }

  dispose(): void {
    this.#storeSubscription.dispose();
    this.#onDidChangeTreeData.dispose();
  }
}

function buildTooltip(
  item: SelectionItem,
  uri: vscode.Uri,
  settings: FormatSettings,
): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString();
  tooltip.appendText(
    formatLocation(resolveDisplayPath(uri, settings.pathStyle), item.range, settings.locationStyle),
  );
  if (item.note !== undefined) {
    tooltip.appendMarkdown("\n\n");
    tooltip.appendText(vscode.l10n.t("Note: {note}", { note: item.note }));
  }
  tooltip.appendMarkdown("\n\n");
  tooltip.appendText(
    vscode.l10n.t("Collected {time}", {
      time: new Date(item.createdAt).toLocaleString(vscode.env.language),
    }),
  );

  if (item.text !== "") {
    const { preview, clipped } = previewSnapshot(item.text);
    const fence = fenceFor(preview);
    tooltip.appendMarkdown(`\n\n${fence}${item.languageId}\n${preview}\n${fence}\n`);
    if (clipped) {
      tooltip.appendMarkdown("\n");
      tooltip.appendText(vscode.l10n.t("Preview truncated."));
    }
  }
  if (item.truncated) {
    tooltip.appendMarkdown("\n\n");
    tooltip.appendText(vscode.l10n.t("The code snapshot was truncated when it was collected."));
  }
  return tooltip;
}

/** First lines of the snapshot, bounded by both line count and total length. */
function previewSnapshot(text: string): { preview: string; clipped: boolean } {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  let preview = lines.slice(0, TOOLTIP_MAX_LINES).join("\n");
  let clipped = lines.length > TOOLTIP_MAX_LINES;
  if (preview.length > TOOLTIP_MAX_CHARACTERS) {
    let end = TOOLTIP_MAX_CHARACTERS;
    // Do not split a surrogate pair.
    const code = preview.charCodeAt(end - 1);
    if (code >= 0xd800 && code <= 0xdbff) {
      end -= 1;
    }
    preview = preview.slice(0, end);
    clipped = true;
  }
  return { preview, clipped };
}

/** A backtick fence longer than any backtick run in the text, so the snapshot cannot close it early. */
function fenceFor(text: string): string {
  let longestRun = 0;
  for (const match of text.matchAll(/`+/g)) {
    longestRun = Math.max(longestRun, match[0].length);
  }
  return "`".repeat(Math.max(3, longestRun + 1));
}

function basename(uri: vscode.Uri): string {
  const path = uri.path;
  return path.slice(path.lastIndexOf("/") + 1) || path;
}

/**
 * Directory part of a display path, or undefined for files at a folder root.
 * Outside the workspace the display path is absolute and may use `\` on Windows.
 */
function parentDirectory(displayPath: string): string | undefined {
  const separator = Math.max(displayPath.lastIndexOf("/"), displayPath.lastIndexOf("\\"));
  return separator > 0 ? displayPath.slice(0, separator) : undefined;
}
