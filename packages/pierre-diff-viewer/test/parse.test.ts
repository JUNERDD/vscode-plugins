import { describe, expect, it } from "vitest";

import { parseDiffDocument } from "../src";

const MULTI_FILE_PATCH = `diff --git a/src/changed.ts b/src/changed.ts
index 1111111..2222222 100644
--- a/src/changed.ts
+++ b/src/changed.ts
@@ -1 +1,2 @@
-old
+new
+more
diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1 @@
+created
diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index 4444444..0000000
--- a/src/old.ts
+++ /dev/null
@@ -1 +0,0 @@
-removed
`;

describe("parseDiffDocument", () => {
  it("returns an empty document for an empty commit patch", () => {
    expect(parseDiffDocument("\n", { cacheKey: "empty", version: 1 })).toEqual({
      items: [],
      files: [],
      stats: { files: 0, additions: 0, deletions: 0, hunks: 0 },
    });
  });

  it("returns path-based items plus per-file and aggregate metadata", () => {
    const parsed = parseDiffDocument(MULTI_FILE_PATCH, {
      cacheKey: "commit:a",
      version: 7,
    });

    expect(parsed.items.map((item) => item.id)).toEqual([
      "src/changed.ts",
      "src/new.ts",
      "src/old.ts",
    ]);
    expect(parsed.files.map(({ item: _item, ...file }) => file)).toEqual([
      {
        id: "src/changed.ts",
        path: "src/changed.ts",
        status: "modified",
        additions: 2,
        deletions: 1,
        hunks: 1,
      },
      {
        id: "src/new.ts",
        path: "src/new.ts",
        status: "added",
        additions: 1,
        deletions: 0,
        hunks: 1,
      },
      {
        id: "src/old.ts",
        path: "src/old.ts",
        status: "deleted",
        additions: 0,
        deletions: 1,
        hunks: 1,
      },
    ]);
    expect(parsed.items.every((item) => item.version === 7)).toBe(true);
    expect(parsed.stats).toEqual({ files: 3, additions: 3, deletions: 2, hunks: 3 });
  });

  it("keeps item ids stable across cache and version changes", () => {
    const first = parseDiffDocument(MULTI_FILE_PATCH, { cacheKey: "first", version: 1 });
    const second = parseDiffDocument(MULTI_FILE_PATCH, { cacheKey: "second", version: 2 });

    expect(second.items.map((item) => item.id)).toEqual(first.items.map((item) => item.id));
  });

  it("reports renamed paths", () => {
    const parsed = parseDiffDocument(
      `diff --git a/src/before.ts b/src/after.ts
similarity index 100%
rename from src/before.ts
rename to src/after.ts
`,
      { cacheKey: "rename", version: 1 },
    );

    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]).toMatchObject({
      id: "src/after.ts",
      path: "src/after.ts",
      previousPath: "src/before.ts",
      status: "renamed",
      additions: 0,
      deletions: 0,
      hunks: 0,
    });
  });

  it("preserves non-ASCII paths emitted with core.quotePath=false", () => {
    const parsed = parseDiffDocument(
      `diff --git a/文档/说明 文件.md b/文档/说明 文件.md
index 1111111..2222222 100644
--- a/文档/说明 文件.md
+++ b/文档/说明 文件.md
@@ -1 +1 @@
-旧
+新
`,
      { cacheKey: "unicode", version: 1 },
    );

    expect(parsed.files[0]?.path).toBe("文档/说明 文件.md");
  });
});
