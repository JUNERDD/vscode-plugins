import {
  type ContextMenuItem,
  type ContextMenuOpenContext,
  FileTree,
  type GitStatus,
  type GitStatusEntry,
} from "@pierre/trees";
import {
  PierreDiffViewer,
  parseDiffDocument,
  type DiffViewerSettings,
  type ParsedDiffDocument,
  type ParsedDiffFile,
} from "../diffViewer";

import type { CommitSnapshot, CommitTreeSettings } from "../protocol";

export interface CommitTreeRenderRequest {
  readonly commit: CommitSnapshot;
  readonly settings: CommitTreeSettings;
}

export interface CommitTreeRuntimeOptions {
  readonly copyFileNameLabel: string;
  readonly copyFolderNameLabel: string;
  readonly fileActionsLabel: string;
  readonly fileNameCopiedLabel: string;
  readonly fileTreeLabel: string;
  readonly onCopyFileName: (path: string) => void;
  readonly onFileSelected: () => void;
  readonly onOpenFile: (path: string) => void;
  readonly openWorkingTreeFileLabel: string;
  readonly searchChangedFilesLabel: string;
}

export class CommitTreeRuntime {
  private readonly copiedPaths = new Set<string>();
  private readonly copyButtonsByPath = new Map<string, HTMLButtonElement>();
  private readonly copyResetTimers = new Map<string, ReturnType<typeof globalThis.setTimeout>>();
  private readonly diffViewer: PierreDiffViewer;
  private readonly handleTreeClick = (event: MouseEvent): void => {
    const path = getClickedFilePath(event);
    const selectedPaths = this.tree?.getSelectedPaths();
    if (path != null && selectedPaths?.length === 1 && selectedPaths[0] === path) {
      this.revealFile(path);
    }
  };
  private readonly handleTreeDoubleClick = (event: MouseEvent): void => {
    const path = getClickedFilePath(event);
    if (path != null) {
      this.options.onOpenFile(path);
    }
  };
  private pathToItemId = new Map<string, string>();
  private parsed: ParsedDiffDocument | undefined;
  private parsedKey: string | undefined;
  private tree: FileTree | undefined;
  private treeKey: string | undefined;

  constructor(
    private readonly viewerMount: HTMLElement,
    private readonly treeMount: HTMLElement,
    private readonly options: CommitTreeRuntimeOptions,
  ) {
    this.diffViewer = new PierreDiffViewer(viewerMount, {
      renderFileHeaderMetadata: ({ path }) => this.createFileHeaderActions(path),
    });
    // Capture the pre-click selection so re-clicking the selected file still
    // reveals it; FileTree intentionally emits no selection-change in that case.
    this.treeMount.addEventListener("click", this.handleTreeClick, true);
    this.treeMount.addEventListener("dblclick", this.handleTreeDoubleClick, true);
  }

  render(request: CommitTreeRenderRequest): ParsedDiffDocument {
    const parsedKey = `${request.commit.hash}:${request.commit.parentHash ?? "root"}:${request.commit.patchSizeBytes}`;

    if (this.parsed == null || this.parsedKey !== parsedKey) {
      this.parsed = parseDiffDocument(request.commit.patch, {
        cacheKey: `git-toolkit:commit:${request.commit.hash}:${request.commit.parentHash ?? "root"}`,
        version: 0,
      });
      this.parsedKey = parsedKey;
    }

    this.diffViewer.render(this.parsed.items, request.settings.diff);
    this.renderTree(this.parsed, request.settings, parsedKey);
    return this.parsed;
  }

  showFileNameCopied(path: string): void {
    const currentTimer = this.copyResetTimers.get(path);
    if (currentTimer != null) {
      globalThis.clearTimeout(currentTimer);
    }

    this.copiedPaths.add(path);
    const button = this.copyButtonsByPath.get(path);
    if (button != null) {
      setCopyButtonState(
        button,
        true,
        this.options.copyFileNameLabel,
        this.options.fileNameCopiedLabel,
      );
    }

    const resetTimer = globalThis.setTimeout(() => {
      this.copiedPaths.delete(path);
      this.copyResetTimers.delete(path);
      const activeButton = this.copyButtonsByPath.get(path);
      if (activeButton != null) {
        setCopyButtonState(
          activeButton,
          false,
          this.options.copyFileNameLabel,
          this.options.fileNameCopiedLabel,
        );
      }
    }, COPY_FEEDBACK_DURATION_MS);
    this.copyResetTimers.set(path, resetTimer);
  }

  cleanUp(): void {
    this.treeMount.removeEventListener("click", this.handleTreeClick, true);
    this.treeMount.removeEventListener("dblclick", this.handleTreeDoubleClick, true);
    this.tree?.cleanUp();
    this.tree = undefined;
    this.treeKey = undefined;
    this.diffViewer.cleanUp();
    for (const timer of this.copyResetTimers.values()) {
      globalThis.clearTimeout(timer);
    }
    this.copiedPaths.clear();
    this.copyButtonsByPath.clear();
    this.copyResetTimers.clear();
    this.pathToItemId.clear();
    this.treeMount.textContent = "";
    this.viewerMount.textContent = "";
  }

