import type { DiffViewerSettings } from "../diffViewer";

import type { CommitTreeWebviewStrings } from "../localize";
import type {
  CommitSnapshot,
  CommitTreeExtensionToWebviewMessage,
  CommitTreeSettings,
  CommitTreeWebviewToExtensionMessage,
} from "../protocol";
import type { CommitTreeRuntime } from "./viewer";

declare const acquireVsCodeApi: () => {
  getState(): WebviewState | undefined;
  postMessage(message: CommitTreeWebviewToExtensionMessage): void;
  setState(state: WebviewState): void;
};

interface WebviewState {
  readonly sidebarCollapsed?: boolean;
  readonly treeWidth?: number;
}

type LocalDiffOverrides = Partial<Pick<DiffViewerSettings, "defaultStyle" | "overflow">>;

const vscode = acquireVsCodeApi();
const strings = readWebviewStrings();
const workspace = requiredElement<HTMLElement>("workspace");
const sidebar = requiredElement<HTMLElement>("sidebar");
const treeToggle = requiredElement<HTMLButtonElement>("tree-toggle");
const treeClose = requiredElement<HTMLButtonElement>("tree-close");
const treeBackdrop = requiredElement<HTMLButtonElement>("tree-backdrop");
const separator = requiredElement<HTMLElement>("separator");
const treeMount = requiredElement<HTMLElement>("tree");
const viewerMount = requiredElement<HTMLElement>("viewer");
const notice = requiredElement<HTMLElement>("notice");
const empty = requiredElement<HTMLElement>("empty");
const subject = requiredElement<HTMLElement>("subject");
const shortHash = requiredElement<HTMLElement>("short-hash");
const commitMeta = requiredElement<HTMLElement>("commit-meta");
const messageDetails = requiredElement<HTMLDetailsElement>("message-details");
const messageBody = requiredElement<HTMLPreElement>("message-body");
const stats = requiredElement<HTMLElement>("stats");
const fileCount = requiredElement<HTMLElement>("file-count");
const copyHash = requiredElement<HTMLButtonElement>("copy-hash");
const layoutSelect = requiredElement<HTMLSelectElement>("layout-select");
const overflowToggle = requiredElement<HTMLButtonElement>("overflow-toggle");
const narrowLayout = window.matchMedia("(max-width: 760px)");

let latestMessage: Extract<CommitTreeExtensionToWebviewMessage, { type: "update" }> | undefined;
let localDiffOverrides: LocalDiffOverrides = {};
let runtime: CommitTreeRuntime | undefined;
let runtimeModulePromise: Promise<typeof import("./viewer")> | undefined;
let renderRevision = 0;
let treeWidthInitialized = false;
let vscodeThemeType = resolveVsCodeThemeType();
const handleNarrowLayoutChange = (): void => {
  setTreeOpen(false);
  syncSidebarAccessibility();
};
const themeObserver = new MutationObserver(() => {
  const nextThemeType = resolveVsCodeThemeType();
  if (nextThemeType === vscodeThemeType) {
    return;
  }

  vscodeThemeType = nextThemeType;
  void renderLatest();
});

wireControls();
wireTreeResize();
setSidebarCollapsed(vscode.getState()?.sidebarCollapsed ?? false, false);
setTreeOpen(false);
narrowLayout.addEventListener("change", handleNarrowLayoutChange);
themeObserver.observe(document.body, { attributeFilter: ["class"], attributes: true });

window.addEventListener("message", (event: MessageEvent<CommitTreeExtensionToWebviewMessage>) => {
  if (event.data.type === "update") {
    latestMessage = event.data;
    renderCommitHeader(event.data.commit);
    initializeTreeWidth(event.data.settings);
    syncControls(resolveDiffSettings(event.data.settings));
    void renderLatest();
    return;
  }

  if (event.data.type === "fileNameCopied") {
    runtime?.showFileNameCopied(event.data.path);
    return;
  }

  clearRuntime();
  showNotice(event.data.message);
});
window.addEventListener("beforeunload", () => {
  narrowLayout.removeEventListener("change", handleNarrowLayoutChange);
  themeObserver.disconnect();
  clearRuntime();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && narrowLayout.matches && workspace.classList.contains("tree-open")) {
    event.preventDefault();
    setTreeOpen(false, true);
  }
});

postWebviewMessage({ type: "ready" });
void preloadRuntimeAfterFirstPaint();

async function renderLatest(): Promise<void> {
  if (latestMessage == null) {
    return;
  }

  const revision = renderRevision + 1;
  renderRevision = revision;
  showNotice(strings.loadingRenderer);
  empty.hidden = true;
  await nextFrame();

  try {
    const activeRuntime = await getRuntime();
    if (revision !== renderRevision || latestMessage == null) {
      return;
    }

    const parsed = activeRuntime.render({
      commit: latestMessage.commit,
      settings: {
        ...latestMessage.settings,
        diff: resolveDiffSettings(latestMessage.settings),
      },
    });
    renderStats(parsed.stats.files, parsed.stats.additions, parsed.stats.deletions);
    fileCount.textContent = String(parsed.stats.files);
    notice.hidden = true;
    empty.hidden = parsed.stats.files !== 0;
  } catch (error) {
    clearRuntime();
    showNotice(error instanceof Error ? error.message : strings.unableRender);
  }
}

