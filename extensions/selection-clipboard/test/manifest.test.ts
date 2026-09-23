import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ADD_SELECTION_COMMAND,
  ALL_COMMANDS,
  CLEAR_ALL_COMMAND,
  CONFIGURATION_SECTION,
  COPY_ALL_COMMAND,
  COPY_ITEM_COMMAND,
  COPY_LOCATION_COMMAND,
  EDIT_NOTE_COMMAND,
  EDITOR_CONTEXT_SUBMENU_ID,
  INCLUDE_CODE_SETTING,
  ITEM_CONTEXT_VALUE,
  ITEMS_VIEW_ID,
  LOCATION_STYLE_SETTING,
  MOVE_DOWN_COMMAND,
  MOVE_UP_COMMAND,
  OPEN_ITEM_COMMAND,
  PATH_STYLE_SETTING,
  REMOVE_ITEM_COMMAND,
  UPDATE_RANGE_COMMAND,
  VIEW_CONTAINER_ID,
} from "../src/protocol";

/** A menu entry references either a command or a submenu, never both. */
interface MenuItem {
  readonly command?: string;
  readonly submenu?: string;
  readonly group?: string;
  readonly when?: string;
}

interface ExtensionManifest {
  readonly activationEvents: readonly string[];
  readonly contributes: {
    readonly commands: readonly {
      readonly category?: string;
      readonly command: string;
      readonly icon?: string;
      readonly title: string;
    }[];
    readonly submenus: readonly { readonly id: string; readonly label: string }[];
    readonly configuration: {
      readonly title: string;
      readonly properties: Record<
        string,
        { readonly default?: unknown; readonly enum?: readonly string[] }
      >;
    };
    readonly menus: Record<string, readonly MenuItem[]>;
    readonly views: Record<string, readonly { readonly id: string; readonly name: string }[]>;
    readonly viewsContainers: {
      readonly activitybar: readonly {
        readonly icon: string;
        readonly id: string;
        readonly title: string;
      }[];
    };
    readonly viewsWelcome: readonly { readonly contents: string; readonly view: string }[];
  };
  readonly extensionDependencies?: readonly string[];
  readonly name: string;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as T;
}

const manifest = readJson<ExtensionManifest>("../package.json");
const nlsEnglish = readJson<Record<string, string>>("../package.nls.json");
const nlsChinese = readJson<Record<string, string>>("../package.nls.zh-cn.json");

const VIEW_WHEN = `view == ${ITEMS_VIEW_ID}`;
const ITEM_WHEN = `${VIEW_WHEN} && viewItem == ${ITEM_CONTEXT_VALUE}`;

/** Item commands receive a tree node argument, so the Command Palette cannot invoke them. */
const ITEM_ONLY_COMMANDS = [
  OPEN_ITEM_COMMAND,
  COPY_ITEM_COMMAND,
  EDIT_NOTE_COMMAND,
  UPDATE_RANGE_COMMAND,
  MOVE_UP_COMMAND,
  MOVE_DOWN_COMMAND,
  REMOVE_ITEM_COMMAND,
];

function menu(id: string): readonly MenuItem[] {
  return manifest.contributes.menus[id] ?? [];
}

function collectNlsKeys(value: unknown, keys: Set<string>): Set<string> {
  if (typeof value === "string") {
    const match = /^%([^%]+)%$/.exec(value);
    if (match?.[1] !== undefined) {
      keys.add(match[1]);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectNlsKeys(item, keys);
    }
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectNlsKeys(item, keys);
    }
  }
  return keys;
}

