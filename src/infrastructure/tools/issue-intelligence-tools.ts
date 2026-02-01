/**
 * MCP tools for AI-powered issue intelligence operations.
 *
 * Provides 4 tools (AI-17 to AI-20):
 * - enrich_issue: Enhance issue with structured sections and confidence (AI-17)
 * - suggest_labels: Multi-tier label suggestions with rationale (AI-18)
 * - detect_duplicates: Embedding-based duplicate detection (AI-19)
 * - find_related_issues: Multi-type relationship detection (AI-20)
 *
 * These tools expose Phase 11 AI Issue Intelligence services as MCP tools
 * with proper annotations, input/output schemas, and executors.
 */

import { ToolDefinition, ToolSchema } from "./ToolValidator.js";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations.js";
import { IssueEnrichmentAIService } from "../../services/ai/IssueEnrichmentAIService.js";
import { LabelSuggestionService } from "../../services/ai/LabelSuggestionService.js";
import { DuplicateDetectionService } from "../../services/ai/DuplicateDetectionService.js";
import { RelatedIssueLinkingService } from "../../services/ai/RelatedIssueLinkingService.js";
import {
  EnrichIssueInputSchema,
  EnrichIssueInput,
  EnrichIssueOutputSchema,
  EnrichIssueOutput,
  SuggestLabelsInputSchema,
  SuggestLabelsInput,
  SuggestLabelsOutputSchema,
  SuggestLabelsOutput,
  DetectDuplicatesInputSchema,
  DetectDuplicatesInput,
  DetectDuplicatesOutputSchema,
  DetectDuplicatesOutput,
  FindRelatedIssuesInputSchema,
  FindRelatedIssuesInput,
  FindRelatedIssuesOutputSchema,
  FindRelatedIssuesOutput,
} from "./schemas/issue-intelligence-schemas.js";

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
  name: "enrich_issue",
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
export const findRelatedIssuesTool: ToolDefinition<FindRelatedIssuesInput, FindRelatedIssuesOutput> = {
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
export async function executeEnrichIssue(
  args: EnrichIssueInput
): Promise<EnrichIssueOutput> {
  const service = new IssueEnrichmentAIService();

  const result = await service.enrichIssue({
    issueTitle: args.issueTitle,
    issueDescription: args.issueDescription,
    projectContext: args.projectContext,
    repositoryLabels: args.repositoryLabels?.map(l => l.name),
  });

  return result;
}

/**
 * Execute suggest_labels tool (AI-18).
 *
 * @param args - Label suggestion input parameters
 * @returns Label suggestions grouped by confidence tier
 */
export async function executeSuggestLabels(
  args: SuggestLabelsInput
): Promise<SuggestLabelsOutput> {
  const config = args.config ? {
    preferExisting: args.config.preferExisting,
    maxSuggestions: args.config.maxSuggestions,
    includeNewProposals: args.config.includeNewProposals,
  } : undefined;

  const service = new LabelSuggestionService(config);

  const result = await service.suggestLabels({
    issueTitle: args.issueTitle,
    issueDescription: args.issueDescription,
    existingLabels: args.existingLabels.map(l => ({
      name: l.name,
      description: l.description,
      color: l.color,
    })),
    issueHistory: args.issueHistory?.map(h => ({
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
  const thresholds = args.thresholds ? {
    high: args.thresholds.high,
    medium: args.thresholds.medium,
  } : undefined;

  const service = new DuplicateDetectionService(thresholds);

  const result = await service.detectDuplicates({
    issueTitle: args.issueTitle,
    issueDescription: args.issueDescription,
    existingIssues: args.existingIssues.map(issue => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      labels: [],
      state: issue.state,
      createdAt: new Date().toISOString(),
    })),
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
  const config = args.config ? {
    includeSemanticSimilarity: args.config.includeSemanticSimilarity,
    includeDependencies: args.config.includeDependencies,
    includeComponentGrouping: args.config.includeComponentGrouping,
  } : undefined;

  const service = new RelatedIssueLinkingService(config);

  const result = await service.findRelatedIssues({
    issueId: args.issueId,
    issueTitle: args.issueTitle,
    issueDescription: args.issueDescription,
    issueLabels: args.issueLabels,
    repositoryIssues: args.repositoryIssues.map(issue => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      labels: issue.labels,
      state: issue.state,
      createdAt: new Date().toISOString(),
    })),
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

/**
 * Map of tool names to executor functions.
 */
export const issueIntelligenceExecutors: Record<string, (args: unknown) => Promise<unknown>> = {
  enrich_issue: executeEnrichIssue as (args: unknown) => Promise<unknown>,
  suggest_labels: executeSuggestLabels as (args: unknown) => Promise<unknown>,
  detect_duplicates: executeDetectDuplicates as (args: unknown) => Promise<unknown>,
  find_related_issues: executeFindRelatedIssues as (args: unknown) => Promise<unknown>,
};
