import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface ExtensionManifest {
  readonly activationEvents: readonly string[];
  readonly contributes: {
    readonly commands: readonly { readonly command: string; readonly icon?: string }[];
    readonly configuration: { readonly properties: Record<string, unknown> };
    readonly customEditors: readonly { readonly viewType: string }[];
    readonly menus: Record<
      string,
      readonly {
        readonly command: string;
        readonly group?: string;
        readonly when?: string;
      }[]
    >;
  };
  readonly extensionDependencies?: readonly string[];
  readonly name: string;
}

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as ExtensionManifest;

describe("Git Toolkit manifest", () => {
  it("publishes one extension identity with every feature entry point", () => {
    const commands = manifest.contributes.commands.map(({ command }) => command);

    expect(manifest.name).toBe("git-toolkit");
    expect(commands).toEqual([
      "vscode-plugins-git-toolkit.openCommit",
      "vscode-plugins-git-toolkit.openFromHistory",
      "vscode-plugins-git-toolkit.openDiffPreview",
      "vscode-plugins-git-toolkit.openDiffPreviewToSide",
      "vscode-plugins-git-toolkit.compareFileWithBranch",
    ]);
    expect(manifest.contributes.customEditors).toEqual([
      expect.objectContaining({ viewType: "vscode-plugins-git-toolkit.diffPreview" }),
    ]);
    const expectedActivationEvents = [
      ...commands.map((command) => `onCommand:${command}`),
      "onCustomEditor:vscode-plugins-git-toolkit.diffPreview",
    ];
    expect(manifest.activationEvents).toHaveLength(expectedActivationEvents.length);
    expect(new Set(manifest.activationEvents)).toEqual(new Set(expectedActivationEvents));
  });

  it("keeps every contribution inside the Git Toolkit contract", () => {
    const commands = new Set(manifest.contributes.commands.map(({ command }) => command));
    const menuCommands = Object.values(manifest.contributes.menus).flatMap((items) =>
      items.map(({ command }) => command),
    );

    expect(menuCommands.every((command) => commands.has(command))).toBe(true);
    expect(
      Object.keys(manifest.contributes.configuration.properties).every((key) =>
        key.startsWith("gitToolkit."),
      ),
    ).toBe(true);
    expect(manifest.extensionDependencies).toBeUndefined();
  });

  it("keeps branch comparison visible in the editor title toolbar", () => {
    const command = "vscode-plugins-git-toolkit.compareFileWithBranch";
    const commandContribution = manifest.contributes.commands.find(
      (item) => item.command === command,
    );
    const editorTitleContribution = manifest.contributes.menus["editor/title"]?.find(
      (item) => item.command === command,
    );

    expect(commandContribution).toMatchObject({ icon: "$(git-compare)" });
    expect(editorTitleContribution).toEqual({
      command,
      group: "navigation@0",
      when: "resourceScheme == file",
    });
  });
});
