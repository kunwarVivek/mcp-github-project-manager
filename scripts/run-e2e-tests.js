#!/usr/bin/env node

/**
 * Comprehensive E2E Test Runner for the MCP GitHub Project Manager.
 *
 * Scope flags select a suite by POSITIONAL Vitest filter. Vitest 5 rejects
 * Jest-only flags (`--testPathPattern` dies with `CACError: Unknown option`),
 * so the filter is passed as a positional argument and exclusions use
 * `--exclude=`.
 *
 * The runner always uses the project's OWN vitest binary (never `npx`, which
 * would hit the network), through whichever package manager invoked it.
 */

import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * The repository is installable with npm or pnpm. Run the matching package
 * manager so the script works for whoever invokes it.
 */
const PM = /pnpm/i.test(process.env.npm_config_user_agent ?? "") ? "pnpm" : "npm";

// ANSI color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader() {
  console.log(colorize("\n🧪 MCP Tools Comprehensive E2E Test Runner", "cyan"));
  console.log(colorize("=".repeat(50), "cyan"));
}

/**
 * The e2e suites, by short name. Each entry is a positional Vitest filter
 * that matches exactly one file in src/__tests__/e2e.
 */
const SUITES = {
  github: "github-project-tools",
  ai: "ai-task-tools",
  workflows: "tool-integration-workflows",
  agents: "agent-orchestration",
  platform: "platform-validation",
  pipeline: "full-pipeline",
  basic: "basic-validation",
  protocol: "mcp-protocol-compliance",
  stdio: "stdio-transport",
  resources: "resource-system",
  metrics: "metrics-reporting",
  server: "mcp-server-integration",
};

function printUsage() {
  console.log(colorize("\nUsage:", "bright"));
  console.log("  node scripts/run-e2e-tests.js [options]");

  console.log(colorize("\nScope (mutually exclusive):", "bright"));
  console.log("  --github-only             GitHub project tools");
  console.log("  --ai-only                 AI tool suites");
  console.log("  --workflows-only         Tool integration workflows");
  console.log("  --agent-only              Agent orchestration");
  console.log("  --platform-only          Platform validation");
  console.log("  --all                     Every e2e suite (default)");
  console.log("  --suite <name>            One suite by name (repeatable)");
  console.log("                             names: " + Object.keys(SUITES).join(", "));

  console.log(colorize("\nOptions:", "bright"));
  console.log("  --help, -h                Show this help message");
  console.log("  --real-api                Use real APIs instead of mocks");
  console.log("  --build                   Build the project before running tests");
  console.log("  --verbose                 Enable verbose output");
  console.log("  --timeout <seconds>       Per-test timeout (default: 120 - the live API is slow)");
  console.log("  --json <path>             Also write a machine-readable summary");

  console.log(colorize("\nExamples:", "bright"));
  console.log("  node scripts/run-e2e-tests.js");
  console.log("  node scripts/run-e2e-tests.js --real-api --github-only");
  console.log("  node scripts/run-e2e-tests.js --build --verbose");
  console.log("  node scripts/run-e2e-tests.js --suite agents --suite workflows");
  console.log("  node scripts/run-e2e-tests.js --json /tmp/e2e-summary.json");
}

function checkEnvironment() {
  console.log(colorize("\n🔍 Checking Environment...", "yellow"));

  // Check if build exists
  const buildPath = path.join(process.cwd(), "build", "index.js");
  if (!existsSync(buildPath)) {
    console.log(
      colorize(
        '⚠️  Build not found. Run with --build flag or run "npm run build" / "pnpm run build" first.',
        "yellow"
      )
    );
    return false;
  }

  // Check environment variables
  const requiredEnvVars = ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"];
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.log(colorize(`⚠️  Missing environment variables: ${missingVars.join(", ")}`, "yellow"));
    console.log(colorize("   Tests will run with mock values.", "yellow"));
  }

  // Check AI API keys
  const aiKeys = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY", "PERPLEXITY_API_KEY"];
  const hasAIKey = aiKeys.some((key) => process.env[key]);

  if (!hasAIKey) {
    console.log(colorize("⚠️  No AI API keys found. AI tests will use mock responses.", "yellow"));
  }

  console.log(colorize("✅ Environment check complete.", "green"));
  return true;
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(colorize(`\n🚀 Running: ${command} ${args.join(" ")}`, "blue"));

    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      ...options,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

async function buildProject() {
  console.log(colorize("\n🔨 Building project...", "yellow"));
  try {
    await runCommand(PM, ["run", "build"]);
    console.log(colorize("✅ Build completed successfully.", "green"));
  } catch (error) {
    console.error(colorize("❌ Build failed:", "red"), error.message);
    process.exit(1);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    help: false,
    realApi: false,
    scope: null,
    suites: [],
    build: false,
    verbose: false,
    timeout: 120,
    json: null,
  };

  const scopeFlags = {
    "--github-only": "github",
    "--ai-only": "ai",
    "--workflows-only": "workflows",
    "--agent-only": "agents",
    "--platform-only": "platform",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg in scopeFlags) {
      options.scope = scopeFlags[arg];
      continue;
    }

    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--real-api":
        options.realApi = true;
        break;
      case "--all":
        options.scope = null;
        options.suites = [];
        break;
      case "--suite":
        if (i + 1 < args.length) {
          const name = args[i + 1];
          if (!SUITES[name]) {
            console.log(
              colorize(
                `⚠️  Unknown suite "${name}". Known: ${Object.keys(SUITES).join(", ")}`,
                "yellow"
              )
            );
          } else {
            options.suites.push(name);
          }
          i++; // Skip next argument
        }
        break;
      case "--build":
        options.build = true;
        break;
      case "--verbose":
        options.verbose = true;
        break;
      case "--timeout":
        if (i + 1 < args.length) {
          options.timeout = parseInt(args[i + 1], 10);
          i++; // Skip next argument
        }
        break;
      case "--json":
        if (i + 1 < args.length) {
          options.json = args[i + 1];
          i++; // Skip next argument
        }
        break;
      default:
        console.log(colorize(`⚠️  Unknown option: ${arg}`, "yellow"));
    }
  }

  return options;
}

