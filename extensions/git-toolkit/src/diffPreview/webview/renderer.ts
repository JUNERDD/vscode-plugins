import { PierreDiffViewer, parseDiffDocument } from "../../diffViewer";
import type { DiffDocumentStats } from "../../diffViewer";

import type { DiffPreviewSettings } from "../protocol";

export type DiffStats = DiffDocumentStats;

export interface RenderRequest {
  documentUri: string;
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
      cacheKey: `diff-preview:${request.documentUri}:${request.version}`,
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
