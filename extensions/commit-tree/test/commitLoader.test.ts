import { describe, expect, it, vi } from "vitest";

import { loadCommitSnapshot, splitCommitMessage, type GitRunner } from "../src/commitLoader";
import type { GitRepository } from "../src/gitApi";

function createRepository(
  overrides: Partial<Awaited<ReturnType<GitRepository["getCommit"]>>> = {},
): GitRepository {
  return {
    getCommit: vi.fn(async () => ({
      authorDate: new Date("2026-07-31T10:00:00.000Z"),
      authorEmail: "zen@example.com",
      authorName: "Zen",
      commitDate: new Date("2026-07-31T10:02:00.000Z"),
      hash: "1234567890abcdef1234567890abcdef12345678",
      message: "feat: tree view\n\nAdds a Pierre-powered tree.",
      parents: ["abcdefabcdefabcdefabcdefabcdefabcdefabcd"],
      ...overrides,
    })),
    log: vi.fn(async () => []),
    rootUri: {
      fsPath: "/repo/project",
      scheme: "file",
      toString: () => "file:///repo/project",
    } as GitRepository["rootUri"],
    ui: { selected: true },
  };
}

describe("loadCommitSnapshot", () => {
  it("loads a first-parent patch and commit metadata", async () => {
    const runner = vi.fn<GitRunner>(async (_executable, args) => ({
      stderr: "",
      stdout: Buffer.from(
        args[0] === "rev-parse"
          ? "1234567890abcdef1234567890abcdef12345678\n"
          : "diff --git a/a.ts b/a.ts\n",
      ),
    }));

    const snapshot = await loadCommitSnapshot(
      {
        commitRef: "HEAD",
        gitPath: "/usr/bin/git",
        maxPatchSizeBytes: 1024,
        repository: createRepository(),
      },
      runner,
    );

    expect(runner).toHaveBeenNthCalledWith(
      1,
      "/usr/bin/git",
      ["rev-parse", "--verify", "--end-of-options", "HEAD^{commit}"],
      { cwd: "/repo/project", maxOutputBytes: 256 },
    );
    expect(runner).toHaveBeenNthCalledWith(
      2,
      "/usr/bin/git",
      expect.arrayContaining([
        "core.quotePath=false",
        "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
        "1234567890abcdef1234567890abcdef12345678",
      ]),
      expect.objectContaining({ cwd: "/repo/project", maxOutputBytes: 1024 }),
    );
    expect(snapshot).toMatchObject({
      authorName: "Zen",
      body: "Adds a Pierre-powered tree.",
      parentHash: "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
      patchSizeBytes: Buffer.byteLength("diff --git a/a.ts b/a.ts\n"),
      repositoryName: "project",
      shortHash: "1234567890",
      subject: "feat: tree view",
    });
  });

  it("creates an empty tree when loading a root commit", async () => {
    const runner = vi.fn<GitRunner>(async (_executable, args) => {
      if (args[0] === "rev-parse") {
        return {
          stderr: "",
          stdout: Buffer.from("1234567890abcdef1234567890abcdef12345678\n"),
        };
      }

      if (args[0] === "hash-object") {
        return {
          stderr: "",
          stdout: Buffer.from("4b825dc642cb6eb9a060e54bf8d69288fbee4904\n"),
        };
      }

      return { stderr: "", stdout: Buffer.from("") };
    });

    await loadCommitSnapshot(
      {
        commitRef: "root",
        gitPath: "git",
        maxPatchSizeBytes: 1024,
        repository: createRepository({ parents: [] }),
      },
      runner,
    );

    expect(runner).toHaveBeenNthCalledWith(2, "git", ["hash-object", "-t", "tree", "--stdin"], {
      cwd: "/repo/project",
      input: "",
    });
    expect(runner).toHaveBeenNthCalledWith(
      3,
      "git",
      expect.arrayContaining(["4b825dc642cb6eb9a060e54bf8d69288fbee4904"]),
      expect.any(Object),
    );
  });

  it("rejects virtual repositories before running Git", async () => {
    const repository = createRepository();
    Object.defineProperty(repository, "rootUri", {
      value: { fsPath: "/virtual", scheme: "vscode-vfs", toString: () => "vscode-vfs:/virtual" },
    });
    const runner = vi.fn<GitRunner>();

    await expect(
      loadCommitSnapshot(
        {
          commitRef: "HEAD",
          gitPath: "git",
          maxPatchSizeBytes: 1024,
          repository,
        },
        runner,
      ),
    ).rejects.toThrow("local Git repositories");
    expect(runner).not.toHaveBeenCalled();
  });

  it("resolves an option-like ref behind an option terminator before using the Git API", async () => {
    const repository = createRepository();
    const runner = vi.fn<GitRunner>(async (_executable, args) => ({
      stderr: "",
      stdout: Buffer.from(
        args[0] === "rev-parse"
          ? "1234567890abcdef1234567890abcdef12345678\n"
          : "diff --git a/a.ts b/a.ts\n",
      ),
    }));

    await loadCommitSnapshot(
      {
        commitRef: " --output=/tmp/untrusted ",
        gitPath: "git",
        maxPatchSizeBytes: 1024,
        repository,
      },
      runner,
    );

    expect(runner).toHaveBeenNthCalledWith(
      1,
      "git",
      ["rev-parse", "--verify", "--end-of-options", "--output=/tmp/untrusted^{commit}"],
      { cwd: "/repo/project", maxOutputBytes: 256 },
    );
    expect(repository.getCommit).toHaveBeenCalledWith("1234567890abcdef1234567890abcdef12345678");
    expect(repository.getCommit).not.toHaveBeenCalledWith("--output=/tmp/untrusted");
  });
});

describe("splitCommitMessage", () => {
  it("uses the short hash when the message is empty", () => {
    expect(splitCommitMessage({ hash: "1234567890abcdef", message: "\n" })).toEqual({
      subject: "1234567890",
    });
  });
});