function wireControls(): void {
  layoutSelect.addEventListener("change", () => {
    localDiffOverrides = {
      ...localDiffOverrides,
      defaultStyle: layoutSelect.value as DiffViewerSettings["defaultStyle"],
    };
    void renderLatest();
  });

  overflowToggle.addEventListener("click", () => {
    if (latestMessage == null) {
      return;
    }

    const current = resolveDiffSettings(latestMessage.settings).overflow;
    localDiffOverrides = {
      ...localDiffOverrides,
      overflow: current === "wrap" ? "scroll" : "wrap",
    };
    syncControls(resolveDiffSettings(latestMessage.settings));
    void renderLatest();
  });

  copyHash.addEventListener("click", () => {
    postWebviewMessage({ type: "copyHash" });
  });

  treeToggle.addEventListener("click", () => {
    if (narrowLayout.matches) {
      setTreeOpen(!workspace.classList.contains("tree-open"));
      return;
    }

    setSidebarCollapsed(false, true);
  });
  treeClose.addEventListener("click", () => {
    if (narrowLayout.matches) {
      setTreeOpen(false, true);
      return;
    }

    setSidebarCollapsed(true, true);
  });
  treeBackdrop.addEventListener("click", () => setTreeOpen(false, true));
}

function wireTreeResize(): void {
  separator.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    separator.setPointerCapture(event.pointerId);
    separator.classList.add("dragging");
  });
  separator.addEventListener("pointermove", (event) => {
    if (!separator.hasPointerCapture(event.pointerId)) {
      return;
    }

    const bounds = workspace.getBoundingClientRect();
    setTreeWidth(event.clientX - bounds.left, false);
  });
  separator.addEventListener("pointerup", (event) => {
    if (!separator.hasPointerCapture(event.pointerId)) {
      return;
    }

    separator.releasePointerCapture(event.pointerId);
    separator.classList.remove("dragging");
    persistTreeWidth();
  });
  separator.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    const current = Number.parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--tree-width"),
      10,
    );
    setTreeWidth(current + (event.key === "ArrowLeft" ? -16 : 16), true);
  });
}

function renderCommitHeader(commit: CommitSnapshot): void {
  subject.textContent = commit.subject;
  subject.title = commit.subject;
  shortHash.textContent = commit.shortHash;

  const author = commit.authorName ?? commit.authorEmail;
  const metadata = [author, formatDate(commit.authoredAt), commit.repositoryName].filter(
    (item): item is string => item != null && item.length > 0,
  );
  commitMeta.textContent = metadata.join(" · ");

  if (commit.body == null || commit.body.length === 0) {
    messageDetails.hidden = true;
    messageDetails.open = false;
    messageBody.textContent = "";
  } else {
    messageDetails.hidden = false;
    messageBody.textContent = commit.body;
  }
}

function renderStats(files: number, additions: number, deletions: number): void {
  const fileText = formatTemplate(strings.changedFiles, { files: String(files) });
  const addition = document.createElement("span");
  addition.className = "addition";
  addition.textContent = `+${additions}`;
  addition.title = strings.additionsLabel;
  const deletion = document.createElement("span");
  deletion.className = "deletion";
  deletion.textContent = `-${deletions}`;
  deletion.title = strings.deletionsLabel;
  stats.replaceChildren(
    document.createTextNode(`${fileText} · `),
    addition,
    document.createTextNode(" "),
    deletion,
  );
}

function resolveDiffSettings(settings: CommitTreeSettings): DiffViewerSettings {
  return {
    ...settings.diff,
    ...localDiffOverrides,
    themeType: vscodeThemeType,
  };
}

function syncControls(settings: DiffViewerSettings): void {
  layoutSelect.value = settings.defaultStyle;
  overflowToggle.setAttribute("aria-pressed", String(settings.overflow === "wrap"));
}

function initializeTreeWidth(settings: CommitTreeSettings): void {
  if (treeWidthInitialized) {
    return;
  }

  treeWidthInitialized = true;
  setTreeWidth(vscode.getState()?.treeWidth ?? settings.treeWidth, false);
}

function setTreeWidth(width: number, persist: boolean): void {
  const maxWidth = Math.max(180, Math.min(600, workspace.clientWidth - 280));
  const normalized = Math.round(Math.min(Math.max(width, 180), maxWidth));
  document.documentElement.style.setProperty("--tree-width", `${normalized}px`);
  separator.setAttribute("aria-valuemin", "180");
  separator.setAttribute("aria-valuemax", String(maxWidth));
  separator.setAttribute("aria-valuenow", String(normalized));

  if (persist) {
    updateWebviewState({ treeWidth: normalized });
  }
}

