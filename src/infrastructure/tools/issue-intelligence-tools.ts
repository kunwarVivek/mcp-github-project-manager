/**
 * MCP tools for AI-powered issue intelligence operations.
 *
 * Provides 4 tools (AI-17 to AI-20):
 * - enrich_issue_sections: Enhance issue with structured sections and confidence (AI-17)
 * - suggest_labels: Multi-tier label suggestions with rationale (AI-18)
 * - detect_duplicates: Embedding-based duplicate detection (AI-19)
 * - find_related_issues: Multi-type relationship detection (AI-20)
 *
 * The AI-17 tool is named `enrich_issue_sections`, not `enrich_issue`:
 * `enrich_issue` already belongs to the label/priority/complexity enrichment
 * in `schemas/ai-automation-tool-schemas.ts`, and the compound action
 * `ai_analyze.enrich_issue` routes to that implementation. Two different
 * features shared one name and the registry silently overwrote one of them,
 * which left the AI-17 implementation unreachable at runtime.
 *
 * These tools expose Phase 11 AI Issue Intelligence services as MCP tools
 * with proper annotations, input/output schemas, and executors.
 */

import { DuplicateDetectionService } from "../../services/ai/DuplicateDetectionService";
import { IssueEnrichmentAIService } from "../../services/ai/IssueEnrichmentAIService";
import { LabelSuggestionService } from "../../services/ai/LabelSuggestionService";
import { RelatedIssueLinkingService } from "../../services/ai/RelatedIssueLinkingService";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations";
import { requireArray } from "./input-validation";
import {
  type DetectDuplicatesInput,
  DetectDuplicatesInputSchema,
  type DetectDuplicatesOutput,
  DetectDuplicatesOutputSchema,
  type EnrichIssueInput,
  EnrichIssueInputSchema,
  type EnrichIssueOutput,
  EnrichIssueOutputSchema,
  type FindRelatedIssuesInput,
  FindRelatedIssuesInputSchema,
  type FindRelatedIssuesOutput,
  FindRelatedIssuesOutputSchema,
  type SuggestLabelsInput,
  SuggestLabelsInputSchema,
  type SuggestLabelsOutput,
  SuggestLabelsOutputSchema,
} from "./schemas/issue-intelligence-schemas";
import type { ToolDefinition, ToolSchema } from "./ToolValidator";

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * enrich_issue - AI-17: Issue enrichment with structured sections
 *
 * Enhance issues with structured sections (Problem/Solution/Context/Impact/
 * AcceptanceCriteria), per-section confidence scores, and suggested labels.
 * Preserves original content when substantial (>200 chars).
 */
export const enrichIssueTool: ToolDefinition<EnrichIssueInput, EnrichIssueOutput> = {
  name: "enrich_issue_sections",
  title: "Enrich Issue",
  description:
    "Enhance issue with structured sections (Problem/Solution/Context/Impact/AcceptanceCriteria), " +
    "per-section confidence scores, and suggested labels. Preserves original content when substantial.",
  annotations: ANNOTATION_PATTERNS.aiOperation,
  schema: EnrichIssueInputSchema as unknown as ToolSchema<EnrichIssueInput>,
  outputSchema: EnrichIssueOutputSchema,
};

/**
 * suggest_labels - AI-18: Multi-tier label suggestions
 *
 * Suggest labels for an issue with tiered confidence (high/medium/low),
 * rationale for each suggestion, and optional new label proposals.
 * Prefers existing repository labels.
 */
export const suggestLabelsTool: ToolDefinition<SuggestLabelsInput, SuggestLabelsOutput> = {
  name: "suggest_labels",
  title: "Suggest Labels",
  description:
    "Suggest labels for an issue with tiered confidence (high/medium/low), rationale for each suggestion, " +
    "and optional new label proposals. Prefers existing repository labels.",
  annotations: ANNOTATION_PATTERNS.aiOperation,
  schema: SuggestLabelsInputSchema as unknown as ToolSchema<SuggestLabelsInput>,
  outputSchema: SuggestLabelsOutputSchema,
};

/**
 * detect_duplicates - AI-19: Embedding-based duplicate detection
 *
 * Detect potential duplicate issues using semantic similarity (embeddings).
 * Results tiered: high confidence (0.92+) for auto-link, medium (0.75-0.92)
 * for review, low for reference.
 */
export const detectDuplicatesTool: ToolDefinition<DetectDuplicatesInput, DetectDuplicatesOutput> = {
  name: "detect_duplicates",
  title: "Detect Duplicate Issues",
  description:
    "Detect potential duplicate issues using semantic similarity (embeddings). " +
    "Results tiered: high confidence (0.92+) for auto-link, medium (0.75-0.92) for review, low for reference.",
  annotations: ANNOTATION_PATTERNS.aiOperation,
  schema: DetectDuplicatesInputSchema as unknown as ToolSchema<DetectDuplicatesInput>,
  outputSchema: DetectDuplicatesOutputSchema,
};

