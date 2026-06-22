import * as vscode from "vscode";
import { getExtensionReadyMessage } from "@vscode-plugins/shared";

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand("vscode-plugins-example.helloWorld", () => {
    void vscode.window.showInformationMessage(getExtensionReadyMessage("Example Extension"));
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
