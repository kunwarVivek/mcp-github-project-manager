import { describe, expect, it } from "vitest";
import {
  GH_TOKEN_TTL_MS,
  GhTokenSource,
} from "../../../../../../infrastructure/github/auth/gh/GhTokenSource";
import { fakeGhRunner } from "../../../../../helpers/fakeGhRunner";

function clock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("GhTokenSource", () => {
  it("runs `gh auth token --hostname github.com` with an argument array", () => {
    const runner = fakeGhRunner({ token: "gho_a" });
    const source = new GhTokenSource({ runner });
    expect(source.current()).toBe("gho_a");
    expect(runner.captures).toEqual([["auth", "token", "--hostname", "github.com"]]);
  });

  it("passes --user when GH_CLI_USER pins an account", () => {
    const runner = fakeGhRunner({ token: "gho_a" });
    const source = new GhTokenSource({ runner, user: () => "DEVTekhsters" });
    source.current();
    expect(runner.captures[0]).toEqual([
      "auth",
      "token",
      "--hostname",
      "github.com",
      "--user",
      "DEVTekhsters",
    ]);
    expect(source.pinnedUser()).toBe("DEVTekhsters");
  });

  it("refuses a pinned user that is not a GitHub login instead of passing it to gh", () => {
    const runner = fakeGhRunner({ token: "gho_a" });
    const source = new GhTokenSource({ runner, user: () => "--hostname=evil" });
    expect(source.current()).toBeUndefined();
    expect(source.inspect()).toEqual({ status: "invalid-user" });
    expect(runner.captures).toEqual([]);
  });

  it("reuses the token within the TTL and re-reads after it", () => {
    const time = clock();
    let n = 0;
    const runner = fakeGhRunner({ token: () => `gho_${++n}` });
    const source = new GhTokenSource({ runner, now: time.now });

    expect(source.current()).toBe("gho_1");
    time.advance(GH_TOKEN_TTL_MS - 1);
    expect(source.current()).toBe("gho_1");
    expect(runner.captures).toHaveLength(1);

    time.advance(1);
    expect(source.current()).toBe("gho_2");
    expect(runner.captures).toHaveLength(2);
  });

  it("caches a failure for the TTL window, then retries on the next window", () => {
    const time = clock();
    const runner = fakeGhRunner({ failToken: true, token: "gho_late" });
    const source = new GhTokenSource({ runner, now: time.now });

    expect(source.current()).toBeUndefined();
    expect(source.current()).toBeUndefined();
    expect(runner.captures).toHaveLength(1);

    runner.failToken = false; // user ran `gh auth login` in the meantime
    time.advance(GH_TOKEN_TTL_MS);
    expect(source.current()).toBe("gho_late");
    expect(runner.captures).toHaveLength(2);
  });

  it("re-reads immediately on refresh() and picks up a changed token", () => {
    const time = clock();
    const runner = fakeGhRunner({ token: "gho_old" });
    const source = new GhTokenSource({ runner, now: time.now });
    source.current();

    runner.token = "gho_new";
    time.advance(5_000);
    expect(source.refresh()).toBe("gho_new");
    expect(source.current()).toBe("gho_new");
    expect(runner.captures).toHaveLength(2);
  });

  it("does not re-spawn gh for a burst of forced refreshes within a second", () => {
    const time = clock();
    const runner = fakeGhRunner({ token: "gho_a" });
    const source = new GhTokenSource({ runner, now: time.now });
    source.current();
    time.advance(100);
    source.refresh();
    source.refresh();
    expect(runner.captures).toHaveLength(1);
  });

  it("re-reads when the pinned account changes", () => {
    let user: string | undefined = "alice";
    const runner = fakeGhRunner({ token: "gho_a" });
    const source = new GhTokenSource({ runner, user: () => user });
    source.current();
    user = "bob";
    source.current();
    expect(runner.captures.map((args) => args.at(-1))).toEqual(["alice", "bob"]);
  });

  it("inspect() distinguishes gh missing, not logged in, and ok — always re-reading", () => {
    expect(new GhTokenSource({ runner: fakeGhRunner({ missing: true }) }).inspect()).toEqual({
      status: "missing",
    });
    expect(new GhTokenSource({ runner: fakeGhRunner({ failToken: true }) }).inspect()).toEqual({
      status: "unavailable",
    });
    expect(new GhTokenSource({ runner: fakeGhRunner({ token: "  \n" }) }).inspect()).toEqual({
      status: "unavailable",
    });
    const runner = fakeGhRunner({ token: "gho_a" });
    const source = new GhTokenSource({ runner });
    source.inspect();
    source.inspect();
    expect(runner.captures).toHaveLength(2);
  });
});
