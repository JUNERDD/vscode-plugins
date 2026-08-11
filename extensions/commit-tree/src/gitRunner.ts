import { spawn } from "node:child_process";

export interface GitRunOptions {
  readonly cwd: string;
  readonly input?: string;
  readonly maxOutputBytes?: number;
}

export interface GitRunResult {
  readonly stderr: string;
  readonly stdout: Buffer;
}

export class GitOutputLimitError extends Error {
  constructor(readonly limitBytes: number) {
    super(`Git output exceeded ${limitBytes} bytes.`);
    this.name = "GitOutputLimitError";
  }
}

export async function runGit(
  executable: string,
  args: readonly string[],
  options: GitRunOptions,
): Promise<GitRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        GIT_OPTIONAL_LOCKS: "0",
        GIT_PAGER: "cat",
        LC_ALL: "C",
      },
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const maxOutputBytes = options.maxOutputBytes ?? Number.POSITIVE_INFINITY;
    let outputBytes = 0;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill();
      reject(error);
    };

    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > maxOutputBytes) {
        fail(new GitOutputLimitError(maxOutputBytes));
        return;
      }

      stdoutChunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderrChunks.reduce((size, item) => size + item.byteLength, 0) < 1024 * 1024) {
        stderrChunks.push(chunk);
      }
    });
    child.on("error", fail);
    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
      if (code !== 0) {
        reject(
          new Error(
            stderr.length > 0
              ? stderr
              : `Git exited with ${code == null ? `signal ${signal ?? "unknown"}` : `code ${code}`}.`,
          ),
        );
        return;
      }

      resolve({
        stderr,
        stdout: Buffer.concat(stdoutChunks),
      });
    });

    child.stdin.end(options.input ?? "");
  });
}
