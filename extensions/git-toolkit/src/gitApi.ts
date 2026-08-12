import * as path from "node:path";
import * as vscode from "vscode";

export interface GitCommit {
  readonly hash: string;
  readonly message: string;
  readonly parents: readonly string[];
  readonly authorDate?: Date;
  readonly authorName?: string;
  readonly authorEmail?: string;
  readonly commitDate?: Date;
  readonly shortStat?: {
    readonly files: number;
    readonly insertions: number;
    readonly deletions: number;
  };
}

export enum GitRefType {
  Head,
  RemoteHead,
  Tag,
}

export interface GitRef {
  readonly commit?: string;
  readonly name?: string;
  readonly remote?: string;
  readonly type: GitRefType;
}

export interface GitChange {
  readonly originalUri: vscode.Uri;
  readonly uri: vscode.Uri;
}

export interface GitObjectDetails {
  readonly mode: string;
  readonly object: string;
  readonly size: number;
}

export interface GitRepository {
  readonly rootUri: vscode.Uri;
  readonly state: {
    readonly HEAD?: GitRef;
  };
  readonly ui: {
    readonly selected: boolean;
  };
  diffWith(ref: string): Promise<GitChange[]>;
  getBranches(options?: { readonly remote?: boolean }): Promise<GitRef[]>;
  getCommit(ref: string): Promise<GitCommit>;
  getObjectDetails(treeish: string, path: string): Promise<GitObjectDetails>;
  log(options?: {
    readonly maxEntries?: number;
    readonly shortStats?: boolean;
  }): Promise<GitCommit[]>;
}

export interface GitApi {
  readonly git: {
    readonly path: string;
  };
  readonly repositories: readonly GitRepository[];
  getRepository(uri: vscode.Uri): GitRepository | null;
  toGitUri(uri: vscode.Uri, ref: string): vscode.Uri;
}

interface GitExtensionExports {
  readonly enabled: boolean;
  getAPI(version: 1): GitApi;
}

export interface CommitTarget {
  readonly commitRef: string;
  readonly parentRef?: string;
  readonly repositoryUri: vscode.Uri;
}

interface RecentCommitItem extends vscode.QuickPickItem {
  readonly commit?: GitCommit;
  readonly enterReference?: boolean;
}

const GIT_EXTENSION_ID = "vscode.git";

export async function getGitApi(): Promise<GitApi> {
  const extension = vscode.extensions.getExtension<GitExtensionExports>(GIT_EXTENSION_ID);

  if (extension == null) {
    throw new Error(vscode.l10n.t("The built-in Git extension is unavailable."));
  }

  const exports = extension.isActive ? extension.exports : await extension.activate();

  if (!exports.enabled) {
    throw new Error(vscode.l10n.t("Enable the built-in Git extension to use Git Toolkit."));
  }

  return exports.getAPI(1);
}

export function parseScmHistoryItemUri(uri: vscode.Uri): CommitTarget | undefined {
  if (uri.scheme !== "scm-history-item") {
    return undefined;
  }

  const pathTarget = parseScmHistoryItemPath(uri.fsPath);
  if (pathTarget != null) {
    return pathTarget;
  }

  let query: unknown;
  try {
    query = JSON.parse(uri.query);
  } catch {
    return undefined;
  }

  if (
    !isRecord(query) ||
    typeof query.historyItemId !== "string" ||
    !isCommitObjectId(query.historyItemId)
  ) {
    return undefined;
  }

  const parentRef = query.historyItemParentId;
  if (parentRef !== undefined && (typeof parentRef !== "string" || !isCommitObjectId(parentRef))) {
    return undefined;
  }

  const repositoryPath = uri.fsPath;
  if (repositoryPath.length === 0) {
    return undefined;
  }

  return {
    commitRef: query.historyItemId,
    ...(parentRef == null ? {} : { parentRef }),
    repositoryUri: vscode.Uri.file(repositoryPath),
  };
}

function parseScmHistoryItemPath(fsPath: string): CommitTarget | undefined {
  const separatorIndex = Math.max(fsPath.lastIndexOf("/"), fsPath.lastIndexOf("\\"));
  if (separatorIndex < 1) {
    return undefined;
  }

  const comparison = fsPath.slice(separatorIndex + 1);
  const rangeSeparatorIndex = comparison.indexOf("..");
  if (rangeSeparatorIndex < 1 || comparison.indexOf("..", rangeSeparatorIndex + 2) !== -1) {
    return undefined;
  }

  const parentRef = comparison.slice(0, rangeSeparatorIndex);
  const commitRef = comparison.slice(rangeSeparatorIndex + 2);
  if (!isCommitObjectId(parentRef) || !isCommitObjectId(commitRef)) {
    return undefined;
  }

  return {
    commitRef,
    parentRef,
    repositoryUri: vscode.Uri.file(fsPath.slice(0, separatorIndex)),
  };
}

