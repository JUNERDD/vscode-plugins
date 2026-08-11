import { parsePatchFiles, processFile } from "@pierre/diffs";
import type { ChangeTypes, CodeViewDiffItem, FileDiffMetadata, Hunk } from "@pierre/diffs";

/** Stable item shape accepted by `PierreDiffViewer`. */
export type DiffViewerItem = CodeViewDiffItem<undefined>;

/** Consumer-facing status independent of Pierre's internal change type names. */
export type DiffFileStatus = "added" | "deleted" | "modified" | "renamed";

/** Aggregate counters for a parsed diff document. */
export interface DiffDocumentStats {
  files: number;
  additions: number;
  deletions: number;
  hunks: number;
}

/** Tree-friendly metadata and counters for one parsed file. */
export interface ParsedDiffFile {
  id: string;
  path: string;
  previousPath?: string;
  status: DiffFileStatus;
  additions: number;
  deletions: number;
  hunks: number;
  item: DiffViewerItem;
}

/** Parsed output shared by tree navigation and the virtualized diff surface. */
export interface ParsedDiffDocument {
  items: DiffViewerItem[];
  files: ParsedDiffFile[];
  stats: DiffDocumentStats;
}

/** Cache and reconciliation identity supplied by the owning document surface. */
export interface ParseDiffDocumentOptions {
  cacheKey: string;
  version: number;
}

/**
 * Parse a unified diff or patch into path-addressable CodeView items.
 *
 * IDs do not include cache keys or versions, so selecting a file remains stable when the same
 * document is refreshed. Repeated paths receive a deterministic numeric suffix to satisfy
 * CodeView's unique-ID requirement.
 */
export function parseDiffDocument(
  text: string,
  options: ParseDiffDocumentOptions,
): ParsedDiffDocument {
  if (text.trim().length === 0) {
    return emptyDiffDocument();
  }

  const patches = parsePatchFiles(text, options.cacheKey, true);
  const fileDiffs = patches.flatMap((patch) => patch.files);

  if (fileDiffs.length === 0) {
    const singleFile = processFile(text, {
      cacheKey: `${options.cacheKey}:single`,
      throwOnError: true,
    });

    if (singleFile != null) {
      fileDiffs.push(singleFile);
    }
  }

  const usedIds = new Set<string>();
  const files = fileDiffs.map((fileDiff) => {
    const id = uniquePathId(fileDiff.name, usedIds);
    return toParsedFile(fileDiff, id, options.version);
  });

  return {
    items: files.map((file) => file.item),
    files,
    stats: files.reduce<DiffDocumentStats>(
      (stats, file) => ({
        files: stats.files + 1,
        additions: stats.additions + file.additions,
        deletions: stats.deletions + file.deletions,
        hunks: stats.hunks + file.hunks,
      }),
      { files: 0, additions: 0, deletions: 0, hunks: 0 },
    ),
  };
}

function emptyDiffDocument(): ParsedDiffDocument {
  return {
    items: [],
    files: [],
    stats: { files: 0, additions: 0, deletions: 0, hunks: 0 },
  };
}

function uniquePathId(path: string, usedIds: Set<string>): string {
  let id = path;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${path}#${suffix}`;
    suffix += 1;
  }

  usedIds.add(id);
  return id;
}

function toParsedFile(fileDiff: FileDiffMetadata, id: string, version: number): ParsedDiffFile {
  const counts = fileDiff.hunks.reduce(
    (stats, hunk) => {
      const changes = countHunkChanges(hunk);
      return {
        additions: stats.additions + changes.additions,
        deletions: stats.deletions + changes.deletions,
      };
    },
    { additions: 0, deletions: 0 },
  );
  const item: DiffViewerItem = {
    id,
    type: "diff",
    fileDiff,
    version,
  };

  return {
    id,
    path: fileDiff.name,
    ...(fileDiff.prevName == null ? {} : { previousPath: fileDiff.prevName }),
    status: toFileStatus(fileDiff.type),
    additions: counts.additions,
    deletions: counts.deletions,
    hunks: fileDiff.hunks.length,
    item,
  };
}

function countHunkChanges(hunk: Hunk): Pick<ParsedDiffFile, "additions" | "deletions"> {
  let additions = 0;
  let deletions = 0;

  for (const content of hunk.hunkContent) {
    if (content.type === "change") {
      additions += content.additions;
      deletions += content.deletions;
    }
  }

  return { additions, deletions };
}

function toFileStatus(type: ChangeTypes): DiffFileStatus {
  switch (type) {
    case "new":
      return "added";
    case "deleted":
      return "deleted";
    case "rename-pure":
    case "rename-changed":
      return "renamed";
    case "change":
      return "modified";
  }
}
