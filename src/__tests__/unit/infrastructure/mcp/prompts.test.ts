import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { InputSanitizer } from "../../../../services/utils/InputSanitizer";
import { registerPrompts } from "../../../../infrastructure/mcp/prompts";

/**
 * Unit tests for the six reusable MCP prompt templates registered by
 * `registerPrompts()` in `src/infrastructure/mcp/prompts.ts`.
 *
 * `registerPrompts()` is a plain, side-effect-free exported function that
 * only needs an `McpServer`-shaped object with a `registerPrompt` method, so
 * it is exercised directly against a lightweight capturing double instead of
 * a mocked SDK server.
 */

interface CapturedPrompt {
  name: string;
  config: {
    title?: string;
    description?: string;
    argsSchema?: { parse: (input: unknown) => Record<string, unknown> };
  };
  callback: (args: Record<string, unknown>) => {
    messages: Array<{ role: string; content: { type: string; text: string } }>;
  };
}

function createCapturingServer(): { server: McpServer; prompts: Record<string, CapturedPrompt> } {
  const prompts: Record<string, CapturedPrompt> = {};
  const server = {
    registerPrompt: (name: string, config: CapturedPrompt["config"], callback: CapturedPrompt["callback"]) => {
      prompts[name] = { name, config, callback };
    },
  };
  return { server: server as unknown as McpServer, prompts };
}

let prompts: Record<string, CapturedPrompt>;

