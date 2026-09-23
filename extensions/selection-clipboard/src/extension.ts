import * as vscode from "vscode";

import { createCommandHandlers } from "./commands";
import { ALL_COMMANDS, CONFIGURATION_SECTION, ITEMS_VIEW_ID, type SelectionItem } from "./protocol";
import { SelectionStore } from "./store";
import { SelectionTreeProvider } from "./treeProvider";

export function activate(context: vscode.ExtensionContext): void {
  const store = new SelectionStore(context.workspaceState);
  const provider = new SelectionTreeProvider(store);
  const treeView = vscode.window.createTreeView<SelectionItem>(ITEMS_VIEW_ID, {
    treeDataProvider: provider,
    canSelectMany: true,
  });
  if (store.readOnly) {
    treeView.message = vscode.l10n.t(
      "Stored selection list was written by a newer version; it is read-only.",
    );
  }

  const updateBadge = (): void => {
    const count = store.list().length;
    treeView.badge =
      count === 0
        ? undefined
        : {
            value: count,
            tooltip:
              count === 1
                ? vscode.l10n.t("1 selection")
                : vscode.l10n.t("{count} selections", { count }),
          };
  };
  updateBadge();

  const handlers = createCommandHandlers({ store, treeSelection: () => treeView.selection });

  context.subscriptions.push(
    // Disposing the store drops every listener, so disposal order does not matter.
    store,
    provider,
    treeView,
    store.onDidChange(updateBadge),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIGURATION_SECTION)) {
        provider.refresh();
      }
    }),
    ...ALL_COMMANDS.map((command) => vscode.commands.registerCommand(command, handlers[command])),
  );
}

export function deactivate(): void {}
