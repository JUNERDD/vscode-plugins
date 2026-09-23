import { describe, expect, it } from "vitest";

import {
  compareRanges,
  formatEntries,
  formatEntry,
  formatLocation,
  isEmptyRange,
  normalizeRange,
  type FormattableEntry,
} from "../src/location";
import type { FormatOptions, SelectionRange } from "../src/protocol";

function range(
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number,
): SelectionRange {
  return { startLine, startCharacter, endLine, endCharacter };
}

/** Line-length lookup backed by literal document lines. */
function linesOf(...lines: string[]): (line: number) => number {
  return (line) => {
    const text = lines[line];
    if (text === undefined) {
      throw new Error(`line ${line} out of range`);
    }
    return text.length;
  };
}

const locationOnly: FormatOptions = { locationStyle: "lineColumn", includeCode: false };
const withCode: FormatOptions = { locationStyle: "lineColumn", includeCode: true };

describe("isEmptyRange", () => {
  it("detects caret positions only", () => {
    expect(isEmptyRange(range(3, 4, 3, 4))).toBe(true);
    expect(isEmptyRange(range(3, 4, 3, 5))).toBe(false);
    expect(isEmptyRange(range(3, 4, 4, 4))).toBe(false);
  });
});

describe("formatLocation", () => {
  const point = range(11, 4, 11, 4);
  const singleLine = range(11, 4, 11, 17);
  const multiLine = range(11, 4, 13, 20);

  it("formats a point in every style", () => {
    expect(formatLocation("a.ts", point, "lineColumn")).toBe("a.ts:12:5");
    expect(formatLocation("a.ts", point, "lineRange")).toBe("a.ts:12");
    expect(formatLocation("a.ts", point, "githubAnchor")).toBe("a.ts#L12C5");
  });

  it("keeps the full lineColumn form for single-line selections", () => {
    expect(formatLocation("a.ts", singleLine, "lineColumn")).toBe("a.ts:12:5-12:17");
    expect(formatLocation("a.ts", singleLine, "lineRange")).toBe("a.ts:12");
    expect(formatLocation("a.ts", singleLine, "githubAnchor")).toBe("a.ts#L12C5-L12C17");
  });

  it("formats multi-line selections in every style", () => {
    expect(formatLocation("src/a.ts", multiLine, "lineColumn")).toBe("src/a.ts:12:5-14:20");
    expect(formatLocation("src/a.ts", multiLine, "lineRange")).toBe("src/a.ts:12-14");
    expect(formatLocation("src/a.ts", multiLine, "githubAnchor")).toBe("src/a.ts#L12C5-L14C20");
  });

  it("shows column 1 rather than 0 for an end at character 0", () => {
    const endsAtLineStart = range(0, 2, 2, 0);
    expect(formatLocation("a.ts", endsAtLineStart, "lineColumn")).toBe("a.ts:1:3-3:1");
    expect(formatLocation("a.ts", endsAtLineStart, "lineRange")).toBe("a.ts:1-3");
    expect(formatLocation("a.ts", endsAtLineStart, "githubAnchor")).toBe("a.ts#L1C3-L3C1");
  });

  it("passes UTF-16 offsets through for emoji and CJK paths", () => {
    // "😀好x" : the emoji is two UTF-16 units, so "x" starts at offset 3.
    const path = "文档/😀.ts";
    expect(formatLocation(path, range(0, 3, 0, 4), "lineColumn")).toBe(`${path}:1:4-1:4`);
    expect(formatLocation(path, range(0, 0, 0, 2), "githubAnchor")).toBe(`${path}#L1C1-L1C2`);
  });
});

describe("normalizeRange", () => {
  it("pulls a whole-line selection back to the previous line end", () => {
    const lineLength = linesOf("const a = 1;", "const bb = 2;", "");
    expect(normalizeRange(range(0, 0, 2, 0), lineLength)).toEqual(range(0, 0, 1, 13));
    expect(normalizeRange(range(0, 0, 1, 0), lineLength)).toEqual(range(0, 0, 0, 12));
  });

  it("ends at character 0 when the previous line is empty", () => {
    const lineLength = linesOf("abc", "", "def");
    expect(normalizeRange(range(0, 1, 2, 0), lineLength)).toEqual(range(0, 1, 1, 0));
  });

  it("can collapse a single selected blank line to an empty range", () => {
    const normalized = normalizeRange(range(1, 0, 2, 0), linesOf("abc", "", "def"));
    expect(normalized).toEqual(range(1, 0, 1, 0));
    expect(isEmptyRange(normalized)).toBe(true);
  });

  it("measures the previous line in UTF-16 units", () => {
    expect(normalizeRange(range(0, 0, 1, 0), linesOf("好😀", ""))).toEqual(range(0, 0, 0, 3));
  });

  it("leaves ranges that do not end at a later line start untouched", () => {
    const lineLength = linesOf("abcdef", "ghijkl");
    expect(normalizeRange(range(0, 1, 0, 4), lineLength)).toEqual(range(0, 1, 0, 4));
    expect(normalizeRange(range(0, 1, 1, 3), lineLength)).toEqual(range(0, 1, 1, 3));
    expect(normalizeRange(range(1, 0, 1, 0), lineLength)).toEqual(range(1, 0, 1, 0));
    expect(normalizeRange(range(0, 0, 0, 0), lineLength)).toEqual(range(0, 0, 0, 0));
  });
});

