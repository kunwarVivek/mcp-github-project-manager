#!/usr/bin/env node

/**
 * Test Validation Script for MCP GitHub Project Manager
 *
 * This script validates that all GitHub Project v2 MCP server functionality
 * is properly tested and working correctly.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import chalk from "chalk";

/**
 * The repository is installable with npm or pnpm. Run the matching package
 * manager so the script works for whoever invokes it.
 */
const PM = /pnpm/i.test(process.env.npm_config_user_agent ?? "") ? "pnpm" : "npm";
const PM_TEST = `${PM} test`;

const REQUIRED_ENV_VARS = {
  github: ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"],
  ai: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"],
};

/**
 * Parse a Vitest summary out of the captured output.
 *
 * Vitest reports "Test Files  122 passed | 4 skipped (126)" and
 * "      Tests  3068 passed | 20 skipped (3088)". The old implementation
 * looked for Jest's "Test Suites:" line, which Vitest never prints - so every
 * count stayed 0 and the validator could not fail.
 */
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
  // Vitest wraps its numbers in ANSI codes, so strip them before matching.
  const plain = stripAnsi(output);
  const count = (label, kind) => {
    // Anchor on the start of the line: a test's own stdout can contain the
    // word "Tests", and the first match wins otherwise.
    const line = plain.split("\n").find((l) => new RegExp(`^\\s*${label}\\s`).test(l));
    if (!line) return 0;
    const match = line.match(new RegExp(`(\\d+) ${kind}`));
    return match ? parseInt(match[1], 10) : 0;
  };
  return {
    passed: count("Tests", "passed"),
    failed: count("Tests", "failed"),
    skipped: count("Tests", "skipped"),
    filesPassed: count("Test Files", "passed"),
    filesFailed: count("Test Files", "failed"),
  };
}

class TestValidator {
  constructor() {
    this.results = {
      unit: { passed: 0, failed: 0, skipped: 0 },
      e2e: { passed: 0, failed: 0, skipped: 0 },
      integration: { passed: 0, failed: 0, skipped: 0 },
    };
    this.errors = [];
  }

