import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const diffViewer = {
    cleanUp: vi.fn(),
    render: vi.fn(),
    scrollToItem: vi.fn(),
  };
  const fileTree = {
    cleanUp: vi.fn(),
    getSelectedPaths: vi.fn<() => readonly string[]>(() => ["src/a.ts"]),
    render: vi.fn(),
  };
  const state: { fileTreeOptions: Record<string, unknown> | undefined } = {
    fileTreeOptions: undefined,
  };
  const viewerState: {
    options:
      | {
          renderFileHeaderMetadata?: (file: { path: string }) => HTMLElement | null | undefined;
        }
      | undefined;
  } = { options: undefined };

  return { diffViewer, fileTree, state, viewerState };
});

vi.mock("@pierre/trees", () => ({
  FileTree: vi.fn(function MockFileTree(options: Record<string, unknown>) {
    mocks.state.fileTreeOptions = options;
    return mocks.fileTree;
  }),
}));

vi.mock("../src/diffViewer", () => {
  const item = { id: "src/a.ts", type: "diff", version: 0 };

  return {
    PierreDiffViewer: vi.fn(function MockPierreDiffViewer(
      _container: HTMLElement,
      options?: {
        renderFileHeaderMetadata?: (file: { path: string }) => HTMLElement | null | undefined;
      },
    ) {
      mocks.viewerState.options = options;
      return mocks.diffViewer;
    }),
    parseDiffDocument: vi.fn(() => ({
      files: [
        {
          additions: 1,
          deletions: 0,
          hunks: 1,
          id: "src/a.ts",
          item,
          path: "src/a.ts",
          status: "modified",
        },
      ],
      items: [item],
      stats: { additions: 1, deletions: 0, files: 1, hunks: 1 },
    })),
  };
});

import { CommitTreeRuntime } from "../src/webview/viewer";

class TestElement {
  readonly attributes = new Map<string, string>();
  readonly children: unknown[] = [];
  readonly dataset: Record<string, string | undefined> = {};
  readonly listeners = new Map<string, EventListener>();
  readonly style: Record<string, string> = {};
  className = "";
  tabIndex = 0;
  textContent = "";
  title = "";
  type = "";