function persistTreeWidth(): void {
  const width = Number.parseInt(
    getComputedStyle(document.documentElement).getPropertyValue("--tree-width"),
    10,
  );
  updateWebviewState({ treeWidth: width });
}

function setTreeOpen(open: boolean, restoreToggleFocus = false): void {
  const hadSidebarFocus = narrowLayout.matches && sidebar.contains(document.activeElement);
  workspace.classList.toggle("tree-open", open);
  syncSidebarAccessibility();

  if (!open && (restoreToggleFocus || hadSidebarFocus)) {
    treeToggle.focus();
  }
}

function setSidebarCollapsed(collapsed: boolean, persist: boolean): void {
  workspace.classList.toggle("sidebar-collapsed", collapsed);
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  syncSidebarAccessibility();

  if (persist) {
    updateWebviewState({ sidebarCollapsed: collapsed });
  }

  if (collapsed && persist) {
    treeToggle.focus();
  }
}

function syncSidebarAccessibility(): void {
  const sidebarVisible = narrowLayout.matches
    ? workspace.classList.contains("tree-open")
    : !workspace.classList.contains("sidebar-collapsed");
  const toggleLabel = sidebarVisible ? strings.closeFileTreeTitle : strings.openFileTreeTitle;

  sidebar.inert = !sidebarVisible;
  sidebar.setAttribute("aria-hidden", String(!sidebarVisible));
  separator.setAttribute("aria-hidden", String(narrowLayout.matches || !sidebarVisible));
  separator.tabIndex = narrowLayout.matches || !sidebarVisible ? -1 : 0;
  treeBackdrop.setAttribute("aria-hidden", String(!narrowLayout.matches || !sidebarVisible));
  treeToggle.setAttribute("aria-expanded", String(sidebarVisible));
  treeToggle.setAttribute("aria-label", toggleLabel);
  treeToggle.title = toggleLabel;
}

function updateWebviewState(patch: Partial<WebviewState>): void {
  vscode.setState({ ...vscode.getState(), ...patch });
}

function showNotice(message: string): void {
  notice.textContent = message;
  notice.hidden = false;
  empty.hidden = true;
}

function clearRuntime(): void {
  runtime?.cleanUp();
  runtime = undefined;
  viewerMount.textContent = "";
  treeMount.textContent = "";
}

async function getRuntime(): Promise<CommitTreeRuntime> {
  if (runtime != null) {
    return runtime;
  }

  const runtimeModule = await preloadRuntime();
  runtime = new runtimeModule.CommitTreeRuntime(viewerMount, treeMount, {
    copyFileNameLabel: strings.copyFileNameTitle,
    copyFolderNameLabel: strings.copyFolderNameTitle,
    fileActionsLabel: strings.fileActionsLabel,
    fileNameCopiedLabel: strings.fileNameCopiedLabel,
    fileTreeLabel: strings.fileTreeLabel,
    onCopyFileName: (path) => postWebviewMessage({ type: "copyFileName", path }),
    onFileSelected: () => setTreeOpen(false),
    onOpenFile: (path) => postWebviewMessage({ type: "openFile", path }),
    openWorkingTreeFileLabel: strings.openWorkingTreeFileTitle,
    searchChangedFilesLabel: strings.searchChangedFilesLabel,
  });
  return runtime;
}

function postWebviewMessage(message: CommitTreeWebviewToExtensionMessage): void {
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- VS Code Webview API postMessage has no targetOrigin parameter.
  vscode.postMessage(message);
}

function preloadRuntime(): Promise<typeof import("./viewer")> {
  runtimeModulePromise ??= import("./viewer");
  return runtimeModulePromise;
}

async function preloadRuntimeAfterFirstPaint(): Promise<void> {
  await nextFrame();
  void preloadRuntime();
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function formatDate(value: string | undefined): string | undefined {
  if (value == null) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? undefined
    : new Intl.DateTimeFormat(navigator.language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function resolveVsCodeThemeType(): "dark" | "light" {
  return document.body.classList.contains("vscode-light") ||
    document.body.classList.contains("vscode-high-contrast-light")
    ? "light"
    : "dark";
}

function requiredElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (element == null) {
    throw new Error(`Missing #${id}`);
  }

  return element as TElement;
}

function readWebviewStrings(): CommitTreeWebviewStrings {
  const template = requiredElement<HTMLTemplateElement>("l10n-data");
  const raw = template.content.textContent;
  if (raw == null || raw.length === 0) {
    throw new Error("Missing Webview localization data.");
  }

  return JSON.parse(raw) as CommitTreeWebviewStrings;
}

function formatTemplate(template: string, values: Record<string, string>): string {
  return template.replaceAll(/\{(?<key>[A-Za-z0-9_]+)\}/g, (match, key: string) => {
    return values[key] ?? match;
  });
}