/**
 * Build the vitest invocation.
 *
 * Filters are POSITIONAL (Vitest 5) and the timeout is the CLI option
 * `--testTimeout` - Vitest does not read a VITEST_TIMEOUT env var.
 */
function buildTestCommand(options) {
  const filters = [];

  if (options.suites.length > 0) {
    for (const name of options.suites) {
      filters.push(SUITES[name]);
    }
  } else if (options.scope) {
    filters.push(SUITES[options.scope]);
  } else {
    filters.push("src/__tests__/e2e");
  }

  const args = ["vitest", "run", ...filters, `--testTimeout=${options.timeout * 1000}`];

  if (options.verbose) {
    args.push("--reporter=verbose");
  }

  // npm exec needs the `--` separator; pnpm exec does not accept one.
  const command = PM === "pnpm" ? "pnpm" : "npm";
  const commandArgs = PM === "pnpm" ? args : ["exec", "--", ...args];

  const env = { ...process.env };
  if (options.realApi) {
    env.E2E_REAL_API = "true";
  }

  return { command, args: commandArgs, env, filters };
}

/**
 * Remove ANSI escape sequences.
 *
 * Vitest wraps its summary numbers in colour codes, so "56\x1b[22m passed"
 * never matches /(\d+) passed/ - without stripping them every count comes
 * out as 0. The escape character is built at runtime because Biome rejects
 * control characters inside a regular expression literal.
 */
function stripAnsi(text) {
  return text.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "");
}

function parseVitestSummary(output) {
  // Vitest prints: " Test Files  122 passed | 4 skipped (126)"
  // and:           "      Tests  3068 passed | 20 skipped (3088)"
  // The numbers are wrapped in ANSI codes, so strip them before matching -
  // otherwise "56\x1b[22m passed" never matches /(\d+) passed/ and every
  // count comes out as 0.
  const plain = stripAnsi(output);
  // Anchor on the start of the line: a test's own stdout can contain the
  // word "Tests", and the first match wins otherwise.
  const files = plain.match(/^\s*Test Files\s+(.+)$/m);
  const tests = plain.match(/^\s*Tests\s+(.+)$/m);
  const count = (line, kind) => {
    if (!line) return 0;
    const match = line[1].match(new RegExp(`(\\d+) ${kind}`));
    return match ? parseInt(match[1], 10) : 0;
  };
  return {
    filesPassed: count(files, "passed"),
    filesFailed: count(files, "failed"),
    filesSkipped: count(files, "skipped"),
    testsPassed: count(tests, "passed"),
    testsFailed: count(tests, "failed"),
    testsSkipped: count(tests, "skipped"),
  };
}

async function runTests(options) {
  const { command, args, env, filters } = buildTestCommand(options);

  console.log(colorize("\n📋 Test Configuration:", "cyan"));
  console.log(`  Mode: ${options.realApi ? "Real API" : "Mock API"}`);
  console.log(`  Package manager: ${PM}`);
  console.log(`  Filters: ${filters.join(", ")}`);
  console.log(`  Timeout: ${options.timeout}s`);
  console.log(`  Verbose: ${options.verbose ? "Yes" : "No"}`);

  // Capture the output so the summary can be parsed, and still stream it.
  let output = "";
  const child = spawn(command, args, { env, shell: true });
  child.stdout?.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  });
  child.stderr?.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stderr.write(text);
  });

  const code = await new Promise((resolve) => {
    child.on("close", (exitCode) => resolve(exitCode ?? 1));
    child.on("error", () => resolve(1));
  });

  const summary = parseVitestSummary(output);
  console.log(colorize("\n📊 Summary:", "cyan"));
  console.log(
    `  Test files: ${summary.filesPassed} passed, ${summary.filesFailed} failed, ${summary.filesSkipped} skipped`
  );
  console.log(
    `  Tests:      ${summary.testsPassed} passed, ${summary.testsFailed} failed, ${summary.testsSkipped} skipped`
  );

  if (options.json) {
    const payload = {
      mode: options.realApi ? "real-api" : "mock",
      packageManager: PM,
      filters,
      timeoutSeconds: options.timeout,
      exitCode: code,
      ...summary,
    };
    writeFileSync(options.json, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(colorize(`  JSON summary written to ${options.json}`, "cyan"));
  }

  if (code !== 0) {
    console.error(colorize("\n❌ Tests failed.", "red"));
    process.exit(code);
  }

  console.log(colorize("\n✅ All tests completed successfully!", "green"));
}

async function main() {
  printHeader();

  const options = parseArgs();

  if (options.help) {
    printUsage();
    return;
  }

  // Build project if requested
  if (options.build) {
    await buildProject();
  }

  // Check environment
  if (!checkEnvironment()) {
    console.log(
      colorize(
        "\n⚠️  Environment issues detected. Continuing with available configuration...",
        "yellow"
      )
    );
  }

  // Run tests
  await runTests(options);
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error(colorize("\n💥 Uncaught Exception:", "red"), error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(colorize("\n💥 Unhandled Rejection:", "red"), reason);
  process.exit(1);
});

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(colorize("\n💥 Script failed:", "red"), error);
    process.exit(1);
  });
}

export { buildTestCommand, main, parseArgs, parseVitestSummary, SUITES };
