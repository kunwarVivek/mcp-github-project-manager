import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { InputSanitizer } from "../../services/utils/InputSanitizer";

/**
 * Reusable MCP prompt templates.
 *
 * Every prompt here is a self-contained template: it formats its arguments
 * into an AI-ready message sequence and returns it. None call the GitHub API
 * or any service — that's the executor tools' job (see
 * `infrastructure/tools/`). All user-supplied text is run through
 * {@link InputSanitizer} before being interpolated into prompt text, exactly
 * as the AI-facing services under `services/` already do.
 *
 * `PromptMessage.role` is constrained by the MCP protocol to `"user" |
 * "assistant"` — there is no wire-level "system" role. Prompts that need a
 * system-style framing message send it as a leading `user` message
 * (instructions/criteria), followed by a second `user` message carrying the
 * actual data to act on.
 */

/** Formats an optional field for display, sanitizing it when present. */
function describeOptional(value: string | undefined, sanitize: (v: string) => string): string {
  if (!value) return "(none provided)";
  const sanitized = sanitize(value);
  return sanitized || "(none provided)";
}

function registerReviewPrd(server: McpServer): void {
  server.registerPrompt(
    "review-prd",
    {
      title: "Review PRD",
      description:
        "Ask the AI to review a Product Requirements Document for clarity, completeness, and quality.",
      argsSchema: z.object({
        prdContent: z.string().describe("The full text of the PRD to review."),
      }),
    },
    ({ prdContent }) => {
      const sanitizedPrd = InputSanitizer.sanitizePRDContent(prdContent);
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                "You are a senior product manager reviewing a Product Requirements Document (PRD)",
                "before it moves into planning. Evaluate it against these criteria, scoring each 1-5",
                "with a one-line justification:",
                "",
                "1. Clarity — is the problem statement and goal unambiguous?",
                "2. Completeness — are user stories, acceptance criteria, and success metrics present?",
                "3. Feasibility — is the scope realistic and are constraints well understood?",
                "4. Testability — can every requirement be verified objectively?",
                "5. Risks & dependencies — are they identified along with mitigations?",
                "6. Scope boundaries — is what's explicitly out of scope stated?",
                "",
                "After scoring, list concrete, actionable revisions ordered by priority, then close",
                "with an overall verdict of Ready, Needs Revisions, or Not Ready.",
              ].join("\n"),
            },
          },
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Here is the PRD to review:\n\n${sanitizedPrd}`,
            },
          },
        ],
      };
    }
  );
}

function registerExplainTaskComplexity(server: McpServer): void {
  server.registerPrompt(
    "explain-task-complexity",
    {
      title: "Explain Task Complexity",
      description: "Ask the AI to analyze and explain the complexity of a task.",
      argsSchema: z.object({
        taskTitle: z.string().describe("The task's title."),
        taskDescription: z.string().optional().describe("The task's description, if available."),
      }),
    },
    ({ taskTitle, taskDescription }) => {
      const sanitizedTitle = InputSanitizer.sanitizeTaskContent(taskTitle);
      const sanitizedDescription = describeOptional(taskDescription, (v) =>
        InputSanitizer.sanitizeTaskContent(v)
      );
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                "You are a technical lead assessing the complexity of an engineering task. Consider:",
                "scope and size, technical difficulty and unknowns, dependencies on other work,",
                "required skills/expertise, risk of scope creep, and testing burden.",
                "",
                "Respond with: a complexity rating (Trivial / Small / Medium / Large / X-Large, plus a",
                "1-13 Fibonacci story-point estimate), a short rationale, the key risks, and — if the",
                "task looks oversized — concrete suggestions for splitting it into smaller tasks.",
              ].join("\n"),
            },
          },
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Task: ${sanitizedTitle}\n\nDescription:\n${sanitizedDescription}`,
            },
          },
        ],
      };
    }
  );
}

