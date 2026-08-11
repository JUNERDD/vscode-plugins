import { PierreDiffViewer, parseDiffDocument } from "@vscode-plugins/pierre-diff-viewer";
import type { DiffDocumentStats } from "@vscode-plugins/pierre-diff-viewer";

import type { DiffPreviewSettings } from "../protocol";

export type DiffStats = DiffDocumentStats;

export interface RenderRequest {
  settings: DiffPreviewSettings;
  sizeBytes: number;
  text: string;
  version: number;
}

export class DiffPreviewRuntime {
  private readonly viewer: PierreDiffViewer;

  constructor(container: HTMLElement) {
    this.viewer = new PierreDiffViewer(container);
  }

  render(request: RenderRequest): DiffStats {
    const parsed = parseDiffDocument(request.text, {
      cacheKey: `diff-preview:${request.version}`,
      version: request.version,
    });

    if (parsed.items.length === 0) {
      throw new Error("No file diffs were found in this document.");
    }

    this.viewer.render(parsed.items, request.settings);

    return parsed.stats;
  }

  cleanUp(): void {
    this.viewer.cleanUp();
  }
}
