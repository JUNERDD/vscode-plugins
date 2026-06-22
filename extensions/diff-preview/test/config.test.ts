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
  it("normalizes invalid values to defaults", () => {
    const settings = settingsFromReader({
      get(section, defaultValue) {
        const values: Record<string, unknown> = {
          "view.defaultStyle": "sideways",
          "view.overflow": "wrap",
          "view.darkTheme": "  ",
          "view.enableLineSelection": "yes",
          "view.maxFileSizeBytes": -1,
          "view.tokenizeMaxLength": 20000000,
        };

        return (section in values ? values[section] : defaultValue) as never;
      },
    });

    expect(settings.defaultStyle).toBe("split");
    expect(settings.overflow).toBe("wrap");
    expect(settings.darkTheme).toBe("pierre-dark");
    expect(settings.enableLineSelection).toBe(false);
    expect(settings.maxFileSizeBytes).toBe(1);
    expect(settings.tokenizeMaxLength).toBe(10000000);
  });
});
