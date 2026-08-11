import * as path from "node:path";

import type { GitCommit, GitRepository } from "./gitApi";
import { runGit } from "./gitRunner";
import type { GitRunOptions, GitRunResult } from "./gitRunner";
import type { CommitSnapshot } from "./protocol";

export interface LoadCommitOptions {
  readonly commitRef: string;
  readonly gitPath: string;
  readonly maxPatchSizeBytes: number;
  readonly parentRef?: string;
  readonly repository: GitRepository;
}

export type GitRunner = (
  executable: string,
  args: readonly string[],
  options: GitRunOptions,
) => Promise<GitRunResult>;

/**
 * Loads immutable commit metadata through VS Code's Git API and obtains the
 * exact first-parent patch through Git without invoking a shell.
 */
export async function loadCommitSnapshot(
  options: LoadCommitOptions,
  gitRunner: GitRunner = runGit,
): Promise<CommitSnapshot> {
  if (options.repository.rootUri.scheme !== "file") {
    throw new Error("Commit Tree currently supports local Git repositories only.");
  }

  const repositoryPath = options.repository.rootUri.fsPath;
  const commitHash = await resolveCommitObjectId(
    options.gitPath,
    repositoryPath,
    options.commitRef,
    gitRunner,
  );
  const commit = await options.repository.getCommit(commitHash);
  const parentRef = options.parentRef ?? commit.parents[0];
  if (parentRef != null && !isObjectId(parentRef)) {
    throw new Error("Git returned an invalid parent object ID.");
  }
  const comparisonBase =
    parentRef ?? (await createEmptyTree(options.gitPath, repositoryPath, gitRunner));
  const patchResult = await gitRunner(
    options.gitPath,
    [
      "-c",
      "core.quotePath=false",
      "diff",
      "--no-ext-diff",
      "--no-color",
      "--no-textconv",
      "--find-renames",
      "--find-copies",
      "--binary",
      comparisonBase,
      commitHash,
      "--",
    ],
    {
      cwd: repositoryPath,
      maxOutputBytes: options.maxPatchSizeBytes,
    },
  );
  const message = splitCommitMessage(commit);

  return {
    ...(commit.authorEmail == null ? {} : { authorEmail: commit.authorEmail }),
    ...(commit.authorName == null ? {} : { authorName: commit.authorName }),
    ...(commit.authorDate == null ? {} : { authoredAt: commit.authorDate.toISOString() }),
    ...(message.body == null ? {} : { body: message.body }),
    ...(commit.commitDate == null ? {} : { committedAt: commit.commitDate.toISOString() }),
    hash: commitHash,
    ...(parentRef == null ? {} : { parentHash: parentRef }),
    patch: patchResult.stdout.toString("utf8"),
    patchSizeBytes: patchResult.stdout.byteLength,
    repositoryName: path.basename(repositoryPath) || options.repository.rootUri.toString(),
    repositoryUri: options.repository.rootUri.toString(),
    shortHash: commitHash.slice(0, 10),
    subject: message.subject,
  };
}

async function resolveCommitObjectId(
  gitPath: string,
  cwd: string,
  commitRef: string,
  gitRunner: GitRunner,
): Promise<string> {
  const normalizedRef = commitRef.trim();
  if (normalizedRef.length === 0) {
    throw new Error("A commit reference is required.");
  }

  // Resolve user-entered revisions behind Git's option terminator before they
  // reach APIs that place the revision before their own `--` separator.
  const result = await gitRunner(
    gitPath,
    ["rev-parse", "--verify", "--end-of-options", `${normalizedRef}^{commit}`],
    { cwd, maxOutputBytes: 256 },
  );
  const hash = result.stdout.toString("utf8").trim();
  if (!isObjectId(hash)) {
    throw new Error("Git did not return a valid commit object ID.");
  }

  return hash;
}

export function splitCommitMessage(commit: Pick<GitCommit, "hash" | "message">): {
  body?: string;
  subject: string;
} {
  const normalized = commit.message.replaceAll("\r\n", "\n").trimEnd();
  const [subjectLine = "", ...bodyLines] = normalized.split("\n");
  const subject = subjectLine.trim() || commit.hash.slice(0, 10);
  const body = bodyLines.join("\n").trim();

  return {
    ...(body.length === 0 ? {} : { body }),
    subject,
  };
}

async function createEmptyTree(
  gitPath: string,
  cwd: string,
  gitRunner: GitRunner,
): Promise<string> {
  // Compute the repository's empty-tree ID without writing an object. This
  // also follows the repository's SHA-1 or SHA-256 object format.
  const result = await gitRunner(gitPath, ["hash-object", "-t", "tree", "--stdin"], {
    cwd,
    input: "",
  });
  const hash = result.stdout.toString("utf8").trim();

  if (!isObjectId(hash)) {
    throw new Error("Git did not return a valid empty-tree object ID.");
  }

  return hash;
}

function isObjectId(value: string): boolean {
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value);
}