describe("compareRanges", () => {
  it("sorts multi-cursor selections into document order", () => {
    const creationOrder = [
      range(5, 0, 5, 3),
      range(1, 4, 2, 0),
      range(1, 2, 1, 8),
      range(1, 2, 1, 5),
      range(0, 9, 0, 9),
    ];
    expect(creationOrder.toSorted(compareRanges)).toEqual([
      range(0, 9, 0, 9),
      range(1, 2, 1, 5),
      range(1, 2, 1, 8),
      range(1, 4, 2, 0),
      range(5, 0, 5, 3),
    ]);
  });

  it("orders by end line before end character", () => {
    expect(compareRanges(range(1, 0, 2, 0), range(1, 0, 1, 9))).toBeGreaterThan(0);
    expect(compareRanges(range(1, 0, 1, 9), range(1, 0, 1, 9))).toBe(0);
  });
});

describe("formatEntry", () => {
  const entry: FormattableEntry = {
    path: "src/a.ts",
    range: range(0, 0, 1, 5),
    text: "const a = 1;\nfoo()",
    languageId: "typescript",
  };

  it("emits only the location when code is off", () => {
    expect(formatEntry(entry, locationOnly)).toBe("src/a.ts:1:1-2:5");
  });

  it("appends a fenced block tagged with the language when code is on", () => {
    expect(formatEntry(entry, withCode)).toBe(
      "src/a.ts:1:1-2:5\n```typescript\nconst a = 1;\nfoo()\n```",
    );
  });

  it("honours the configured location style", () => {
    expect(formatEntry(entry, { locationStyle: "githubAnchor", includeCode: false })).toBe(
      "src/a.ts#L1C1-L2C5",
    );
  });

  it("omits the block when there is no text", () => {
    const point = { ...entry, range: range(3, 2, 3, 2), text: "" };
    expect(formatEntry(point, withCode)).toBe("src/a.ts:4:3");
  });

  it("lengthens the fence beyond any backtick run in the text", () => {
    const markdown = { ...entry, text: "```js\nx\n```", languageId: "markdown" };
    expect(formatEntry(markdown, withCode)).toBe(
      "src/a.ts:1:1-2:5\n````markdown\n```js\nx\n```\n````",
    );
    const longRun = { ...entry, text: "a `````` b", languageId: "markdown" };
    expect(formatEntry(longRun, withCode)).toBe(
      "src/a.ts:1:1-2:5\n```````markdown\na `````` b\n```````",
    );
  });

  it("keeps the minimum fence for short inline backticks", () => {
    const inline = { ...entry, text: "use `x` and ``y``" };
    expect(formatEntry(inline, withCode)).toBe(
      "src/a.ts:1:1-2:5\n```typescript\nuse `x` and ``y``\n```",
    );
  });

  it("normalizes CRLF line endings in the snapshot", () => {
    const crlf = { ...entry, text: "a\r\nb\r\n c" };
    expect(formatEntry(crlf, withCode)).toBe("src/a.ts:1:1-2:5\n```typescript\na\nb\n c\n```");
  });

  it("passes emoji and CJK text through unchanged", () => {
    const unicode = { ...entry, path: "文档/😀.md", range: range(0, 2, 0, 5), text: "好😀" };
    expect(formatEntry(unicode, withCode)).toBe("文档/😀.md:1:3-1:5\n```typescript\n好😀\n```");
  });
});

describe("formatEntries", () => {
  const first: FormattableEntry = {
    path: "b.ts",
    range: range(9, 0, 9, 3),
    text: "one",
    languageId: "ts",
  };
  const second: FormattableEntry = {
    path: "a.ts",
    range: range(0, 0, 0, 3),
    text: "two",
    languageId: "ts",
  };

  it("joins locations with single newlines in caller order", () => {
    expect(formatEntries([first, second], locationOnly)).toBe("b.ts:10:1-10:3\na.ts:1:1-1:3");
  });

  it("separates code blocks with a blank line", () => {
    expect(formatEntries([first, second], withCode)).toBe(
      "b.ts:10:1-10:3\n```ts\none\n```\n\na.ts:1:1-1:3\n```ts\ntwo\n```",
    );
  });

  it("returns an empty string for no entries", () => {
    expect(formatEntries([], withCode)).toBe("");
  });
});
