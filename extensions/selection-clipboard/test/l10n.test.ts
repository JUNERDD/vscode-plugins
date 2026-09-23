import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

function readBundle(name: string): Record<string, string> {
  return JSON.parse(readFileSync(join(root, "l10n", name), "utf8")) as Record<string, string>;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts"))
    .map((file) => join(directory, file));
}

/** Every `l10n.t("...")` call in src; any call without a plain string literal is reported separately. */
function collectMessages(): { messages: Set<string>; nonLiteralCalls: string[] } {
  const messages = new Set<string>();
  const nonLiteralCalls: string[] = [];
  for (const file of sourceFiles(join(root, "src"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/l10n\.t\(\s*("(?:[^"\\]|\\.)*")?/g)) {
      if (match[1] === undefined) {
        nonLiteralCalls.push(`${file}:${match.index}`);
      } else {
        messages.add(JSON.parse(match[1]) as string);
      }
    }
  }
  return { messages, nonLiteralCalls };
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\w+\}/g)].map((match) => match[0]).toSorted();
}

describe("runtime localization bundles", () => {
  const english = readBundle("bundle.l10n.json");
  const chinese = readBundle("bundle.l10n.zh-cn.json");
  const { messages, nonLiteralCalls } = collectMessages();

  it("only localizes string literals", () => {
    expect(messages.size).toBeGreaterThan(0);
    expect(nonLiteralCalls).toEqual([]);
  });

  it("covers every source message in both bundles", () => {
    const sorted = [...messages].toSorted();
    expect(sorted.filter((message) => !(message in english))).toEqual([]);
    expect(sorted.filter((message) => !(message in chinese))).toEqual([]);
  });

  it("keeps bundles in sync with each other and with the source", () => {
    expect(Object.keys(chinese).toSorted()).toEqual(Object.keys(english).toSorted());
    expect(Object.keys(english).toSorted()).toEqual([...messages].toSorted());
  });

  it("uses the English source as the English value", () => {
    for (const [key, value] of Object.entries(english)) {
      expect(value).toBe(key);
    }
  });

  it("preserves placeholders in translations", () => {
    for (const [key, value] of Object.entries(chinese)) {
      expect(placeholders(value), key).toEqual(placeholders(key));
    }
  });
});