function isCommitObjectId(value: string): boolean {
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value);
}

export function getCommandUri(argument: unknown): vscode.Uri | undefined {
  if (argument instanceof vscode.Uri) {
    return argument;
  }

  if (isRecord(argument) && "rootUri" in argument && argument.rootUri !== argument) {
    return getCommandUri(argument.rootUri);
  }

  if (isRecord(argument) && typeof argument.scheme === "string") {
    try {
      return vscode.Uri.from(argument as unknown as Parameters<typeof vscode.Uri.from>[0]);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export async function pickRepository(
  api: GitApi,
  preferredUri?: vscode.Uri,
): Promise<GitRepository | undefined> {
  if (preferredUri != null) {
    const preferred = api.getRepository(preferredUri);
    if (preferred != null) {
      return preferred;
    }
  }

  if (api.repositories.length === 0) {
    throw new Error(vscode.l10n.t("No open Git repositories were found."));
  }

  if (api.repositories.length === 1) {
    return api.repositories[0];
  }

  const sortedRepositories = api.repositories.toSorted(
    (first, second) => Number(second.ui.selected) - Number(first.ui.selected),
  );
  const items = sortedRepositories.map((repository) => ({
    label: `$(repo) ${path.basename(repository.rootUri.fsPath) || repository.rootUri.toString()}`,
    description: repository.rootUri.fsPath,
    repository,
  }));
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: vscode.l10n.t("Choose a Git repository"),
  });

  return selected?.repository;
}

export async function pickCommitRef(repository: GitRepository): Promise<string | undefined> {
  const recentCommits = await repository.log({ maxEntries: 50, shortStats: true });
  const enterReference: RecentCommitItem = {
    label: `$(edit) ${vscode.l10n.t("Enter a commit reference...")}`,
    description: vscode.l10n.t("SHA, branch, tag, or any Git revision"),
    alwaysShow: true,
    enterReference: true,
  };
  const commitItems: RecentCommitItem[] = [];
  for (const commit of recentCommits) {
    const detail = formatCommitDetail(commit);
    const item: RecentCommitItem = {
      label: firstLine(commit.message) || commit.hash.slice(0, 10),
      description: formatCommitDescription(commit),
      commit,
    };
    if (detail != null) {
      item.detail = detail;
    }

    commitItems.push(item);
  }
  const selected = await vscode.window.showQuickPick([enterReference, ...commitItems], {
    matchOnDescription: true,
    matchOnDetail: true,
    placeHolder: vscode.l10n.t("Choose a recent commit"),
  });

  if (selected?.enterReference === true) {
    const reference = await vscode.window.showInputBox({
      prompt: vscode.l10n.t("Enter a commit reference"),
      placeHolder: "HEAD, main~2, v1.0.0, 1a2b3c4",
      value: "HEAD",
      validateInput: (value) =>
        value.trim().length === 0 ? vscode.l10n.t("A commit reference is required.") : undefined,
    });

    return reference?.trim();
  }

  return selected?.commit?.hash;
}

function formatCommitDescription(commit: GitCommit): string {
  const parts = [commit.hash.slice(0, 10), commit.authorName].filter(
    (part): part is string => part != null && part.length > 0,
  );
  return parts.join(" · ");
}

function formatCommitDetail(commit: GitCommit): string | undefined {
  const parts: string[] = [];

  if (commit.authorDate != null) {
    parts.push(
      new Intl.DateTimeFormat(vscode.env.language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(commit.authorDate),
    );
  }

  if (commit.shortStat != null) {
    parts.push(
      vscode.l10n.t("{files} files, +{insertions}, -{deletions}", {
        deletions: commit.shortStat.deletions,
        files: commit.shortStat.files,
        insertions: commit.shortStat.insertions,
      }),
    );
  }

  return parts.length === 0 ? undefined : parts.join(" · ");
}

function firstLine(value: string): string {
  return value.split(/\r?\n/, 1)[0]?.trim() ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}
