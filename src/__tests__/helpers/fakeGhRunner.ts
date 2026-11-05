import type {
  GhCapture,
  GhInteractiveResult,
  GhRunner,
} from "../../infrastructure/github/auth/gh/ghRunner";

export interface FakeGhRunnerOptions {
  /** Token answered to `gh auth token`; a function yields a different one per call. */
  token?: string | (() => string | undefined);
  /** Pretend `gh` is not installed. */
  missing?: boolean;
  /** Pretend `gh auth token` fails (not logged in). */
  failToken?: boolean;
  /** Answer per interactive invocation; default exit code 0. */
  interactive?: (args: readonly string[]) => GhInteractiveResult | undefined;
}

export interface FakeGhRunner extends GhRunner {
  readonly captures: string[][];
  readonly interactiveCalls: string[][];
  /** Mutable: tests change what the next `gh auth token` returns. */
  token: string | (() => string | undefined) | undefined;
  failToken: boolean;
}

/** A scripted gh runner that records every invocation. */
export function fakeGhRunner(options: FakeGhRunnerOptions = {}): FakeGhRunner {
  const runner: FakeGhRunner = {
    captures: [],
    interactiveCalls: [],
    token: options.token,
    failToken: options.failToken ?? false,
    capture(args): GhCapture {
      runner.captures.push([...args]);
      if (options.missing) return { status: "missing" };
      if (args[0] === "--version") return { status: "ok", stdout: "gh version 2.103.3\n" };
      if (runner.failToken) return { status: "failed" };
      const token = typeof runner.token === "function" ? runner.token() : runner.token;
      return token === undefined ? { status: "failed" } : { status: "ok", stdout: `${token}\n` };
    },
    interactive(args): GhInteractiveResult {
      runner.interactiveCalls.push([...args]);
      if (options.missing) return { status: "missing" };
      return options.interactive?.(args) ?? { status: "exited", code: 0 };
    },
  };
  return runner;
}
