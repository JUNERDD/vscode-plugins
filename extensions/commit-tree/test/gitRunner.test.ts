import { describe, expect, it } from "vitest";

import { GitOutputLimitError, runGit } from "../src/gitRunner";

describe("runGit", () => {
  it("captures binary-safe stdout without a shell", async () => {
    const result = await runGit(
      process.execPath,
      ["-e", "process.stdout.write(Buffer.from([0, 1, 2, 255]))"],
      { cwd: process.cwd() },
    );

    expect([...result.stdout]).toEqual([0, 1, 2, 255]);
  });

  it("stops output larger than the configured limit", async () => {
    await expect(
      runGit(process.execPath, ["-e", "process.stdout.write('123456789')"], {
        cwd: process.cwd(),
        maxOutputBytes: 4,
      }),
    ).rejects.toBeInstanceOf(GitOutputLimitError);
  });
});