  private renderTree(
    parsed: ParsedDiffDocument,
    settings: CommitTreeSettings,
    parsedKey: string,
  ): void {
    const treeKey = `${parsedKey}:${String(settings.flattenEmptyDirectories)}`;
    if (this.tree != null && this.treeKey === treeKey) {
      this.applyTreePresentation(settings.diff.themeType);
      return;
    }

    this.tree?.cleanUp();
    this.treeMount.textContent = "";

    const filesByPath = new Map(parsed.files.map((file) => [file.path, file]));
    const paths = [...filesByPath.keys()];
    this.pathToItemId = new Map(parsed.files.map((file) => [file.path, file.id]));
    const gitStatus: GitStatusEntry[] = parsed.files.map((file) => ({
      path: file.path,
      status: toGitStatus(file.status),
    }));
    const firstPath = paths[0];

    this.tree = new FileTree({
      composition: {
        contextMenu: {
          buttonVisibility: "when-needed",
          enabled: true,
          render: (item, context) => this.createFileTreeMenu(item, context),
          triggerMode: "both",
        },
      },
      density: "compact",
      flattenEmptyDirectories: settings.flattenEmptyDirectories,
      gitStatus,
      icons: "complete",
      initialExpansion: paths.length > 120 ? 2 : "open",
      ...(firstPath == null ? {} : { initialSelectedPaths: [firstPath] }),
      onSelectionChange: (selectedPaths) => {
        if (selectedPaths.length !== 1) {
          return;
        }

        this.revealFile(selectedPaths[0] ?? "");
      },
      paths,
      renderRowDecoration: ({ item }) => createStatsDecoration(filesByPath.get(item.path)),
      search: true,
      stickyFolders: true,
    });
    this.tree.render({ containerWrapper: this.treeMount });
    this.applyTreePresentation(settings.diff.themeType);
    this.treeKey = treeKey;
  }

  private revealFile(path: string): void {
    const itemId = this.pathToItemId.get(path);
    if (itemId == null) {
      return;
    }

    this.diffViewer.scrollToItem(itemId);
    this.options.onFileSelected();
  }

  private applyTreePresentation(themeType: DiffViewerSettings["themeType"]): void {
    const treeContainer = this.treeMount.querySelector("file-tree-container");
    if (treeContainer instanceof HTMLElement) {
      treeContainer.style.colorScheme = themeType === "system" ? "" : themeType;

      const treeRoot = treeContainer.shadowRoot?.querySelector('[role="tree"]');
      treeRoot?.setAttribute("aria-label", this.options.fileTreeLabel);
      const actionTrigger = treeContainer.shadowRoot?.querySelector(
        '[data-type="context-menu-trigger"]',
      );
      actionTrigger?.setAttribute("aria-label", this.options.fileActionsLabel);
      actionTrigger?.setAttribute("title", this.options.fileActionsLabel);
      const searchInput = treeContainer.shadowRoot?.querySelector("[data-file-tree-search-input]");
      if (searchInput instanceof HTMLElement && searchInput.tagName === "INPUT") {
        const input = searchInput as HTMLInputElement;
        input.setAttribute("aria-label", this.options.searchChangedFilesLabel);
        input.autocomplete = "off";
        input.name = "git-toolkit-commit-file-search";
        input.spellcheck = false;
      }
    }
  }

  private createFileHeaderActions(path: string): HTMLElement {
    const actions = document.createElement("span");
    actions.className = "file-header-actions";
    actions.setAttribute("aria-label", this.options.fileActionsLabel);
    actions.setAttribute("role", "group");
    const copyButton = createIconButton("copy", this.options.copyFileNameLabel, () =>
      this.options.onCopyFileName(path),
    );
    this.copyButtonsByPath.set(path, copyButton);
    setCopyButtonState(
      copyButton,
      this.copiedPaths.has(path),
      this.options.copyFileNameLabel,
      this.options.fileNameCopiedLabel,
    );
    actions.append(
      createIconButton("open", this.options.openWorkingTreeFileLabel, () =>
        this.options.onOpenFile(path),
      ),
      copyButton,
    );
    return actions;
  }

  private createFileTreeMenu(item: ContextMenuItem, context: ContextMenuOpenContext): HTMLElement {
    const menu = document.createElement("div");
    menu.className = "file-tree-menu";
    menu.setAttribute("aria-label", this.options.fileActionsLabel);
    menu.setAttribute("role", "menu");
    const buttons: HTMLButtonElement[] = [];

    if (item.kind === "file") {
      buttons.push(
        createMenuButton("open", this.options.openWorkingTreeFileLabel, () => {
          context.close({ restoreFocus: false });
          this.options.onOpenFile(item.path);
        }),
      );
    }

    buttons.push(
      createMenuButton(
        "copy",
        item.kind === "file" ? this.options.copyFileNameLabel : this.options.copyFolderNameLabel,
        () => {
          context.close();
          this.options.onCopyFileName(item.path);
        },
      ),
    );
    menu.append(...buttons);
    positionFileTreeMenu(menu, context.anchorRect, buttons.length);
    wireMenuKeyboard(menu, buttons);
    return menu;
  }
}