describe("Selection Clipboard manifest", () => {
  it("declares exactly the protocol commands with localized titles", () => {
    const commands = manifest.contributes.commands;

    expect(manifest.name).toBe("selection-clipboard");
    expect(commands.map(({ command }) => command)).toEqual([...ALL_COMMANDS]);
    for (const { category, command, icon, title } of commands) {
      const verb = command.slice(command.lastIndexOf(".") + 1);
      expect(title).toBe(`%command.${verb}.title%`);
      // The product name comes from the category so submenu items stay short
      // while the Command Palette still shows "Selection Clipboard: ...".
      expect(category).toBe("%command.category%");
      expect(icon).toMatch(/^\$\([a-z-]+\)$/);
    }
    for (const nls of [nlsEnglish, nlsChinese]) {
      const titles = Object.entries(nls).filter(([key]) => /^command\..+\.title$/.test(key));
      expect(titles.filter(([, value]) => value.startsWith(nls["command.category"] ?? ""))).toEqual(
        [],
      );
    }
  });

  it("activates on every command and on the items view", () => {
    // oxfmt sorts package.json activationEvents, so compare without order.
    expect(manifest.activationEvents.toSorted()).toEqual(
      [
        ...ALL_COMMANDS.map((command) => `onCommand:${command}`),
        `onView:${ITEMS_VIEW_ID}`,
      ].toSorted(),
    );
  });

  it("only references declared commands from menus", () => {
    const commands = new Set<string>(ALL_COMMANDS);
    const submenus = new Set(manifest.contributes.submenus.map(({ id }) => id));
    const entries = Object.values(manifest.contributes.menus).flat();

    // Each entry must target exactly one declared command or submenu.
    expect(
      entries.filter(({ command, submenu }) => (command === undefined) === (submenu === undefined)),
    ).toEqual([]);
    expect(
      entries.filter(({ command }) => command !== undefined && !commands.has(command)),
    ).toEqual([]);
    expect(
      entries.filter(({ submenu }) => submenu !== undefined && !submenus.has(submenu)),
    ).toEqual([]);
    expect(manifest.extensionDependencies).toBeUndefined();
  });

  it("hides exactly the item-only commands from the Command Palette", () => {
    const palette = menu("commandPalette");

    expect(palette.map(({ command }) => command).toSorted()).toEqual(ITEM_ONLY_COMMANDS.toSorted());
    expect(palette.every(({ when }) => when === "false")).toBe(true);
  });

  it("groups selection actions in one editor context submenu", () => {
    expect(manifest.contributes.submenus).toEqual([
      { id: EDITOR_CONTEXT_SUBMENU_ID, label: "%submenu.editorContext.label%" },
    ]);
    expect(menu("editor/context")).toEqual([
      { submenu: EDITOR_CONTEXT_SUBMENU_ID, group: "9_cutcopypaste@100" },
    ]);
    expect(menu(EDITOR_CONTEXT_SUBMENU_ID)).toEqual([
      { command: COPY_LOCATION_COMMAND, group: "1_copy@1" },
      { command: ADD_SELECTION_COMMAND, group: "2_collect@1" },
    ]);
  });

  it("scopes view title and item actions to the protocol view and item context", () => {
    expect(menu("view/title")).toEqual([
      { command: ADD_SELECTION_COMMAND, when: VIEW_WHEN, group: "navigation@1" },
      { command: COPY_ALL_COMMAND, when: VIEW_WHEN, group: "navigation@2" },
      { command: CLEAR_ALL_COMMAND, when: VIEW_WHEN, group: "navigation@3" },
    ]);

    const itemMenu = menu("view/item/context");
    expect(itemMenu.every(({ when }) => when === ITEM_WHEN)).toBe(true);
    expect(itemMenu.map(({ command, group }) => [command, group])).toEqual([
      [COPY_ITEM_COMMAND, "inline@1"],
      [EDIT_NOTE_COMMAND, "inline@2"],
      [REMOVE_ITEM_COMMAND, "inline@3"],
      [COPY_ITEM_COMMAND, "1_copy@1"],
      [EDIT_NOTE_COMMAND, "2_edit@1"],
      [UPDATE_RANGE_COMMAND, "2_edit@2"],
      [MOVE_UP_COMMAND, "3_order@1"],
      [MOVE_DOWN_COMMAND, "3_order@2"],
      [REMOVE_ITEM_COMMAND, "4_remove@1"],
    ]);
  });

  it("contributes the Activity Bar container, items view, and welcome content", () => {
    const { views, viewsContainers, viewsWelcome } = manifest.contributes;

    expect(viewsContainers.activitybar).toEqual([
      expect.objectContaining({ id: VIEW_CONTAINER_ID, icon: "media/selection-clipboard.svg" }),
    ]);
    expect(existsSync(new URL("../media/selection-clipboard.svg", import.meta.url))).toBe(true);
    expect(Object.keys(views)).toEqual([VIEW_CONTAINER_ID]);
    expect(views[VIEW_CONTAINER_ID]?.map(({ id }) => id)).toEqual([ITEMS_VIEW_ID]);
    expect(viewsWelcome.map(({ view }) => view)).toEqual([ITEMS_VIEW_ID]);
    for (const nls of [nlsEnglish, nlsChinese]) {
      expect(nls["viewsWelcome.items.contents"]).toContain(`](command:${ADD_SELECTION_COMMAND})`);
    }
  });

  it("keeps configuration inside the protocol section", () => {
    const properties = manifest.contributes.configuration.properties;

    expect(Object.keys(properties)).toEqual(
      [LOCATION_STYLE_SETTING, PATH_STYLE_SETTING, INCLUDE_CODE_SETTING].map(
        (setting) => `${CONFIGURATION_SECTION}.${setting}`,
      ),
    );
    expect(properties[`${CONFIGURATION_SECTION}.${LOCATION_STYLE_SETTING}`]).toMatchObject({
      enum: ["lineColumn", "lineRange", "githubAnchor"],
      default: "lineColumn",
    });
    expect(properties[`${CONFIGURATION_SECTION}.${PATH_STYLE_SETTING}`]).toMatchObject({
      enum: ["workspaceRelative", "absolute"],
      default: "workspaceRelative",
    });
    expect(properties[`${CONFIGURATION_SECTION}.${INCLUDE_CODE_SETTING}`]).toMatchObject({
      default: false,
    });
  });

  it("localizes every manifest placeholder in English and Chinese", () => {
    const usedKeys = [...collectNlsKeys(manifest, new Set())].toSorted();
    const englishKeys = Object.keys(nlsEnglish).toSorted();

    expect(Object.keys(nlsChinese).toSorted()).toEqual(englishKeys);
    expect(usedKeys.filter((key) => !(key in nlsEnglish))).toEqual([]);
    expect(englishKeys.filter((key) => !usedKeys.includes(key))).toEqual([]);
    expect(nlsEnglish["extension.displayName"]).toBe("Selection Clipboard");
    expect(nlsChinese["extension.displayName"]).toBe("选区剪贴板");
  });
});
