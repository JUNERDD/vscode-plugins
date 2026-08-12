import type {
  DiffPreviewExtensionToWebviewMessage,
  DiffPreviewRevealTextMessage,
  DiffPreviewSettings,
  DiffStyle,
  OverflowMode,
} from "../protocol";
import type { DiffPreviewWebviewStrings } from "../localize";
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
const strings = readWebviewStrings();
const toolbar = requiredElement<HTMLElement>("toolbar");
const surface = requiredElement<HTMLElement>("surface");
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
let vscodeThemeType = resolveVsCodeThemeType();
const themeObserver = new MutationObserver(() => {
  const nextThemeType = resolveVsCodeThemeType();
  if (nextThemeType === vscodeThemeType) {
    return;
  }

  vscodeThemeType = nextThemeType;
  if (latestMessage?.settings.themeType === "system") {
    void renderLatest();
  }
});

wireToolbar();
themeObserver.observe(document.body, { attributeFilter: ["class"], attributes: true });

window.addEventListener("message", (event: MessageEvent<DiffPreviewExtensionToWebviewMessage>) => {
  if (event.data.type === "update") {
    latestMessage = event.data;
    void renderLatest();
  }
});
window.addEventListener("beforeunload", () => themeObserver.disconnect());

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
      formatTemplate(strings.tooLarge, {
        fileName: latestMessage.fileName,
        size: formatBytes(latestMessage.sizeBytes),
      }),
      "banner",
    );
    showFallback("");
    return;
  }

  showNotice(strings.loadingRenderer);
  hideFallback();
  await nextFrame();

  let runtime: DiffPreviewRuntime;
  try {
    runtime = await getRenderer();
  } catch (error) {
    clearRenderer();
    showNotice(error instanceof Error ? error.message : strings.unableLoadRenderer, "banner");
    showFallback(latestMessage.text);
    return;
  }

  if (revision !== renderRevision || latestMessage == null) {
    return;
  }

  try {
    const stats = runtime.render({
      documentUri: latestMessage.documentUri,
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
    showNotice(error instanceof Error ? error.message : strings.unableParseDiff, "banner");
    showFallback(latestMessage.text);
  }
}

function resolveSettings(settings: DiffPreviewSettings): DiffPreviewSettings {
  const resolved = {
    ...settings,
    ...localOverrides,
  };

  return resolved.themeType === "system" ? { ...resolved, themeType: vscodeThemeType } : resolved;
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
  statsNode.textContent = formatTemplate(strings.stats, {
    additions: String(stats.additions),
    deletions: String(stats.deletions),
    files: String(stats.files),
    hunks: String(stats.hunks),
    size: formatBytes(sizeBytes),
  });
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
  surface.classList.toggle("fallback-visible", text.length > 0);
}

function hideFallback(): void {
  fallback.textContent = "";
  fallback.hidden = true;
  surface.classList.remove("fallback-visible");
}

function requiredElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);

  if (element == null) {
    throw new Error(`Missing #${id}`);
  }

  return element as TElement;
}

function resolveVsCodeThemeType(): "dark" | "light" {
  return document.body.classList.contains("vscode-light") ||
    document.body.classList.contains("vscode-high-contrast-light")
    ? "light"
    : "dark";
}

function readWebviewStrings(): DiffPreviewWebviewStrings {
  const template = requiredElement<HTMLTemplateElement>("l10n-data");
  const raw = template.content.textContent;

  if (raw == null || raw.length === 0) {
    throw new Error("Missing webview localization data.");
  }

  return JSON.parse(raw) as DiffPreviewWebviewStrings;
}

function formatTemplate(template: string, values: Record<string, string>): string {
  return template.replaceAll(/\{(?<key>[A-Za-z0-9_]+)\}/g, (match, key: string) => {
    return values[key] ?? match;
  });
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
