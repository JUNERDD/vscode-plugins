export type WorkspaceStat = {
  label: string;
  value: string;
};

export const workspaceStats: WorkspaceStat[] = [
  { label: "Workspace lanes", value: "3" },
  { label: "Build system", value: "Turbo" },
  { label: "Bundler", value: "Rolldown" },
];

export const engineeringLanes = [
  "extensions/* for VS Code plugins",
  "packages/* for shared code",
  "web/* for Next.js apps",
] as const;

export function getExtensionReadyMessage(extensionName: string): string {
  return `${extensionName} is running from the vscode-plugins workspace.`;
}
