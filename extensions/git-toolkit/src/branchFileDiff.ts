import * as path from "node:path";
import * as vscode from "vscode";

import { GitRefType, type GitApi, type GitChange, type GitRef, type GitRepository } from "./gitApi";

export const EMPTY_DOCUMENT_SCHEME = "git-toolkit-empty";

interface BranchItem extends vscode.QuickPickItem {
  readonly ref: GitRef & Required<Pick<GitRef, "commit" | "name">>;
}

/** Supplies the empty base used when the selected branch does not contain the current path. */
export class EmptyDocumentProvider implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(): string {
    return "";
  }
}

/** Opens the current working file beside the immutable version from a selected Git branch. */
export async function compareFileWithBranch(api: GitApi, argument?: unknown): Promise<void> {
  const fileUri = getFileUri(argument) ?? vscode.window.activeTextEditor?.document.uri;
  if (fileUri == null || fileUri.scheme !== "file") {
    throw new Error(vscode.l10n.t("Open a local file before comparing it with a branch."));
  }

  const repository = api.getRepository(fileUri);
  if (repository == null) {
    throw new Error(vscode.l10n.t("The selected file is not inside an open Git repository."));
  }

  const branch = await pickBranch(repository);
  if (branch == null) {
    return;
  }

  const branchUri = await resolveBranchFileUri(api, repository, fileUri, branch.ref.commit);
  const fileName = path.basename(fileUri.fsPath) || fileUri.fsPath;
  const title = vscode.l10n.t("{name} ({branch} ↔ Working Tree)", {
    branch: getBranchDisplayName(branch.ref),
    name: fileName,
  });

  await vscode.commands.executeCommand("vscode.diff", branchUri, fileUri, title, {
    preview: false,
  });
}

export async function pickBranch(repository: GitRepository): Promise<BranchItem | undefined> {
  const branches = await repository.getBranches({ remote: true });
  const headName = repository.state.HEAD?.name;
  const items = branches
    .filter(
      (ref): ref is GitRef & Required<Pick<GitRef, "commit" | "name">> =>
        ref.name != null && ref.name.length > 0 && ref.commit != null && isObjectId(ref.commit),
    )
    .toSorted(
      (first, second) =>
        Number(isCurrentBranch(second, headName)) - Number(isCurrentBranch(first, headName)),
    )
    .map((ref): BranchItem => {
      const current = isCurrentBranch(ref, headName);
      return {
        label: `${current ? "$(check)" : "$(git-branch)"} ${getBranchDisplayName(ref)}`,
        description: current ? vscode.l10n.t("Current branch") : ref.commit.slice(0, 10),
        ref,
      };
    });

  if (items.length === 0) {
    throw new Error(vscode.l10n.t("No branches with commits were found in this repository."));
  }

  return vscode.window.showQuickPick(items, {
    matchOnDescription: true,
    placeHolder: vscode.l10n.t("Choose the branch version to compare"),
  });
}

function isCurrentBranch(ref: GitRef, headName: string | undefined): boolean {
  return ref.type === GitRefType.Head && ref.name === headName;
}

function getBranchDisplayName(ref: GitRef & Required<Pick<GitRef, "name">>): string {
  const remote = ref.remote?.trim();
  return remote == null || remote.length === 0 || ref.name.startsWith(`${remote}/`)
    ? ref.name
    : `${remote}/${ref.name}`;
}

async function resolveBranchFileUri(
  api: GitApi,
  repository: GitRepository,
  fileUri: vscode.Uri,
  commit: string,
): Promise<vscode.Uri> {
  try {
    await repository.getObjectDetails(commit, fileUri.fsPath);
    return api.toGitUri(fileUri, commit);
  } catch (error) {
    if (!isUnknownPathError(error)) {
      throw error;
    }
  }

  const renamedFile = findRenamedFile(await repository.diffWith(commit), fileUri);
  return renamedFile == null
    ? createEmptyDocumentUri(fileUri, commit)
    : api.toGitUri(renamedFile.originalUri, commit);
}

function findRenamedFile(
  changes: readonly GitChange[],
  fileUri: vscode.Uri,
): GitChange | undefined {
  const current = fileUri.toString();
  return changes.find(
    (change) =>
      change.uri.toString() === current && change.originalUri.toString() !== change.uri.toString(),
  );
}

function createEmptyDocumentUri(fileUri: vscode.Uri, commit: string): vscode.Uri {
  return fileUri.with({
    scheme: EMPTY_DOCUMENT_SCHEME,
    query: `ref=${encodeURIComponent(commit)}`,
  });
}

function getFileUri(argument: unknown): vscode.Uri | undefined {
  if (argument instanceof vscode.Uri) {
    return argument;
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

function isUnknownPathError(error: unknown): boolean {
  return isRecord(error) && error.gitErrorCode === "UnknownPath";
}

function isObjectId(value: string): boolean {
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}
