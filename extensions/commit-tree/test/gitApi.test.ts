import { beforeEach, describe, expect, it, vi } from "vitest";

const { MockUri } = vi.hoisted(() => {
  class TestUri {
    static file(fsPath: string): TestUri {
      return new TestUri("file", fsPath, "");
    }

    static from(components: { scheme: string; path?: string; query?: string }): TestUri {
      return new TestUri(components.scheme, components.path ?? "", components.query ?? "");
    }

    constructor(
      readonly scheme: string,
      readonly fsPath: string,
      readonly query: string,
    ) {}

    toString(): string {
      return `${this.scheme}:${this.fsPath}`;
    }
  }

  return { MockUri: TestUri };
});

vi.mock("vscode", () => ({
  env: { language: "en" },
  extensions: { getExtension: vi.fn() },
  l10n: { t: (value: string) => value },
  Uri: MockUri,
  window: {
    showInputBox: vi.fn(),
    showQuickPick: vi.fn(),
  },
}));

import * as vscode from "vscode";

import { getCommandUri, parseScmHistoryItemUri, pickRepository } from "../src/gitApi";

describe("parseScmHistoryItemUri", () => {
  it("reads VS Code's stable SCM history multi-diff path", () => {
    const parentRef = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const commitRef = "1234567890123456789012345678901234567890";
    const uri = new MockUri(
      "scm-history-item",
      `/repo/project/${parentRef}..${commitRef}`,
      "",
    ) as unknown as vscode.Uri;

    expect(parseScmHistoryItemUri(uri)).toMatchObject({
      commitRef,
      parentRef,
      repositoryUri: expect.objectContaining({ fsPath: "/repo/project", scheme: "file" }),
    });
  });

  it("reads the proposed query-based SCM history shape as a fallback", () => {
    const uri = new MockUri(
      "scm-history-item",
      "/repo/project",
      JSON.stringify({
        historyItemId: "1234567890123456789012345678901234567890",
        historyItemParentId: "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
        repositoryId: "git",
      }),
    ) as unknown as vscode.Uri;

    expect(parseScmHistoryItemUri(uri)).toMatchObject({
      commitRef: "1234567890123456789012345678901234567890",
      parentRef: "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
      repositoryUri: expect.objectContaining({ fsPath: "/repo/project", scheme: "file" }),
    });
  });

  it("rejects malformed query data", () => {
    const uri = new MockUri("scm-history-item", "/repo", "not-json") as unknown as vscode.Uri;
    expect(parseScmHistoryItemUri(uri)).toBeUndefined();
  });

  it("rejects option-like revisions from query-based command arguments", () => {
    const uri = new MockUri(
      "scm-history-item",
      "/repo",
      JSON.stringify({
        historyItemId: "1234567890123456789012345678901234567890",
        historyItemParentId: "--output=/tmp/untrusted",
      }),
    ) as unknown as vscode.Uri;

    expect(parseScmHistoryItemUri(uri)).toBeUndefined();
  });
});

describe("getCommandUri", () => {
  it("reads the root URI passed by an SCM title command", () => {
    const rootUri = MockUri.file("/repo/selected");

    expect(getCommandUri({ rootUri })).toBe(rootUri);
  });
});

describe("pickRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the repository containing a preferred URI", async () => {
    const repository = { rootUri: MockUri.file("/repo"), ui: { selected: true } };
    const api = {
      getRepository: vi.fn(() => repository),
      git: { path: "git" },
      repositories: [repository],
    };

    await expect(
      pickRepository(api as never, MockUri.file("/repo/src/a.ts") as unknown as vscode.Uri),
    ).resolves.toBe(repository);
  });
});
