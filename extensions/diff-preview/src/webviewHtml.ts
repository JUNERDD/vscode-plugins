import * as vscode from "vscode";

import type { DiffPreviewWebviewStrings } from "./localize";

export function buildWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  strings: DiffPreviewWebviewStrings,
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview", "main.js"),
  );
  const nonce = createNonce();

  return `<!DOCTYPE html>
<html lang="${escapeAttribute(vscode.env.language || "en")}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${
    webview.cspSource
  } data:; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${
    webview.cspSource
  } 'nonce-${nonce}';">
  <title>${escapeHtml(strings.title)}</title>
  <style>
${CRITICAL_CSS}
  </style>
</head>
<body>
  <div id="app">
    <header id="toolbar" class="toolbar" hidden>
      <div class="toolbar-group">
        <label class="control">
          <span>${escapeHtml(strings.layoutLabel)}</span>
          <select id="layout-select" aria-label="${escapeAttribute(strings.layoutLabel)}">
            <option value="split">${escapeHtml(strings.splitLayout)}</option>
            <option value="unified">${escapeHtml(strings.unifiedLayout)}</option>
          </select>
        </label>
        <button id="overflow-toggle" class="icon-button" type="button" aria-pressed="false" title="${escapeAttribute(
          strings.toggleLineWrappingTitle,
        )}">${escapeHtml(strings.wrapButton)}</button>
        <button id="line-number-toggle" class="icon-button" type="button" aria-pressed="false" title="${escapeAttribute(
          strings.toggleLineNumbersTitle,
        )}">${escapeHtml(strings.lineNumberButton)}</button>
        <button id="file-header-toggle" class="icon-button" type="button" aria-pressed="false" title="${escapeAttribute(
          strings.toggleFileHeadersTitle,
        )}">${escapeHtml(strings.fileHeaderButton)}</button>
      </div>
      <div id="stats" class="stats" hidden></div>
      <div class="toolbar-group">
        <button id="open-text" class="text-button" type="button">${escapeHtml(
          strings.openTextButton,
        )}</button>
      </div>
    </header>
    <main id="surface">
      <div id="notice" class="notice notice-cover" role="status" aria-live="polite">${escapeHtml(
        strings.loadingPreview,
      )}</div>
      <div id="viewer" class="viewer"></div>
      <pre id="fallback" class="fallback" hidden></pre>
    </main>
  </div>
  <template id="l10n-data">${escapeHtml(JSON.stringify(strings))}</template>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
}

function createNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";

  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }

  return nonce;
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const CRITICAL_CSS = `
    :root {
      color-scheme: light dark;
      --toolbar-height: 42px;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body,
    #app {
      height: 100%;
      margin: 0;
      overflow: hidden;
    }

    body {
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font: var(--vscode-font-size) var(--vscode-font-family);
    }

    #app {
      display: grid;
      grid-template-rows: auto 1fr;
    }

    .toolbar {
      align-items: center;
      background: var(--vscode-editorGroupHeader-tabsBackground);
      border-bottom: 1px solid var(--vscode-editorGroup-border);
      display: flex;
      gap: 10px;
      min-height: var(--toolbar-height);
      padding: 6px 10px;
    }

    .toolbar[hidden] {
      display: none;
    }

    .toolbar-group {
      align-items: center;
      display: flex;
      flex-shrink: 0;
      gap: 6px;
    }

    .control {
      align-items: center;
      color: var(--vscode-descriptionForeground);
      display: flex;
      font-size: 12px;
      gap: 6px;
    }

    select,
    button {
      background: var(--vscode-button-secondaryBackground);
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 4px;
      color: var(--vscode-button-secondaryForeground);
      font: inherit;
      min-height: 28px;
    }

    select {
      padding: 0 26px 0 8px;
    }

    button {
      cursor: pointer;
      padding: 0 9px;
    }

    button:hover,
    select:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    button[aria-pressed="true"] {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .stats {
      color: var(--vscode-descriptionForeground);
      flex: 1 1 auto;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      min-width: 0;
      overflow: hidden;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .stats[hidden] {
      display: none;
    }

    #surface {
      min-height: 0;
      overflow: hidden;
      position: relative;
    }

    #surface.fallback-visible {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
    }

    #surface.fallback-visible .viewer {
      display: none;
    }

    #surface.fallback-visible .notice-banner {
      position: static;
    }

    .viewer {
      height: 100%;
      min-height: 0;
      overflow: auto;
    }

    .notice {
      background: var(--vscode-editor-background);
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      line-height: 1.5;
      z-index: 2;
    }

    .notice-cover {
      align-items: center;
      display: flex;
      inset: 0;
      justify-content: center;
      min-height: 100%;
      padding: 24px;
      position: absolute;
      text-align: center;
    }

    .notice-banner {
      background: var(--vscode-inputValidation-warningBackground);
      border-bottom: 1px solid var(--vscode-inputValidation-warningBorder);
      color: var(--vscode-inputValidation-warningForeground);
      padding: 8px 12px;
      position: sticky;
      top: 0;
    }

    .notice[hidden],
    .fallback[hidden] {
      display: none;
    }

    .fallback {
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      height: 100%;
      line-height: 1.5;
      margin: 0;
      min-height: 0;
      overflow: auto;
      padding: 12px;
      white-space: pre-wrap;
    }

    diffs-container {
      display: block;
    }
`;
