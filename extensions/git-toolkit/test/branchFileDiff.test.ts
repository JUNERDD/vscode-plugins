import { beforeEach, describe, expect, it, vi } from "vitest";

const { MockUri, executeCommand, registerTextDocumentContentProvider, showQuickPick } = vi.hoisted(
  () => {
    class TestUri {
      static file(fsPath: string): TestUri {
        return new TestUri("file", fsPath, "", fsPath);
      }

      static from(components: { path?: string; query?: string; scheme: string }): TestUri {
        return new TestUri(
          components.scheme,
          components.path ?? "",
          components.query ?? "",
          components.path ?? "",
        );
      }

      constructor(
        readonly scheme: string,
        readonly fsPath: string,
        readonly query: string,
        readonly path: string,
      ) {}

      toString(): string {
        return `${this.scheme}:${this.path}?${this.query}`;
      }

      with(changes: { query?: string; scheme?: string }): TestUri {
        return new TestUri(
          changes.scheme ?? this.scheme,
          this.fsPath,
          changes.query ?? this.query,
          this.path,
        );
      }
    }

    return {
      MockUri: TestUri,
      executeCommand: vi.fn(() => Promise.resolve()),
      registerTextDocumentContentProvider: vi.fn(() => ({ dispose: vi.fn() })),
      showQuickPick: vi.fn(),
    };
  },
);

vi.mock("vscode", () => ({
  commands: { executeCommand },
  l10n: {
    t: (value: string, replacements?: Record<string, string>) =>
      value.replaceAll(/\{(?<key>\w+)\}/g, (match, key: string) => replacements?.[key] ?? match),
  },
  Uri: MockUri,
  window: {
    activeTextEditor: undefined,
    showQuickPick,
  },
  workspace: { registerTextDocumentContentProvider },
}));

import * as vscode from "vscode";

import { compareFileWithBranch, EmptyDocumentProvider, pickBranch } from "../src/branchFileDiff";
import { GitRefType, type GitApi, type GitRef, type GitRepository } from "../src/gitApi";

const HASH = "1234567890abcdef1234567890abcdef12345678";

function createRepository(
  overrides: Partial<GitRepository> = {},
  branches: GitRef[] = [{ commit: HASH, name: "main", type: GitRefType.Head }],
): GitRepository {
  return {
    diffWith: vi.fn(async () => []),
    getBranches: vi.fn(async () => branches),
    getCommit: vi.fn(async () => ({ hash: HASH, message: "", parents: [] })),
    getObjectDetails: vi.fn(async () => ({ mode: "100644", object: HASH, size: 10 })),
    log: vi.fn(async () => []),
    rootUri: MockUri.file("/repo") as unknown as vscode.Uri,
    state: { HEAD: { commit: HASH, name: "main", type: GitRefType.Head } },
    ui: { selected: true },
    ...overrides,
  };
}

function createApi(repository: GitRepository): GitApi {
  return {
    getRepository: vi.fn(() => repository),
    git: { path: "git" },
    repositories: [repository],
    toGitUri: vi.fn((uri, ref) => uri.with({ scheme: "git", query: ref })),
  };
}

