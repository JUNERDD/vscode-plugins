import * as vscode from "vscode";

import type { CommitTreeWebviewStrings } from "./localize";

export function buildWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  strings: CommitTreeWebviewStrings,
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
  } data:; font-src ${webview.cspSource}; style-src ${
    webview.cspSource
  } 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';">
  <title>${escapeHtml(strings.documentTitle)}</title>
  <style>
${CRITICAL_CSS}
  </style>
</head>
<body>
  <div id="app">
    <header class="commit-header">
      <div class="header-primary">
        <button id="tree-toggle" class="tree-toggle toolbar-button" type="button" aria-controls="sidebar" aria-expanded="false" aria-label="${escapeAttribute(
          strings.openFileTreeTitle,
        )}" title="${escapeAttribute(strings.openFileTreeTitle)}">
          <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v9A1.5 1.5 0 0 0 2.5 14h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 13.5 2h-11Zm0 1.5H6v9H2.5v-9Zm5 9v-9h6v9h-6Z"/></svg>
        </button>
        <div class="commit-copy">
          <div class="subject-row">
            <h1 id="subject" class="subject"></h1>
            <button id="copy-hash" class="hash-button" type="button" title="${escapeAttribute(
              strings.copyHashTitle,
            )}"><span id="short-hash"></span></button>
          </div>
          <div id="commit-meta" class="commit-meta"></div>
          <details id="message-details" class="message-details" hidden>
            <summary>${escapeHtml(strings.commitMessageLabel)}</summary>
            <pre id="message-body"></pre>
          </details>
        </div>
      </div>
      <div id="stats" class="stats" aria-live="polite"></div>
      <div class="controls">
        <label class="control">
          <span>${escapeHtml(strings.layoutLabel)}</span>
          <select id="layout-select" aria-label="${escapeAttribute(strings.layoutLabel)}">
            <option value="split">${escapeHtml(strings.splitLayout)}</option>
            <option value="unified">${escapeHtml(strings.unifiedLayout)}</option>
          </select>
        </label>
        <button id="overflow-toggle" class="secondary-button" type="button" aria-pressed="false" title="${escapeAttribute(
          strings.toggleLineWrappingTitle,
        )}">${escapeHtml(strings.wrapButton)}</button>
      </div>
    </header>
    <div id="workspace" class="workspace">
      <button id="tree-backdrop" class="tree-backdrop" type="button" tabindex="-1" aria-label="${escapeAttribute(
        strings.closeFileTreeTitle,
      )}"></button>
      <aside id="sidebar" class="sidebar" aria-label="${escapeAttribute(strings.fileTreeLabel)}">
        <div class="sidebar-header">
          <div>
            <strong>${escapeHtml(strings.fileTreeLabel)}</strong>
            <span id="file-count" class="file-count"></span>
          </div>
          <button id="tree-close" class="tree-close toolbar-button" type="button" title="${escapeAttribute(
            strings.closeFileTreeTitle,
          )}" aria-label="${escapeAttribute(strings.closeFileTreeTitle)}">
            <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M13.5 2h-11A1.5 1.5 0 0 0 1 3.5v9A1.5 1.5 0 0 0 2.5 14h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 13.5 2ZM6 12.5H2.5v-9H6v9Zm7.5 0h-6v-9h6v9ZM5 8l-2 2.25v-4.5L5 8Z"/></svg>
          </button>
        </div>
        <div id="tree" class="tree"></div>
      </aside>
      <div id="separator" class="separator" role="separator" aria-label="${escapeAttribute(
        strings.resizeFileTreeLabel,
      )}" aria-orientation="vertical" tabindex="0"></div>
      <main id="surface" class="surface">
        <div id="notice" class="notice" role="status" aria-live="polite">${escapeHtml(
          strings.loadingCommit,
        )}</div>
        <div id="viewer" class="viewer"></div>
        <div id="empty" class="empty" hidden>${escapeHtml(strings.emptyCommit)}</div>
      </main>
    </div>
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
      --tree-width: 280px;
      --header-height: 62px;
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

    button,
    select {
      font: inherit;
    }

    button:focus-visible,
    select:focus-visible,
    .separator:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }

    #app {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
    }

    .commit-header {
      align-items: center;
      background: var(--vscode-editorGroupHeader-tabsBackground);
      border-bottom: 1px solid var(--vscode-editorGroup-border);
      display: grid;
      gap: 12px;
      grid-template-columns: minmax(0, 1fr) auto auto;
      min-height: var(--header-height);
      padding: 8px 12px;
      position: relative;
      z-index: 6;
    }

    .header-primary {
      align-items: center;
      display: flex;
      gap: 8px;
      min-width: 0;
    }

    .commit-copy {
      flex: 1 1 auto;
      min-width: 0;
    }

    .subject-row {
      align-items: center;
      display: flex;
      gap: 8px;
      min-width: 0;
    }

    .subject {
      font-size: 14px;
      font-weight: 600;
      line-height: 20px;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .hash-button {
      background: transparent;
      border: 0;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      flex: 0 0 auto;
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      padding: 2px 4px;
    }

    .hash-button:hover {
      color: var(--vscode-textLink-activeForeground);
      text-decoration: underline;
    }

    .toolbar-button,
    .file-action-button {
      align-items: center;
      background: transparent;
      border: 0;
      border-radius: 4px;
      color: var(--vscode-icon-foreground);
      cursor: pointer;
      display: inline-flex;
      justify-content: center;
      padding: 0;
    }

    .toolbar-button {
      flex: 0 0 auto;
      height: 26px;
      width: 26px;
    }

    .toolbar-button:hover,
    .file-action-button:hover {
      background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground));
    }

    .toolbar-button:active,
    .file-action-button:active {
      background: var(--vscode-toolbar-activeBackground, var(--vscode-list-activeSelectionBackground));
    }

    .file-action-button[data-copy-state="copied"] {
      color: var(--vscode-testing-iconPassed, var(--vscode-charts-green, #73c991));
    }

    .toolbar-button svg,
    .file-action-button svg,
    .file-tree-menu-item svg {
      fill: currentColor;
      height: 16px;
      width: 16px;
    }

    .commit-meta,
    .file-count {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      line-height: 16px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .message-details {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      margin-top: 2px;
    }

    .message-details summary {
      cursor: pointer;
      width: max-content;
    }

    .message-details pre {
      background: var(--vscode-textBlockQuote-background);
      border-left: 2px solid var(--vscode-textBlockQuote-border);
      color: var(--vscode-editor-foreground);
      font: 12px/1.45 var(--vscode-editor-font-family);
      margin: 6px 0 2px;
      max-height: 180px;
      overflow: auto;
      padding: 6px 8px;
      white-space: pre-wrap;
    }

    .stats {
      color: var(--vscode-descriptionForeground);
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      white-space: nowrap;
    }

    .stats .addition {
      color: var(--vscode-gitDecoration-addedResourceForeground, #73c991);
    }

    .stats .deletion {
      color: var(--vscode-gitDecoration-deletedResourceForeground, #c74e39);
    }

    .controls,
    .control {
      align-items: center;
      display: flex;
      gap: 6px;
    }

    .control {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }

    select,
    .secondary-button {
      background: var(--vscode-button-secondaryBackground);
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 3px;
      color: var(--vscode-button-secondaryForeground);
      min-height: 26px;
    }

    select {
      padding: 0 24px 0 7px;
    }

    .secondary-button {
      cursor: pointer;
      padding: 0 8px;
    }

    select:hover,
    .secondary-button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .secondary-button[aria-pressed="true"] {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .tree-toggle {
      display: none;
    }

    body.sidebar-collapsed .tree-toggle {
      display: inline-flex;
    }

    .workspace {
      display: grid;
      grid-template-columns: var(--tree-width) 5px minmax(0, 1fr);
      min-height: 0;
      position: relative;
    }

    .sidebar {
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      color: var(--vscode-sideBar-foreground, var(--vscode-editor-foreground));
      display: grid;
      grid-template-rows: 36px minmax(0, 1fr);
      min-width: 0;
      overflow: hidden;
    }

    .sidebar-header {
      align-items: center;
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-editorGroup-border));
      display: flex;
      justify-content: space-between;
      min-width: 0;
      padding: 0 8px 0 12px;
    }

    .sidebar-header strong {
      font-size: 11px;
      letter-spacing: 0.04em;
      margin-right: 7px;
      text-transform: uppercase;
    }

    .tree-close {
      display: inline-flex;
    }

    .tree {
      height: 100%;
      min-height: 0;
      overflow: hidden;
      --trees-accent-override: var(--vscode-focusBorder);
      --trees-bg-muted-override: var(--vscode-list-hoverBackground);
      --trees-bg-override: var(--vscode-sideBar-background, var(--vscode-editor-background));
      --trees-border-color-override: var(--vscode-sideBarSectionHeader-border, var(--vscode-editorGroup-border));
      --trees-fg-override: var(--vscode-sideBar-foreground, var(--vscode-editor-foreground));
      --trees-fg-muted-override: var(--vscode-descriptionForeground);
      --trees-focus-ring-color-override: var(--vscode-focusBorder);
      --trees-font-family-override: var(--vscode-font-family);
      --trees-font-size-override: var(--vscode-font-size);
      --trees-indent-guide-bg-override: var(--vscode-tree-indentGuidesStroke);
      --trees-input-bg-override: var(--vscode-input-background);
      --trees-scrollbar-thumb-override: var(--vscode-scrollbarSlider-background);
      --trees-search-bg-override: var(--vscode-input-background);
      --trees-search-fg-override: var(--vscode-input-foreground);
      --trees-selected-bg-override: var(--vscode-list-activeSelectionBackground);
      --trees-selected-fg-override: var(--vscode-list-activeSelectionForeground);
      --trees-selected-focused-border-color-override: var(--vscode-focusBorder);
      --trees-status-added-override: var(--vscode-gitDecoration-addedResourceForeground, #73c991);
      --trees-status-deleted-override: var(--vscode-gitDecoration-deletedResourceForeground, #c74e39);
      --trees-status-ignored-override: var(--vscode-gitDecoration-ignoredResourceForeground, var(--vscode-descriptionForeground));
      --trees-status-modified-override: var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d);
      --trees-status-renamed-override: var(--vscode-gitDecoration-renamedResourceForeground, #73c991);
      --trees-status-untracked-override: var(--vscode-gitDecoration-untrackedResourceForeground, #73c991);
      --trees-density-override: 0.86;
    }

    .file-header-actions {
      align-items: center;
      display: inline-flex;
      gap: 2px;
      margin-left: 2px;
    }

    .file-action-button {
      height: 22px;
      width: 22px;
    }

    .file-tree-menu {
      background: var(--vscode-menu-background, var(--vscode-editorWidget-background));
      border: 1px solid var(--vscode-menu-border, var(--vscode-widget-border));
      box-shadow: 0 3px 10px var(--vscode-widget-shadow, rgb(0 0 0 / 36%));
      color: var(--vscode-menu-foreground, var(--vscode-editorWidget-foreground));
      display: grid;
      min-width: 190px;
      padding: 4px;
      position: absolute;
      right: 0;
      top: calc(100% + 2px);
      z-index: 20;
    }

    .file-tree-menu-item {
      align-items: center;
      background: transparent;
      border: 0;
      border-radius: 3px;
      color: inherit;
      cursor: pointer;
      display: grid;
      gap: 8px;
      grid-template-columns: 16px minmax(0, 1fr);
      min-height: 26px;
      padding: 3px 8px;
      text-align: left;
      white-space: nowrap;
    }

    .file-tree-menu-item:hover,
    .file-tree-menu-item:focus-visible {
      background: var(--vscode-menu-selectionBackground, var(--vscode-list-activeSelectionBackground));
      color: var(--vscode-menu-selectionForeground, var(--vscode-list-activeSelectionForeground));
    }

    .separator {
      background: var(--vscode-editorGroup-border);
      cursor: col-resize;
      position: relative;
      touch-action: none;
    }

    .separator::after {
      content: "";
      inset: 0 -2px;
      position: absolute;
    }

    .separator:hover,
    .separator.dragging {
      background: var(--vscode-sash-hoverBorder, var(--vscode-focusBorder));
    }

    .surface {
      min-height: 0;
      overflow: hidden;
      position: relative;
    }

    .viewer {
      height: 100%;
      min-height: 0;
      overflow: auto;
    }

    .notice,
    .empty {
      align-items: center;
      background: var(--vscode-editor-background);
      color: var(--vscode-descriptionForeground);
      display: flex;
      inset: 0;
      justify-content: center;
      padding: 24px;
      position: absolute;
      text-align: center;
      z-index: 3;
    }

    .notice[hidden],
    .empty[hidden] {
      display: none;
    }

    .tree-backdrop {
      display: none;
    }

    diffs-container {
      display: block;
    }

    @media (min-width: 761px) {
      .workspace.sidebar-collapsed {
        grid-template-columns: minmax(0, 1fr);
      }

      .workspace.sidebar-collapsed .sidebar,
      .workspace.sidebar-collapsed .separator {
        display: none;
      }
    }

    @media (max-width: 760px) {
      .commit-header {
        gap: 8px;
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .tree-toggle {
        display: inline-flex;
      }

      .stats,
      .control > span {
        display: none;
      }

      .workspace {
        display: block;
      }

      .sidebar {
        box-shadow: 6px 0 18px rgb(0 0 0 / 24%);
        inset: 0 auto 0 0;
        max-width: 88vw;
        position: absolute;
        transform: translateX(-105%);
        transition: transform 140ms ease-out;
        width: min(340px, 88vw);
        z-index: 5;
      }

      .separator {
        display: none;
      }

      .surface {
        height: 100%;
      }

      .tree-backdrop {
        background: rgb(0 0 0 / 28%);
        border: 0;
        cursor: default;
        display: block;
        inset: 0;
        opacity: 0;
        pointer-events: none;
        position: absolute;
        transition: opacity 140ms ease-out;
        z-index: 4;
      }

      .workspace.tree-open .sidebar {
        transform: translateX(0);
      }

      .workspace.tree-open .tree-backdrop {
        opacity: 1;
        pointer-events: auto;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .sidebar,
      .tree-backdrop {
        transition: none;
      }
    }
`;
