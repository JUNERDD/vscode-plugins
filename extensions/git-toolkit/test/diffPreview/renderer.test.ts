import { describe, expect, it, vi } from "vitest";

const diffViewer = vi.hoisted(() => ({
  cleanUp: vi.fn(),
  parseDiffDocument: vi.fn(() => ({
    files: [],
    items: [{}],
    stats: { additions: 1, deletions: 0, files: 1, hunks: 1 },
  })),
  render: vi.fn(),
}));

vi.mock("../../src/diffViewer", () => ({
  parseDiffDocument: diffViewer.parseDiffDocument,
  PierreDiffViewer: vi.fn(function MockPierreDiffViewer() {
    return {
      cleanUp: diffViewer.cleanUp,
      render: diffViewer.render,
    };
  }),
}));

import type { DiffPreviewSettings } from "../../src/diffPreview/protocol";
import { DiffPreviewRuntime } from "../../src/diffPreview/webview/renderer";

describe("DiffPreviewRuntime", () => {
  it("includes the document URI in the parser cache key", () => {
    const runtime = new DiffPreviewRuntime({} as HTMLElement);
    const settings = {} as DiffPreviewSettings;

    runtime.render({
      documentUri: "file:///workspace/change.diff",
      settings,
      sizeBytes: 128,
      text: "patch",
      version: 4,
    });

    expect(diffViewer.parseDiffDocument).toHaveBeenCalledWith("patch", {
      cacheKey: "diff-preview:file:///workspace/change.diff:4",
      version: 4,
    });
    expect(diffViewer.render).toHaveBeenCalledWith([{}], settings);
  });
});
