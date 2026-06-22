import { describe, expect, it } from "vitest";

import { engineeringLanes, getExtensionReadyMessage, workspaceStats } from "./index";

describe("shared workspace metadata", () => {
  it("describes the workspace lanes", () => {
    expect(engineeringLanes).toContain("extensions/* for VS Code plugins");
    expect(engineeringLanes).toContain("packages/* for shared code");
    expect(engineeringLanes).toContain("web/* for Next.js apps");
  });

  it("provides landing stats", () => {
    expect(workspaceStats).toEqual(
      expect.arrayContaining([
        { label: "Build system", value: "Turbo" },
        { label: "Bundler", value: "Rolldown" },
      ]),
    );
  });

  it("formats extension readiness messages", () => {
    expect(getExtensionReadyMessage("Example Extension")).toBe(
      "Example Extension is running from the vscode-plugins workspace.",
    );
  });
});
