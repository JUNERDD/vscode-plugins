import * as vscode from "vscode";
import { describe, expect, it, vi } from "vitest";

import {
  previewSettingsFromReader as settingsFromReader,
  readPreviewSettings,
} from "../../src/config";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_section: string, defaultValue: unknown) => defaultValue),
    })),
  },
}));

describe("settingsFromReader", () => {
  it("reads settings from the Git Toolkit configuration section", () => {
    readPreviewSettings();

    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("gitToolkit");
  });

  it("normalizes invalid values to defaults", () => {
    const settings = settingsFromReader({
      get(section, defaultValue) {
        const values: Record<string, unknown> = {
          "diff.defaultStyle": "sideways",
          "diff.overflow": "wrap",
          "diff.darkTheme": "  ",
          "diff.enableLineSelection": "yes",
          "diff.tokenizeMaxLength": 20000000,
          "diffPreview.maxFileSizeBytes": -1,
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