function getClickedFilePath(event: MouseEvent): string | undefined {
  for (const target of event.composedPath()) {
    if (target instanceof HTMLElement && target.dataset.itemType === "file") {
      return target.dataset.itemPath;
    }
  }

  return undefined;
}

function toGitStatus(status: ParsedDiffFile["status"]): GitStatus {
  return status;
}

function createStatsDecoration(file: ParsedDiffFile | undefined): {
  parts: { color: string; text: string }[];
  text: string;
  title: string;
} | null {
  if (file == null || (file.additions === 0 && file.deletions === 0)) {
    return null;
  }

  const parts: { color: string; text: string }[] = [];
  if (file.additions > 0) {
    parts.push({
      color: "var(--vscode-gitDecoration-addedResourceForeground, #73c991)",
      text: `+${file.additions}`,
    });
  }
  if (file.deletions > 0) {
    parts.push({
      color: "var(--vscode-gitDecoration-deletedResourceForeground, #c74e39)",
      text: `${parts.length === 0 ? "" : " "}-${file.deletions}`,
    });
  }

  return {
    parts,
    text: parts.map((part) => part.text).join(""),
    title: `+${file.additions} -${file.deletions}`,
  };
}

const COPY_FEEDBACK_DURATION_MS = 1_600;

type FileActionIcon = "check" | "copy" | "open";

const FILE_ACTION_ICON_PATHS: Record<FileActionIcon, string> = {
  check:
    "M14.431 3.323a.5.5 0 0 1 .246.677l-7 9a.5.5 0 0 1-.708.075l-5-4a.5.5 0 1 1 .625-.78l4.603 3.682 6.691-8.603a.5.5 0 0 1 .543-.051Z",
  copy: "M5.5 2A1.5 1.5 0 0 0 4 3.5V4h-.5A1.5 1.5 0 0 0 2 5.5v7A1.5 1.5 0 0 0 3.5 14h7a1.5 1.5 0 0 0 1.5-1.5V12h.5a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 12.5 2h-7Zm7 1.5v7H12v-5A1.5 1.5 0 0 0 10.5 4h-5v-.5h7Zm-9 2h7v7h-7v-7Z",
  open: "M9 2h5v5h-1.5V4.56L7.53 9.53 6.47 8.47l4.97-4.97H9V2ZM3.5 3H7v1.5H3.5v8h8V9H13v3.5a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 2 12.5v-8A1.5 1.5 0 0 1 3.5 3Z",
};

function createIconButton(
  icon: FileActionIcon,
  label: string,
  onActivate: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "file-action-button";
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.append(createFileActionIcon(icon));
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onActivate();
  });
  return button;
}

function createMenuButton(
  icon: FileActionIcon,
  label: string,
  onActivate: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "file-tree-menu-item";
  button.type = "button";
  button.setAttribute("role", "menuitem");
  button.append(createFileActionIcon(icon), document.createTextNode(label));
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onActivate();
  });
  return button;
}

function createFileActionIcon(icon: FileActionIcon): SVGSVGElement {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("viewBox", "0 0 16 16");
  const pathElement = document.createElementNS(svgNamespace, "path");
  pathElement.setAttribute("d", FILE_ACTION_ICON_PATHS[icon]);
  pathElement.setAttribute("fill", "currentColor");
  svg.append(pathElement);
  return svg;
}

function setCopyButtonState(
  button: HTMLButtonElement,
  copied: boolean,
  copyLabel: string,
  copiedLabel: string,
): void {
  const label = copied ? copiedLabel : copyLabel;
  button.dataset.copyState = copied ? "copied" : "idle";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.replaceChildren(createFileActionIcon(copied ? "check" : "copy"));
}

function wireMenuKeyboard(menu: HTMLElement, buttons: readonly HTMLButtonElement[]): void {
  menu.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    event.preventDefault();
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const offset = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (currentIndex + offset + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  });
}

function positionFileTreeMenu(
  menu: HTMLElement,
  anchorRect: ContextMenuOpenContext["anchorRect"],
  itemCount: number,
): void {
  const margin = 4;
  const gap = 2;
  const menuWidth = 190;
  const estimatedHeight = itemCount * 32 + 10;
  const maxLeft = Math.max(margin, globalThis.innerWidth - menuWidth - margin);
  const left = Math.min(Math.max(anchorRect.right - menuWidth, margin), maxLeft);
  const opensBelow = anchorRect.bottom + gap + estimatedHeight <= globalThis.innerHeight - margin;
  const top = opensBelow
    ? anchorRect.bottom + gap
    : Math.max(margin, anchorRect.top - estimatedHeight - gap);

  menu.style.left = `${left}px`;
  menu.style.position = "fixed";
  menu.style.right = "auto";
  menu.style.top = `${top}px`;
}

export type { DiffViewerSettings };
