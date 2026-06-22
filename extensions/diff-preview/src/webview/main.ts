import type {
  DiffPreviewExtensionToWebviewMessage,
  DiffPreviewRevealTextMessage,
  DiffPreviewSettings,
  DiffStyle,
  OverflowMode,
} from "../protocol";
import type { DiffPreviewRuntime, DiffStats } from "./renderer";

declare const acquireVsCodeApi: () => {
  postMessage(message: DiffPreviewRevealTextMessage | { type: "ready" }): void;
};

type LocalSettingOverrides = Partial<
  Pick<
    DiffPreviewSettings,
    "defaultStyle" | "overflow" | "disableLineNumbers" | "disableFileHeader"
  >
>;

const vscode = acquireVsCodeApi();
const toolbar = requiredElement<HTMLElement>("toolbar");
const statsNode = requiredElement<HTMLElement>("stats");
const notice = requiredElement<HTMLElement>("notice");
const viewer = requiredElement<HTMLElement>("viewer");
const fallback = requiredElement<HTMLPreElement>("fallback");
const layoutSelect = requiredElement<HTMLSelectElement>("layout-select");
const overflowToggle = requiredElement<HTMLButtonElement>("overflow-toggle");
const lineNumberToggle = requiredElement<HTMLButtonElement>("line-number-toggle");
const fileHeaderToggle = requiredElement<HTMLButtonElement>("file-header-toggle");
const openTextButton = requiredElement<HTMLButtonElement>("open-text");

let renderer: DiffPreviewRuntime | undefined;
let rendererModulePromise: Promise<typeof import("./renderer")> | undefined;
let latestMessage: DiffPreviewExtensionToWebviewMessage | undefined;
let localOverrides: LocalSettingOverrides = {};
let renderRevision = 0;

wireToolbar();

window.addEventListener("message", (event: MessageEvent<DiffPreviewExtensionToWebviewMessage>) => {
  if (event.data.type === "update") {
    latestMessage = event.data;
    void renderLatest();
  }
});

// oxlint-disable-next-line unicorn/require-post-message-target-origin -- VS Code Webview API postMessage has no targetOrigin parameter.
vscode.postMessage({ type: "ready" });
void preloadRendererAfterFirstPaint();

async function renderLatest(): Promise<void> {
  if (latestMessage == null) {
    return;
  }

  const revision = renderRevision + 1;
  renderRevision = revision;
  const settings = resolveSettings(latestMessage.settings);
  syncToolbar(settings);

  if (latestMessage.tooLarge) {
    clearRenderer();
    showNotice(
      `${latestMessage.fileName} is ${formatBytes(latestMessage.sizeBytes)}, above diffPreview.view.maxFileSizeBytes.`,
      "banner",
    );
    showFallback("");
    return;
  }

  showNotice("Loading diff renderer...");
  hideFallback();
  await nextFrame();

  let runtime: DiffPreviewRuntime;
  try {
    runtime = await getRenderer();
  } catch (error) {
    clearRenderer();
    showNotice(error instanceof Error ? error.message : "Unable to load diff renderer.", "banner");
    showFallback(latestMessage.text);
    return;
  }

  if (revision !== renderRevision || latestMessage == null) {
    return;
  }

  try {
    const stats = runtime.render({
      settings,
      sizeBytes: latestMessage.sizeBytes,
      text: latestMessage.text,
      version: latestMessage.version,
    });
    updateStats(stats, latestMessage.sizeBytes);
    hideNotice();
    hideFallback();
  } catch (error) {
    clearRenderer();
    showNotice(error instanceof Error ? error.message : "Unable to parse diff file.", "banner");
    showFallback(latestMessage.text);
  }
}

function resolveSettings(settings: DiffPreviewSettings): DiffPreviewSettings {
  return {
    ...settings,
    ...localOverrides,
  };
}