/**
 * find_related_issues - AI-20: Multi-type relationship detection
 *
 * Find related issues by semantic similarity, dependency chains (blocks/blocked-by),
 * and component grouping (shared labels). Returns relationships with confidence
 * and reasoning.
 */
export const findRelatedIssuesTool: ToolDefinition<
  FindRelatedIssuesInput,
  FindRelatedIssuesOutput
> = {
  name: "find_related_issues",
  title: "Find Related Issues",
  description:
    "Find related issues by semantic similarity, dependency chains (blocks/blocked-by), " +
    "and component grouping (shared labels). Returns relationships with confidence and reasoning.",
  annotations: ANNOTATION_PATTERNS.aiOperation,
  schema: FindRelatedIssuesInputSchema as unknown as ToolSchema<FindRelatedIssuesInput>,
  outputSchema: FindRelatedIssuesOutputSchema,
};

// ============================================================================
// Tool Executors
// ============================================================================

/**
 * Execute enrich_issue tool (AI-17).
 *
 * @param args - Issue enrichment input parameters
 * @returns Enriched issue with structured sections and confidence
 */
export async function executeEnrichIssue(args: EnrichIssueInput): Promise<EnrichIssueOutput> {
  const service = new IssueEnrichmentAIService();

  const result = await service.enrichIssue({
    issueTitle: args.issueTitle,
    issueDescription: args.issueDescription,
    projectContext: args.projectContext,
    repositoryLabels: args.repositoryLabels?.map((l) => l.name),
  });

  return result;
}

/**
 * Execute suggest_labels tool (AI-18).
 *
 * @param args - Label suggestion input parameters
 * @returns Label suggestions grouped by confidence tier
 */
export async function executeSuggestLabels(args: SuggestLabelsInput): Promise<SuggestLabelsOutput> {
  const config = args.config
    ? {
        preferExisting: args.config.preferExisting,
        maxSuggestions: args.config.maxSuggestions,
        includeNewProposals: args.config.includeNewProposals,
      }
    : undefined;

  const service = new LabelSuggestionService(undefined, config);

  const result = await service.suggestLabels({
    issueTitle: args.issueTitle,
    issueDescription: args.issueDescription,
    existingLabels: requireArray(args.existingLabels, "existingLabels", "suggest_labels").map(
      (l) => ({
        name: l.name,
        description: l.description,
        color: l.color,
      })
    ),
    issueHistory: args.issueHistory?.map((h) => ({
      labels: h.labels,
      title: h.title,
    })),
  });

  return result;
}

/**
 * Execute detect_duplicates tool (AI-19).
 *
 * @param args - Duplicate detection input parameters
 * @returns Tiered duplicate candidates with confidence
 */
export async function executeDetectDuplicates(
  args: DetectDuplicatesInput
): Promise<DetectDuplicatesOutput> {
  const thresholds = args.thresholds
    ? {
        high: args.thresholds.high,
        medium: args.thresholds.medium,
      }
    : undefined;

  const service = new DuplicateDetectionService(thresholds);

  const result = await service.detectDuplicates({
    issueTitle: args.issueTitle,
    issueDescription: args.issueDescription,
    existingIssues: requireArray(args.existingIssues, "existingIssues", "detect_duplicates").map(
      (issue) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        labels: [],
        state: issue.state,
        createdAt: new Date().toISOString(),
      })
    ),
    maxResults: args.maxResults,
  });

  return result;
}

/**
 * Execute find_related_issues tool (AI-20).
 *
 * @param args - Related issues input parameters
 * @returns Related issues with relationship types and confidence
 */
export async function executeFindRelatedIssues(
  args: FindRelatedIssuesInput
): Promise<FindRelatedIssuesOutput> {
  // The compound schema names this field `relationConfig`; the granular one
  // calls it `config`. Accept both, or the relation settings are silently
  // dropped.
  const relationConfig =
    (args as { relationConfig?: typeof args.config }).relationConfig ?? args.config;
  const config = relationConfig
    ? {
        includeSemanticSimilarity: relationConfig.includeSemanticSimilarity,
        includeDependencies: relationConfig.includeDependencies,
        includeComponentGrouping: relationConfig.includeComponentGrouping,
      }
    : undefined;

  const service = new RelatedIssueLinkingService(undefined, config);

  const result = await service.findRelatedIssues({
    issueId: args.issueId,
    issueTitle: args.issueTitle,
    issueDescription: args.issueDescription,
    issueLabels: args.issueLabels,
    repositoryIssues: requireArray(args.repositoryIssues, "repositoryIssues", "find_related").map(
      (issue) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        labels: issue.labels,
        state: issue.state,
        createdAt: new Date().toISOString(),
      })
    ),
  });

  return result;
}

// ============================================================================
// Export all tools for registration
// ============================================================================

/**
 * All issue intelligence AI tool definitions for registration in ToolRegistry.
 */
export const issueIntelligenceTools: ToolDefinition<unknown>[] = [
  enrichIssueTool as ToolDefinition<unknown>,
  suggestLabelsTool as ToolDefinition<unknown>,
  detectDuplicatesTool as ToolDefinition<unknown>,
  findRelatedIssuesTool as ToolDefinition<unknown>,
];
