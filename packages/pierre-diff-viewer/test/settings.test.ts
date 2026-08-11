import { describe, expect, it } from "vitest";

import { DEFAULT_DIFF_VIEWER_SETTINGS } from "../src";

describe("DEFAULT_DIFF_VIEWER_SETTINGS", () => {
  it("preserves the diff-preview defaults as an immutable contract", () => {
    expect(DEFAULT_DIFF_VIEWER_SETTINGS).toMatchObject({
      defaultStyle: "split",
      overflow: "scroll",
      darkTheme: "pierre-dark",
      lightTheme: "pierre-light",
      preferredHighlighter: "shiki-js",
      hunkSeparators: "line-info",
      stickyHeaders: true,
    });
    expect(Object.isFrozen(DEFAULT_DIFF_VIEWER_SETTINGS)).toBe(true);
  });
});