function wireToolbar(): void {
  layoutSelect.addEventListener("change", () => {
    localOverrides = {
      ...localOverrides,
      defaultStyle: layoutSelect.value as DiffStyle,
    };
    void renderLatest();
  });

  overflowToggle.addEventListener("click", () => {
    const current = resolveSettingsFromLatest().overflow;
    localOverrides = {
      ...localOverrides,
      overflow: (current === "wrap" ? "scroll" : "wrap") satisfies OverflowMode,
    };
    void renderLatest();
  });

  lineNumberToggle.addEventListener("click", () => {
    const current = resolveSettingsFromLatest().disableLineNumbers;
    localOverrides = {
      ...localOverrides,
      disableLineNumbers: !current,
    };
    void renderLatest();
  });

  fileHeaderToggle.addEventListener("click", () => {
    const current = resolveSettingsFromLatest().disableFileHeader;
    localOverrides = {
      ...localOverrides,
      disableFileHeader: !current,
    };
    void renderLatest();
  });

  openTextButton.addEventListener("click", () => {
    if (latestMessage != null) {
      const message: DiffPreviewRevealTextMessage = {
        type: "revealText",
        documentUri: latestMessage.documentUri,
      };

      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- VS Code Webview API postMessage has no targetOrigin parameter.
      vscode.postMessage(message);
    }
  });
}

function syncToolbar(settings: DiffPreviewSettings): void {
  toolbar.hidden = !settings.showToolbar;
  statsNode.hidden = !settings.showStats;
  layoutSelect.value = settings.defaultStyle;
  overflowToggle.setAttribute("aria-pressed", String(settings.overflow === "wrap"));
  lineNumberToggle.setAttribute("aria-pressed", String(!settings.disableLineNumbers));
  fileHeaderToggle.setAttribute("aria-pressed", String(!settings.disableFileHeader));
}

function updateStats(stats: DiffStats, sizeBytes: number): void {
  statsNode.textContent = `${stats.files} files  +${stats.additions}  -${stats.deletions}  ${stats.hunks} hunks  ${formatBytes(sizeBytes)}`;
}

function resolveSettingsFromLatest(): DiffPreviewSettings {
  if (latestMessage == null) {
    throw new Error("No preview settings are available yet.");
  }

  return resolveSettings(latestMessage.settings);
}

function clearRenderer(): void {
  if (renderer != null) {
    renderer.cleanUp();
  }

  viewer.textContent = "";
  updateStats(
    {
      files: 0,
      additions: 0,
      deletions: 0,
      hunks: 0,
    },
    latestMessage?.sizeBytes ?? 0,
  );
}

async function getRenderer(): Promise<DiffPreviewRuntime> {
  if (renderer != null) {
    return renderer;
  }

  const rendererBundle = await preloadRenderer();
  renderer = new rendererBundle.DiffPreviewRuntime(viewer);
  return renderer;
}

function preloadRenderer(): Promise<typeof import("./renderer")> {
  rendererModulePromise ??= import("./renderer");
  return rendererModulePromise;
}

async function preloadRendererAfterFirstPaint(): Promise<void> {
  await nextFrame();
  preloadRenderer();
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function showNotice(message: string, mode: "cover" | "banner" = "cover"): void {
  notice.textContent = message;
  notice.classList.toggle("notice-cover", mode === "cover");
  notice.classList.toggle("notice-banner", mode === "banner");
  notice.hidden = false;
}

function hideNotice(): void {
  notice.textContent = "";
  notice.hidden = true;
}

function showFallback(text: string): void {
  fallback.textContent = text;
  fallback.hidden = text.length === 0;
}

function hideFallback(): void {
  fallback.textContent = "";
  fallback.hidden = true;
}

function requiredElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);

  if (element == null) {
    throw new Error(`Missing #${id}`);
  }

  return element as TElement;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KiB`;
  }

  return `${(kib / 1024).toFixed(1)} MiB`;
}
