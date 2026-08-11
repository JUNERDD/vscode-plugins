import { describe, expect, it, vi } from "vitest";

import { settingsFromReader } from "../src/config";

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
          "view.defaultStyle": "sideways",
          "view.flattenEmptyDirectories": "yes",
          "view.maxPatchSizeBytes": Number.POSITIVE_INFINITY,
          "view.overflow": "wrap",
          "view.stickyHeaders": false,
          "view.treeWidth": 9999,
        };

        return (section in values ? values[section] : defaultValue) as never;
      },
    });

    expect(settings.diff.defaultStyle).toBe("split");
    expect(settings.diff.overflow).toBe("wrap");
    expect(settings.diff.stickyHeaders).toBe(false);
    expect(settings.flattenEmptyDirectories).toBe(false);
    expect(settings.maxPatchSizeBytes).toBe(26214400);
    expect(settings.treeWidth).toBe(600);
  });
});
