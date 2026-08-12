import { describe, expect, it, vi } from "vitest";

import { commitTreeSettingsFromReader as settingsFromReader } from "../src/config";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_section: string, defaultValue: unknown) => defaultValue),
    })),
  },
}));

describe("settingsFromReader", () => {
  it("normalizes invalid values and preserves supported overrides", () => {
    const settings = settingsFromReader({
      get(section, defaultValue) {
        const values: Record<string, unknown> = {
          "commitTree.flattenEmptyDirectories": "yes",
          "commitTree.maxPatchSizeBytes": Number.POSITIVE_INFINITY,
          "commitTree.treeWidth": 9999,
          "diff.customCss": ".diff { opacity: 0.9; }",
          "diff.darkTheme": "  github-dark  ",
          "diff.defaultStyle": "sideways",
          "diff.disableLineNumbers": true,
          "diff.expansionLineCount": 24.9,
          "diff.lightTheme": "  ",
          "diff.overflow": "wrap",
          "diff.preferredHighlighter": "shiki-wasm",
          "diff.stickyHeaders": false,
          "diff.themeType": "dark",
        };

        return (section in values ? values[section] : defaultValue) as never;
      },
    });

    expect(settings.diff.defaultStyle).toBe("split");
    expect(settings.diff.overflow).toBe("wrap");
    expect(settings.diff.themeType).toBe("dark");
    expect(settings.diff.darkTheme).toBe("github-dark");
    expect(settings.diff.lightTheme).toBe("pierre-light");
    expect(settings.diff.preferredHighlighter).toBe("shiki-wasm");
    expect(settings.diff.disableLineNumbers).toBe(true);
    expect(settings.diff.stickyHeaders).toBe(false);
    expect(settings.diff.expansionLineCount).toBe(24);
    expect(settings.diff.customCss).toBe(".diff { opacity: 0.9; }");
    expect(settings.flattenEmptyDirectories).toBe(false);
    expect(settings.maxPatchSizeBytes).toBe(26214400);
    expect(settings.treeWidth).toBe(600);
  });
});
