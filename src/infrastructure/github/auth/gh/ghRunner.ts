import { execFileSync, spawnSync } from "node:child_process";

/** Hard cap on how long a non-interactive `gh` call may take. */
const GH_TIMEOUT_MS = 5_000;

/** The one host the server supports. GitHub Enterprise Server is out of scope. */
export const GH_HOSTNAME = "github.com";

export type GhCapture =
  | { readonly status: "ok"; readonly stdout: string }
  /** The `gh` binary is not installed / not on PATH. */
  | { readonly status: "missing" }
  /** `gh` ran but failed (not logged in, timeout, non-zero exit). */
  | { readonly status: "failed" };

export type GhInteractiveResult =
  | { readonly status: "missing" }
  | { readonly status: "exited"; readonly code: number };

/**
 * The only way this codebase talks to the `gh` binary. Injectable so every gh
 * behaviour can be exercised without a real `gh` on the machine.
 */
export interface GhRunner {
  /**
   * Run `gh` non-interactively and capture stdout. stderr is discarded so a gh
   * error can never reach our stdout and corrupt the MCP protocol stream.
   */
  capture(args: readonly string[]): GhCapture;
  /**
   * Run `gh` attached to the user's terminal (for `auth login` / `auth refresh`).
   * stdin and stderr are inherited; gh's stdout is redirected to OUR stderr so
   * nothing gh prints can land on stdout.
   */
  interactive(args: readonly string[]): GhInteractiveResult;
}

function isMissingBinary(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "ENOENT"
  );
}

/**
 * Real runner: `execFileSync` / `spawnSync` with an argument array — never a
 * shell string, so nothing here is injectable.
 */
export const systemGhRunner: GhRunner = {
  capture(args) {
    try {
      const stdout = execFileSync("gh", [...args], {
        encoding: "utf8",
        timeout: GH_TIMEOUT_MS,
        stdio: ["ignore", "pipe", "ignore"],
      });
      return { status: "ok", stdout };
    } catch (error) {
      return isMissingBinary(error) ? { status: "missing" } : { status: "failed" };
    }
  },
  interactive(args) {
    const result = spawnSync("gh", [...args], { stdio: ["inherit", 2, "inherit"] });
    if (result.error) {
      return isMissingBinary(result.error) ? { status: "missing" } : { status: "exited", code: 1 };
    }
    return { status: "exited", code: result.status ?? 1 };
  },
};
