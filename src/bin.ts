#!/usr/bin/env node

/**
 * Process entry point (the package `bin`).
 *
 * `auth ...` subcommands must run without the MCP server's configuration, but
 * `src/index.ts` pulls in `src/env.ts`, which parses argv and validates the
 * required GitHub settings the moment it is imported (static imports are
 * hoisted, so index.ts cannot decide this itself). Routing here, with dynamic
 * imports, keeps the two paths from ever loading each other.
 */
if (process.argv[2] === "auth") {
  const { runAuthCli } = await import("./auth-cli");
  process.exitCode = await runAuthCli(process.argv.slice(3));
} else {
  await import("./index");
}

// Top-level await requires a module; this file has no static imports by design.
export {};