describe("compareFileWithBranch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    showQuickPick.mockImplementation(async (items: unknown[]) => items[0]);
  });

  it("opens the immutable branch file against the current working document", async () => {
    const repository = createRepository();
    const api = createApi(repository);
    const fileUri = MockUri.file("/repo/src/app.ts") as unknown as vscode.Uri;

    await compareFileWithBranch(api, fileUri);

    expect(repository.getBranches).toHaveBeenCalledWith({ remote: true });
    expect(repository.getObjectDetails).toHaveBeenCalledWith(HASH, "/repo/src/app.ts");
    expect(api.toGitUri).toHaveBeenCalledWith(fileUri, HASH);
    expect(executeCommand).toHaveBeenCalledWith(
      "vscode.diff",
      expect.objectContaining({ query: HASH, scheme: "git" }),
      fileUri,
      "app.ts (main ↔ Working Tree)",
      { preview: false },
    );
  });

  it("uses the fully qualified remote branch name in the diff title", async () => {
    const remoteHash = "fedcbafedcbafedcbafedcbafedcbafedcbafedc";
    const repository = createRepository({}, [
      { commit: remoteHash, name: "main", remote: "origin", type: GitRefType.RemoteHead },
    ]);
    const fileUri = MockUri.file("/repo/src/app.ts") as unknown as vscode.Uri;

    await compareFileWithBranch(createApi(repository), fileUri);

    expect(executeCommand).toHaveBeenCalledWith(
      "vscode.diff",
      expect.anything(),
      fileUri,
      "app.ts (origin/main ↔ Working Tree)",
      { preview: false },
    );
  });

  it("uses a renamed branch path when Git reports one", async () => {
    const fileUri = MockUri.file("/repo/new.ts") as unknown as vscode.Uri;
    const originalUri = MockUri.file("/repo/old.ts") as unknown as vscode.Uri;
    const repository = createRepository({
      diffWith: vi.fn(async () => [{ originalUri, uri: fileUri }]),
      getObjectDetails: vi.fn(async () => {
        throw { gitErrorCode: "UnknownPath" };
      }),
    });
    const api = createApi(repository);

    await compareFileWithBranch(api, fileUri);

    expect(api.toGitUri).toHaveBeenCalledWith(originalUri, HASH);
  });

  it("uses an empty immutable base when the branch lacks the file", async () => {
    const repository = createRepository({
      getObjectDetails: vi.fn(async () => {
        throw { gitErrorCode: "UnknownPath" };
      }),
    });
    const api = createApi(repository);
    const fileUri = MockUri.file("/repo/untracked.ts") as unknown as vscode.Uri;

    await compareFileWithBranch(api, fileUri);

    expect(executeCommand).toHaveBeenCalledWith(
      "vscode.diff",
      expect.objectContaining({
        query: `ref=${encodeURIComponent(HASH)}`,
        scheme: "git-toolkit-empty",
      }),
      fileUri,
      expect.any(String),
      { preview: false },
    );
    expect(api.toGitUri).not.toHaveBeenCalled();
  });

  it("does not hide Git failures unrelated to a missing path", async () => {
    const failure = Object.assign(new Error("bad object"), { gitErrorCode: "BadObject" });
    const repository = createRepository({
      getObjectDetails: vi.fn(async () => {
        throw failure;
      }),
    });

    await expect(
      compareFileWithBranch(createApi(repository), MockUri.file("/repo/a.ts")),
    ).rejects.toBe(failure);
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("uses the command URI instead of any unrelated active editor repository", async () => {
    const repository = createRepository();
    const api = createApi(repository);
    const commandUri = MockUri.file("/repo/right.ts") as unknown as vscode.Uri;

    await compareFileWithBranch(api, commandUri);

    expect(api.getRepository).toHaveBeenCalledWith(commandUri);
  });

  it("stops when branch selection is cancelled", async () => {
    showQuickPick.mockResolvedValue(undefined);
    const repository = createRepository();

    await compareFileWithBranch(createApi(repository), MockUri.file("/repo/a.ts"));

    expect(repository.getObjectDetails).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("rejects non-file resources and files outside open repositories", async () => {
    const repository = createRepository();
    const api = createApi(repository);
    const untitled = new MockUri("untitled", "Untitled-1", "", "Untitled-1");

    await expect(compareFileWithBranch(api, untitled)).rejects.toThrow("Open a local file");

    const outsideApi = { ...api, getRepository: vi.fn(() => null) };
    await expect(compareFileWithBranch(outsideApi, MockUri.file("/tmp/a.ts"))).rejects.toThrow(
      "not inside an open Git repository",
    );
  });
});

describe("pickBranch", () => {
  it("puts the current branch first and filters refs without valid commits", async () => {
    const otherHash = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const remoteHash = "fedcbafedcbafedcbafedcbafedcbafedcbafedc";
    const repository = createRepository({}, [
      { commit: otherHash, name: "feature", type: GitRefType.Head },
      { commit: remoteHash, name: "main", remote: "origin", type: GitRefType.RemoteHead },
      { commit: HASH, name: "main", type: GitRefType.Head },
      { name: "unborn", type: GitRefType.Head },
      { commit: "not-a-hash", name: "invalid", type: GitRefType.Head },
    ]);

    await pickBranch(repository);

    expect(showQuickPick.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        description: "Current branch",
        label: "$(check) main",
        ref: expect.objectContaining({ commit: HASH, name: "main", type: GitRefType.Head }),
      }),
      expect.objectContaining({
        label: "$(git-branch) feature",
        ref: expect.objectContaining({ commit: otherHash, name: "feature" }),
      }),
      expect.objectContaining({
        description: remoteHash.slice(0, 10),
        label: "$(git-branch) origin/main",
        ref: expect.objectContaining({ commit: remoteHash, name: "main", remote: "origin" }),
      }),
    ]);
  });
});

describe("EmptyDocumentProvider", () => {
  it("provides an empty comparison document", () => {
    expect(new EmptyDocumentProvider().provideTextDocumentContent()).toBe("");
  });
});