function registerSuggestIssueLabels(server: McpServer): void {
  server.registerPrompt(
    "suggest-issue-labels",
    {
      title: "Suggest Issue Labels",
      description: "Ask the AI to suggest appropriate labels for a GitHub issue.",
      argsSchema: z.object({
        issueTitle: z.string().describe("The issue's title."),
        issueDescription: z.string().optional().describe("The issue's description/body, if available."),
      }),
    },
    ({ issueTitle, issueDescription }) => {
      const sanitizedTitle = InputSanitizer.sanitizeIssueContent(issueTitle);
      const sanitizedDescription = describeOptional(issueDescription, (v) =>
        InputSanitizer.sanitizeIssueContent(v)
      );
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                "You are triaging a new GitHub issue and must suggest labels for it. Consider standard",
                "categories: type (bug / feature / enhancement / documentation / question / chore),",
                "priority (critical / high / medium / low), size/effort, and area or component if it can",
                "be inferred from the content.",
                "",
                "Return a prioritized list of suggested labels, each with a one-line justification, and",
                "flag any suggestion you are not confident about.",
              ].join("\n"),
            },
          },
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Issue title: ${sanitizedTitle}\n\nIssue description:\n${sanitizedDescription}`,
            },
          },
        ],
      };
    }
  );
}

function registerAnalyzeSprintRisk(server: McpServer): void {
  server.registerPrompt(
    "analyze-sprint-risk",
    {
      title: "Analyze Sprint Risk",
      description: "Ask the AI to assess the risk profile of an upcoming sprint.",
      argsSchema: z.object({
        sprintGoals: z.string().describe("The sprint's goals, as free text."),
        issueCount: z.coerce
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Number of issues planned for the sprint, if known."),
        teamSize: z.coerce
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Number of engineers available for the sprint, if known."),
      }),
    },
    ({ sprintGoals, issueCount, teamSize }) => {
      const sanitizedGoals = InputSanitizer.sanitizeText(sprintGoals, InputSanitizer.MAX_ISSUE_CONTENT_LENGTH);
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                "You are a scrum master assessing sprint risk before the team commits. Analyze: scope",
                "risk (are the goals clear and well bounded?), capacity risk (planned load versus team",
                "size), dependency risk (external blockers, cross-team work), and unknowns.",
                "",
                "Rate each category Low / Medium / High, give an overall risk rating, and recommend 3-5",
                "concrete mitigations the team can apply before or during the sprint.",
              ].join("\n"),
            },
          },
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `Sprint goals:\n${sanitizedGoals}`,
                `Planned issue count: ${issueCount !== undefined ? issueCount : "not provided"}`,
                `Team size: ${teamSize !== undefined ? teamSize : "not provided"}`,
              ].join("\n\n"),
            },
          },
        ],
      };
    }
  );
}

function registerGenerateReleaseNotes(server: McpServer): void {
  server.registerPrompt(
    "generate-release-notes",
    {
      title: "Generate Release Notes",
      description: "Ask the AI to draft user-facing release notes from milestone information.",
      argsSchema: z.object({
        milestone: z
          .string()
          .describe("Milestone title/description and the issues or PRs it covers, as free text."),
        includeMetrics: z
          .enum(["true", "false"])
          .optional()
          .describe("Whether to include a metrics/highlights section. Defaults to false."),
      }),
    },
    ({ milestone, includeMetrics }) => {
      const sanitizedMilestone = InputSanitizer.sanitizeText(milestone, InputSanitizer.MAX_ISSUE_CONTENT_LENGTH);
      const wantsMetrics = includeMetrics === "true";
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                "You are writing user-facing release notes from the milestone information provided.",
                "Organize the notes into sections: New Features, Improvements, Bug Fixes, and Breaking",
                "Changes — omit any section with nothing to report. Use concise, user-facing language",
                "(not internal jargon), and preserve issue/PR references (e.g. #123) that appear in the",
                "source material.",
                wantsMetrics
                  ? "Finish with a 'Highlights' section summarizing scope using only numbers present in" +
                    " the source material — never fabricate metrics that aren't given."
                  : "Do not add a metrics section.",
              ].join("\n"),
            },
          },
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Milestone information:\n\n${sanitizedMilestone}`,
            },
          },
        ],
      };
    }
  );
}

function registerTriageIssue(server: McpServer): void {
  server.registerPrompt(
    "triage-issue",
    {
      title: "Triage Issue",
      description: "Ask the AI to perform first-pass triage on a new GitHub issue.",
      argsSchema: z.object({
        issueTitle: z.string().describe("The issue's title."),
        issueDescription: z.string().optional().describe("The issue's description/body, if available."),
        existingLabels: z
          .string()
          .optional()
          .describe("Comma-separated list of labels already available in the repository, if known."),
      }),
    },
    ({ issueTitle, issueDescription, existingLabels }) => {
      const sanitizedTitle = InputSanitizer.sanitizeIssueContent(issueTitle);
      const sanitizedDescription = describeOptional(issueDescription, (v) =>
        InputSanitizer.sanitizeIssueContent(v)
      );
      const sanitizedLabels = existingLabels
        ? existingLabels
            .split(",")
            .map((label) => InputSanitizer.sanitizeText(label.trim()))
            .filter((label) => label.length > 0)
            .join(", ")
        : "";
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                "You are performing first-pass triage on a new GitHub issue. Classify: issue type",
                "(bug / feature / question / documentation / chore), priority, and whether it looks like",
                "a duplicate of or related to existing work. Note any information that is missing before",
                "the issue can be actioned.",
                "",
                "Recommend labels: reuse an existing label whenever it fits, and only propose a new one",
                "when nothing existing applies — mark those clearly as 'new'.",
              ].join("\n"),
            },
          },
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `Issue title: ${sanitizedTitle}`,
                `Issue description:\n${sanitizedDescription}`,
                `Existing repository labels: ${sanitizedLabels || "(none provided)"}`,
              ].join("\n\n"),
            },
          },
        ],
      };
    }
  );
}

/** Registers all reusable prompt templates on the given server. */
export function registerPrompts(server: McpServer): void {
  registerReviewPrd(server);
  registerExplainTaskComplexity(server);
  registerSuggestIssueLabels(server);
  registerAnalyzeSprintRisk(server);
  registerGenerateReleaseNotes(server);
  registerTriageIssue(server);
}