  constructor(readonly tagName = "DIV") {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener === "function") {
      this.listeners.set(type, listener);
    }
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (this.listeners.get(type) === listener) {
      this.listeners.delete(type);
    }
  }

  append(...nodes: unknown[]): void {
    this.children.push(...nodes);
  }

  focus(): void {}

  querySelector(): null {
    return null;
  }

  replaceChildren(...nodes: unknown[]): void {
    this.children.splice(0, this.children.length, ...nodes);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

describe("CommitTreeRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.fileTreeOptions = undefined;
    mocks.viewerState.options = undefined;
    vi.stubGlobal("HTMLElement", TestElement);
    vi.stubGlobal("document", {
      activeElement: undefined,
      createElement: (tagName: string) => new TestElement(tagName.toUpperCase()),
      createElementNS: (_namespace: string, tagName: string) =>
        new TestElement(tagName.toUpperCase()),
      createTextNode: (text: string) => ({ textContent: text }),
    });
  });

  it("reveals a file when the already-selected tree row is clicked again", () => {
    const viewerMount = new TestElement();
    const treeMount = new TestElement();
    const onFileSelected = vi.fn();
    const runtime = new CommitTreeRuntime(
      viewerMount as unknown as HTMLElement,
      treeMount as unknown as HTMLElement,
      createRuntimeOptions({ onFileSelected }),
    );
    runtime.render({
      commit: {
        hash: "1234567890abcdef1234567890abcdef12345678",
        patch: "diff",
        patchSizeBytes: 4,
        repositoryName: "project",
        repositoryUri: "file:///repo/project",
        shortHash: "1234567890",
        subject: "test",
      },
      settings: {
        diff: { themeType: "dark" },
        flattenEmptyDirectories: true,
      },
    } as never);

    const row = new TestElement();
    row.dataset.itemPath = "src/a.ts";
    row.dataset.itemType = "file";
    const clickListener = treeMount.listeners.get("click");
    clickListener?.({ composedPath: () => [row] } as unknown as Event);

    expect(mocks.diffViewer.scrollToItem).toHaveBeenCalledWith("src/a.ts");
    expect(onFileSelected).toHaveBeenCalledOnce();

    runtime.cleanUp();
    expect(treeMount.listeners.has("click")).toBe(false);
    expect(treeMount.listeners.has("dblclick")).toBe(false);
  });

  it("opens a file when its tree row is double-clicked", () => {
    const viewerMount = new TestElement();
    const treeMount = new TestElement();
    const onOpenFile = vi.fn();
    const runtime = new CommitTreeRuntime(
      viewerMount as unknown as HTMLElement,
      treeMount as unknown as HTMLElement,
      createRuntimeOptions({ onOpenFile }),
    );
    renderRuntime(runtime);

    const row = new TestElement();
    row.dataset.itemPath = "src/a.ts";
    row.dataset.itemType = "file";
    treeMount.listeners.get("dblclick")?.({ composedPath: () => [row] } as unknown as Event);

    expect(onOpenFile).toHaveBeenCalledWith("src/a.ts");
  });

  it("provides open and copy actions in file headers and the tree menu", () => {
    const onCopyFileName = vi.fn();
    const onOpenFile = vi.fn();
    const runtime = new CommitTreeRuntime(
      new TestElement() as unknown as HTMLElement,
      new TestElement() as unknown as HTMLElement,
      createRuntimeOptions({ onCopyFileName, onOpenFile }),
    );
    renderRuntime(runtime);

    const renderFileHeaderMetadata = mocks.viewerState.options?.renderFileHeaderMetadata;
    expect(renderFileHeaderMetadata).toBeTypeOf("function");
    if (renderFileHeaderMetadata == null) {
      throw new Error("Missing file header renderer");
    }

    const header = renderFileHeaderMetadata({ path: "src/a.ts" });
    const headerButtons = (header as unknown as TestElement).children as TestElement[];
    activate(headerButtons[0]);
    activate(headerButtons[1]);

    expect(onOpenFile).toHaveBeenCalledWith("src/a.ts");
    expect(onCopyFileName).toHaveBeenCalledWith("src/a.ts");

    const fileTreeOptions = mocks.state.fileTreeOptions;
    if (fileTreeOptions == null) {
      throw new Error("Missing file tree options");
    }

    const contextMenu = (
      fileTreeOptions.composition as {
        contextMenu: {
          buttonVisibility: string;
          render: (item: unknown, context: unknown) => HTMLElement;
          triggerMode: string;
        };
      }
    ).contextMenu;
    const close = vi.fn();
    const menu = contextMenu.render(
      { kind: "file", name: "a.ts", path: "src/a.ts" },
      {
        anchorRect: { bottom: 100, right: 300, top: 74 },
        close,
        restoreFocus: vi.fn(),
      },
    ) as unknown as TestElement;
    const menuButtons = menu.children as TestElement[];
    activate(menuButtons[0]);
    activate(menuButtons[1]);

    expect(contextMenu.buttonVisibility).toBe("when-needed");
    expect(contextMenu.triggerMode).toBe("both");
    expect(close).toHaveBeenNthCalledWith(1, { restoreFocus: false });
    expect(close).toHaveBeenNthCalledWith(2);
    expect(onOpenFile).toHaveBeenCalledTimes(2);
    expect(onCopyFileName).toHaveBeenCalledTimes(2);
  });

  it("shows a check icon only after file-name copy success is confirmed", () => {
    vi.useFakeTimers();
    const onCopyFileName = vi.fn();
    const runtime = new CommitTreeRuntime(
      new TestElement() as unknown as HTMLElement,
      new TestElement() as unknown as HTMLElement,
      createRuntimeOptions({ onCopyFileName }),
    );

    try {
      renderRuntime(runtime);
      const renderFileHeaderMetadata = mocks.viewerState.options?.renderFileHeaderMetadata;
      if (renderFileHeaderMetadata == null) {
        throw new Error("Missing file header renderer");
      }

      const header = renderFileHeaderMetadata({ path: "src/a.ts" });
      const copyButton = ((header as unknown as TestElement).children as TestElement[])[1];
      const copyIconPath = getIconPath(copyButton);
      activate(copyButton);

      expect(onCopyFileName).toHaveBeenCalledWith("src/a.ts");
      expect(copyButton?.dataset.copyState).toBe("idle");
      expect(getIconPath(copyButton)).toBe(copyIconPath);

      runtime.showFileNameCopied("src/a.ts");

      expect(copyButton?.dataset.copyState).toBe("copied");
      expect(copyButton?.attributes.get("aria-label")).toBe("File name copied");
      expect(getIconPath(copyButton)).not.toBe(copyIconPath);

      vi.advanceTimersByTime(800);
      runtime.showFileNameCopied("src/a.ts");
      vi.advanceTimersByTime(800);

      expect(copyButton?.dataset.copyState).toBe("copied");

      vi.advanceTimersByTime(800);

      expect(copyButton?.dataset.copyState).toBe("idle");
      expect(copyButton?.attributes.get("aria-label")).toBe("Copy file name");
      expect(getIconPath(copyButton)).toBe(copyIconPath);
    } finally {
      runtime.cleanUp();
      vi.useRealTimers();
    }
  });
});

function createRuntimeOptions(
  overrides: Partial<ConstructorParameters<typeof CommitTreeRuntime>[2]> = {},
): ConstructorParameters<typeof CommitTreeRuntime>[2] {
  return {
    copyFileNameLabel: "Copy file name",
    copyFolderNameLabel: "Copy folder name",
    fileActionsLabel: "File actions",
    fileNameCopiedLabel: "File name copied",
    fileTreeLabel: "Changed files",
    onCopyFileName: vi.fn(),
    onFileSelected: vi.fn(),
    onOpenFile: vi.fn(),
    openWorkingTreeFileLabel: "Open working tree file",
    searchChangedFilesLabel: "Search changed files",
    ...overrides,
  };
}

function renderRuntime(runtime: CommitTreeRuntime): void {
  runtime.render({
    commit: {
      hash: "1234567890abcdef1234567890abcdef12345678",
      patch: "diff",
      patchSizeBytes: 4,
      repositoryName: "project",
      repositoryUri: "file:///repo/project",
      shortHash: "1234567890",
      subject: "test",
    },
    settings: {
      diff: { themeType: "dark" },
      flattenEmptyDirectories: true,
    },
  } as never);
}

function activate(element: TestElement | undefined): void {
  element?.listeners.get("click")?.({
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as Event);
}

function getIconPath(button: TestElement | undefined): string | undefined {
  const icon = button?.children[0] as TestElement | undefined;
  const path = icon?.children[0] as TestElement | undefined;
  return path?.attributes.get("d");
}