beforeAll(() => {
  const captured = createCapturingServer();
  registerPrompts(captured.server);
  prompts = captured.prompts;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function getPrompt(name: string): CapturedPrompt {
  const prompt = prompts[name];
  if (!prompt) throw new Error(`Prompt "${name}" was never registered`);
  return prompt;
}

describe("registerPrompts", () => {
  it("registers all six prompt templates", () => {
    expect(Object.keys(prompts).sort()).toEqual(
      [
        "analyze-sprint-risk",
        "explain-task-complexity",
        "generate-release-notes",
        "review-prd",
        "suggest-issue-labels",
        "triage-issue",
      ].sort()
    );
  });

  describe("review-prd", () => {
    it("returns two user messages, the second carrying the sanitized PRD content", () => {
      const { callback } = getPrompt("review-prd");
      const result = callback({ prdContent: "Build a login page with OAuth." });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.type).toBe("text");
      expect(result.messages[1].role).toBe("user");
      expect(result.messages[1].content.text).toContain("Build a login page with OAuth.");
      expect(result.messages[1].content.text).toContain("Here is the PRD to review:");
    });

    it("sanitizes prdContent via InputSanitizer.sanitizePRDContent before interpolating it", () => {
      const spy = vi.spyOn(InputSanitizer, "sanitizePRDContent");
      const { callback } = getPrompt("review-prd");

      const result = callback({ prdContent: "line1\x00\x07line2  " });

      expect(spy).toHaveBeenCalledWith("line1\x00\x07line2  ");
      expect(result.messages[1].content.text).not.toMatch(/[\x00-\x08]/);
    });

    it("enforces prdContent as a required argument", () => {
      const { config } = getPrompt("review-prd");
      expect(() => config.argsSchema!.parse({})).toThrow();
      expect(() => config.argsSchema!.parse({ prdContent: "ok" })).not.toThrow();
    });
  });

  describe("explain-task-complexity", () => {
    it("returns messages with the task title and description", () => {
      const { callback } = getPrompt("explain-task-complexity");
      const result = callback({ taskTitle: "Add retry logic", taskDescription: "Retry failed webhooks" });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[1].content.text).toContain("Task: Add retry logic");
      expect(result.messages[1].content.text).toContain("Retry failed webhooks");
    });

    it("defaults the description to '(none provided)' when omitted, sanitizing via sanitizeTaskContent", () => {
      const spy = vi.spyOn(InputSanitizer, "sanitizeTaskContent");
      const { callback } = getPrompt("explain-task-complexity");

      const result = callback({ taskTitle: "Add retry logic" });

      expect(spy).toHaveBeenCalledWith("Add retry logic");
      expect(result.messages[1].content.text).toContain("Description:\n(none provided)");
    });

    it("enforces taskTitle as required while taskDescription stays optional", () => {
      const { config } = getPrompt("explain-task-complexity");
      expect(() => config.argsSchema!.parse({})).toThrow();
      expect(() => config.argsSchema!.parse({ taskTitle: "x" })).not.toThrow();
    });
  });

  describe("suggest-issue-labels", () => {
    it("returns messages with the issue title and description", () => {
      const { callback } = getPrompt("suggest-issue-labels");
      const result = callback({ issueTitle: "Crash on save", issueDescription: "Null pointer in save handler" });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[1].content.text).toContain("Issue title: Crash on save");
      expect(result.messages[1].content.text).toContain("Null pointer in save handler");
    });

    it("sanitizes issueTitle/issueDescription via InputSanitizer.sanitizeIssueContent", () => {
      const spy = vi.spyOn(InputSanitizer, "sanitizeIssueContent");
      const { callback } = getPrompt("suggest-issue-labels");

      callback({ issueTitle: "Crash on save", issueDescription: "boom" });

      expect(spy).toHaveBeenCalledWith("Crash on save");
      expect(spy).toHaveBeenCalledWith("boom");
    });

    it("enforces issueTitle as a required argument", () => {
      const { config } = getPrompt("suggest-issue-labels");
      expect(() => config.argsSchema!.parse({})).toThrow();
      expect(() => config.argsSchema!.parse({ issueTitle: "x" })).not.toThrow();
    });
  });

  describe("analyze-sprint-risk", () => {
    it("returns messages including provided issueCount and teamSize", () => {
      const { callback } = getPrompt("analyze-sprint-risk");
      const result = callback({ sprintGoals: "Ship checkout redesign", issueCount: 12, teamSize: 4 });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[1].content.text).toContain("Sprint goals:\nShip checkout redesign");
      expect(result.messages[1].content.text).toContain("Planned issue count: 12");
      expect(result.messages[1].content.text).toContain("Team size: 4");
    });

    it("reports 'not provided' for omitted issueCount/teamSize and sanitizes sprintGoals via sanitizeText", () => {
      const spy = vi.spyOn(InputSanitizer, "sanitizeText");
      const { callback } = getPrompt("analyze-sprint-risk");

      const result = callback({ sprintGoals: "Ship checkout redesign" });

      expect(spy).toHaveBeenCalledWith("Ship checkout redesign", InputSanitizer.MAX_ISSUE_CONTENT_LENGTH);
      expect(result.messages[1].content.text).toContain("Planned issue count: not provided");
      expect(result.messages[1].content.text).toContain("Team size: not provided");
    });

    it("enforces sprintGoals as required and coerces issueCount/teamSize strings to numbers", () => {
      const { config } = getPrompt("analyze-sprint-risk");
      expect(() => config.argsSchema!.parse({})).toThrow();
      const parsed = config.argsSchema!.parse({ sprintGoals: "g", issueCount: "5", teamSize: "2" });
      expect(parsed).toMatchObject({ issueCount: 5, teamSize: 2 });
    });
  });

  describe("generate-release-notes", () => {
    it("instructs the model to include a highlights section when includeMetrics is 'true'", () => {
      const { callback } = getPrompt("generate-release-notes");
      const result = callback({ milestone: "v2.0: perf + bugfixes", includeMetrics: "true" });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content.text).toContain("Highlights");
      expect(result.messages[1].content.text).toContain("Milestone information:");
      expect(result.messages[1].content.text).toContain("v2.0: perf + bugfixes");
    });

    it("omits the highlights instruction when includeMetrics is unset, sanitizing milestone via sanitizeText", () => {
      const spy = vi.spyOn(InputSanitizer, "sanitizeText");
      const { callback } = getPrompt("generate-release-notes");

      const result = callback({ milestone: "v2.0: perf + bugfixes" });

      expect(spy).toHaveBeenCalledWith("v2.0: perf + bugfixes", InputSanitizer.MAX_ISSUE_CONTENT_LENGTH);
      expect(result.messages[0].content.text).toContain("Do not add a metrics section.");
    });

    it("enforces milestone as required and rejects an invalid includeMetrics value", () => {
      const { config } = getPrompt("generate-release-notes");
      expect(() => config.argsSchema!.parse({})).toThrow();
      expect(() => config.argsSchema!.parse({ milestone: "m", includeMetrics: "yes" })).toThrow();
      expect(() => config.argsSchema!.parse({ milestone: "m", includeMetrics: "true" })).not.toThrow();
    });
  });

  describe("triage-issue", () => {
    it("returns messages with issue title, description, and comma-joined existing labels", () => {
      const { callback } = getPrompt("triage-issue");
      const result = callback({
        issueTitle: "Login fails on Safari",
        issueDescription: "Session cookie not set",
        existingLabels: "bug, ui , ",
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[1].content.text).toContain("Issue title: Login fails on Safari");
      expect(result.messages[1].content.text).toContain("Session cookie not set");
      expect(result.messages[1].content.text).toContain("Existing repository labels: bug, ui");
    });

    it("defaults existingLabels to '(none provided)' and sanitizes title/description via sanitizeIssueContent", () => {
      const spy = vi.spyOn(InputSanitizer, "sanitizeIssueContent");
      const { callback } = getPrompt("triage-issue");

      const result = callback({ issueTitle: "Login fails on Safari" });

      expect(spy).toHaveBeenCalledWith("Login fails on Safari");
      expect(result.messages[1].content.text).toContain("Existing repository labels: (none provided)");
    });

    it("enforces issueTitle as required while issueDescription/existingLabels stay optional", () => {
      const { config } = getPrompt("triage-issue");
      expect(() => config.argsSchema!.parse({})).toThrow();
      expect(() => config.argsSchema!.parse({ issueTitle: "x" })).not.toThrow();
    });
  });
});