  log(message, type = "info") {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
    };
    console.log(colors[type](`[${type.toUpperCase()}] ${message}`));
  }

  checkEnvironment() {
    this.log("Checking environment setup...", "info");

    const missing = {
      github: REQUIRED_ENV_VARS.github.filter((env) => !process.env[env]),
      ai: REQUIRED_ENV_VARS.ai.filter((env) => !process.env[env]),
    };

    if (missing.github.length > 0) {
      this.log(`Missing GitHub credentials: ${missing.github.join(", ")}`, "warning");
      this.log("E2E tests will be skipped for GitHub functionality", "warning");
    } else {
      this.log("GitHub credentials found ✓", "success");
    }

    if (missing.ai.length === REQUIRED_ENV_VARS.ai.length) {
      this.log("No AI provider credentials found", "warning");
      this.log("AI-related E2E tests will be skipped", "warning");
    } else {
      const available = REQUIRED_ENV_VARS.ai.filter((env) => process.env[env]);
      this.log(`AI providers available: ${available.join(", ")} ✓`, "success");
    }

    return {
      hasGitHub: missing.github.length === 0,
      hasAI: missing.ai.length < REQUIRED_ENV_VARS.ai.length,
    };
  }

  async runUnitTests() {
    this.log("Running unit tests...", "info");

    try {
      // "unit" as a positional filter only matches paths containing "unit",
      // which silently excludes the root tests/ tree - so filter the unit
      // suites explicitly.
      const output = execSync(`${PM_TEST} src/__tests__/unit --passWithNoTests`, {
        encoding: "utf8",
        stdio: "pipe",
      });

      // Parse VITEST output. Vitest prints
      //   " Test Files  122 passed | 4 skipped (126)"
      //   "      Tests  3068 passed | 20 skipped (3088)"
      // It never prints Jest's "Test Suites:", so parsing for that string is
      // what made this validator report 0/0 and always pass.
      Object.assign(this.results.unit, parseVitestSummary(output));

      this.log(
        `Unit tests completed: ${this.results.unit.passed} passed, ${this.results.unit.failed} failed`,
        "success"
      );
      return true;
    } catch (error) {
      // execSync throws on a non-zero exit; the output still carries the
      // summary, so report the real counts next to the failure.
      const output = error.stdout ? String(error.stdout) : "";
      Object.assign(this.results.unit, parseVitestSummary(output));
      this.log(
        `Unit tests failed: ${this.results.unit.failed} failed of ${this.results.unit.passed + this.results.unit.failed + this.results.unit.skipped}`,
        "error"
      );
      this.errors.push(`Unit tests: ${error.message}`);
      return false;
    }
  }

  async runE2ETests(hasCredentials) {
    this.log("Running E2E tests...", "info");

    if (!hasCredentials.hasGitHub && !hasCredentials.hasAI) {
      this.log("Skipping E2E tests - no credentials available", "warning");
      this.results.e2e.skipped = 1;
      return true;
    }

    try {
      const output = execSync(`${PM_TEST} e2e --passWithNoTests --verbose --testTimeout=30000`, {
        encoding: "utf8",
        stdio: "pipe",
      });

      Object.assign(this.results.e2e, parseVitestSummary(output));

      this.log(
        `E2E tests completed: ${this.results.e2e.passed} passed, ${this.results.e2e.failed} failed, ${this.results.e2e.skipped} skipped`,
        "success"
      );
      return true;
    } catch (error) {
      const output = error.stdout ? String(error.stdout) : "";
      Object.assign(this.results.e2e, parseVitestSummary(output));
      this.log(
        `E2E tests failed: ${this.results.e2e.failed} failed of ${this.results.e2e.passed + this.results.e2e.failed + this.results.e2e.skipped}`,
        "error"
      );
      this.errors.push(`E2E tests: ${error.message}`);
      return false;
    }
  }

  validateGitHubProjectV2Functionality() {
    this.log("Validating GitHub Project v2 functionality coverage...", "info");

    const requiredTests = [
      "src/__tests__/unit/infrastructure/github/repositories/GitHubProjectRepository.test.ts",
      "src/__tests__/unit/infrastructure/github/repositories/GitHubMilestoneRepository.test.ts",
      "src/__tests__/unit/infrastructure/github/repositories/GitHubIssueRepository.test.ts",
      "src/__tests__/unit/services/ProjectManagementService.test.ts",
      "src/__tests__/e2e/tools/github-project-tools.e2e.ts",
      "src/__tests__/e2e/tools/ai-task-tools.e2e.ts",
    ];

    const missing = requiredTests.filter((test) => !existsSync(test));

    if (missing.length > 0) {
      this.log(`Missing required test files: ${missing.join(", ")}`, "error");
      this.errors.push(`Missing test files: ${missing.join(", ")}`);
      return false;
    }

    this.log("All required test files present ✓", "success");
    return true;
  }

  generateReport() {
    this.log(`\n${"=".repeat(60)}`, "info");
    this.log("TEST VALIDATION REPORT", "info");
    this.log("=".repeat(60), "info");

    // Unit Tests
    this.log(`\nUnit Tests:`, "info");
    this.log(`  ✓ Passed: ${this.results.unit.passed}`, "success");
    if (this.results.unit.failed > 0) {
      this.log(`  ✗ Failed: ${this.results.unit.failed}`, "error");
    }

    // E2E Tests
    this.log(`\nE2E Tests:`, "info");
    this.log(`  ✓ Passed: ${this.results.e2e.passed}`, "success");
    if (this.results.e2e.failed > 0) {
      this.log(`  ✗ Failed: ${this.results.e2e.failed}`, "error");
    }
    if (this.results.e2e.skipped > 0) {
      this.log(`  ⏭ Skipped: ${this.results.e2e.skipped}`, "warning");
    }

    this.log(
      `\nTest files: ${this.results.unit.filesPassed} unit file(s) passed, ${this.results.unit.filesFailed} failed`,
      "info"
    );

    // Overall Status
    const totalPassed = this.results.unit.passed + this.results.e2e.passed;
    const totalFailed = this.results.unit.failed + this.results.e2e.failed;
    const totalSkipped = this.results.unit.skipped + this.results.e2e.skipped;

    this.log(`\nOverall Results:`, "info");
    this.log(`  Total Passed: ${totalPassed}`, "success");
    if (totalFailed > 0) {
      this.log(`  Total Failed: ${totalFailed}`, "error");
    }
    if (totalSkipped > 0) {
      this.log(`  Total Skipped: ${totalSkipped}`, "warning");
    }

    // Errors
    if (this.errors.length > 0) {
      this.log(`\nErrors:`, "error");
      this.errors.forEach((error) => {
        this.log(`  - ${error}`, "error");
      });
    }

    // Final Status
    const success = totalFailed === 0 && this.errors.length === 0;
    this.log(
      `\nValidation Status: ${success ? "PASSED" : "FAILED"}`,
      success ? "success" : "error"
    );

    return success;
  }

  async run() {
    this.log("Starting MCP GitHub Project Manager test validation...", "info");

    const credentials = this.checkEnvironment();
    const functionalityValid = this.validateGitHubProjectV2Functionality();
    const unitTestsPass = await this.runUnitTests();
    const e2eTestsPass = await this.runE2ETests(credentials);

    if (!functionalityValid || !unitTestsPass || !e2eTestsPass) {
      this.log("\nAt least one check failed - see the errors above.", "error");
    }

    const success = this.generateReport();

    process.exit(success ? 0 : 1);
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new TestValidator();
  validator.run().catch((error) => {
    console.error(chalk.red("Validation failed:"), error);
    process.exit(1);
  });
}

export default TestValidator;
