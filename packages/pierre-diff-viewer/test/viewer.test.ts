import { beforeEach, describe, expect, it, vi } from "vitest";

const pierre = vi.hoisted(() => {
  const instance = {
    cleanUp: vi.fn(),
    render: vi.fn(),
    scrollTo: vi.fn(),
    setItems: vi.fn(),
    setOptions: vi.fn(),
    setup: vi.fn(),
  };

  return {
    constructor: vi.fn(function MockCodeView(_options?: unknown) {
      return instance;
    }),
    instance,
  };
});

vi.mock("@pierre/diffs", () => ({
  CodeView: pierre.constructor,
  parsePatchFiles: vi.fn(),
  processFile: vi.fn(),
}));

import { DEFAULT_DIFF_VIEWER_SETTINGS, PierreDiffViewer } from "../src";
import type { DiffViewerItem, PierreDiffViewerOptions } from "../src";

interface CapturedCodeViewOptions {
  readonly renderHeaderMetadata?: (file: {
    readonly name: string;
    readonly prevName?: string;
  }) => Element | null | undefined;
}

describe("PierreDiffViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets up once, reconciles items, and forwards option updates", () => {
    const container = { textContent: "stale" } as HTMLElement;
    const item = { id: "src/file.ts", type: "diff" } as DiffViewerItem;
    const viewer = new PierreDiffViewer(container);

    viewer.render([item], { ...DEFAULT_DIFF_VIEWER_SETTINGS });
    viewer.render([item], { ...DEFAULT_DIFF_VIEWER_SETTINGS, overflow: "wrap" });

    expect(pierre.constructor).toHaveBeenCalledTimes(1);
    expect(pierre.instance.setup).toHaveBeenCalledOnce();
    expect(pierre.instance.setup).toHaveBeenCalledWith(container);
    expect(pierre.instance.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ overflow: "wrap" }),
    );
    expect(pierre.instance.setItems).toHaveBeenCalledTimes(2);
    expect(pierre.instance.render).toHaveBeenCalledTimes(2);
    expect(pierre.instance.render).toHaveBeenLastCalledWith(true);
  });

  it("adapts and preserves file-header metadata across option updates", () => {
    const container = { textContent: "stale" } as HTMLElement;
    const metadataElement = {} as Element;
    const renderFileHeaderMetadata = vi.fn<
      NonNullable<PierreDiffViewerOptions["renderFileHeaderMetadata"]>
    >(() => metadataElement);
    const viewer = new PierreDiffViewer(container, { renderFileHeaderMetadata });

    viewer.render([], { ...DEFAULT_DIFF_VIEWER_SETTINGS });
    viewer.render([], { ...DEFAULT_DIFF_VIEWER_SETTINGS, overflow: "wrap" });

    const initialOptions = pierre.constructor.mock.calls[0]?.[0] as
      | CapturedCodeViewOptions
      | undefined;
    const updatedOptions = pierre.instance.setOptions.mock.calls[0]?.[0] as
      | CapturedCodeViewOptions
      | undefined;
    expect(initialOptions?.renderHeaderMetadata).toBeTypeOf("function");
    expect(updatedOptions?.renderHeaderMetadata).toBe(initialOptions?.renderHeaderMetadata);
    expect(
      initialOptions?.renderHeaderMetadata?.({
        name: "src/new-name.ts",
        prevName: "src/old-name.ts",
      }),
    ).toBe(metadataElement);
    expect(renderFileHeaderMetadata).toHaveBeenCalledWith({
      path: "src/new-name.ts",
      previousPath: "src/old-name.ts",
    });
  });

  it("scrolls by parsed item id and releases owned resources", () => {
    const container = { textContent: "rendered" } as HTMLElement;
    const viewer = new PierreDiffViewer(container);

    viewer.render([], { ...DEFAULT_DIFF_VIEWER_SETTINGS });
    viewer.scrollToItem("src/file.ts");
    viewer.cleanUp();

    expect(pierre.instance.scrollTo).toHaveBeenCalledWith({
      type: "item",
      id: "src/file.ts",
      align: "start",
      behavior: "smooth-auto",
    });
    expect(pierre.instance.cleanUp).toHaveBeenCalledOnce();
    expect(container.textContent).toBe("");
  });
});
