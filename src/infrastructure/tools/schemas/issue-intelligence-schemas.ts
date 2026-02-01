/**
 * Zod Schemas for Issue Intelligence AI MCP Tools
 *
 * This module defines input and output schemas for Phase 11 AI Issue
 * Intelligence MCP tools:
 *
 * Issue Intelligence Tools (AI-17 to AI-20):
 * - enrich_issue (AI-17)
 * - suggest_labels (AI-18)
 * - detect_duplicates (AI-19)
 * - find_related_issues (AI-20)
 */

import { z } from "zod";
import { SectionConfidenceSchema } from "../../../domain/ai-types";

// ============================================================================
// Common Schemas (Reused across multiple tools)
// ============================================================================

/**
 * Schema for issue state.
 */
export const IssueStateSchema = z.enum(["open", "closed"]);

export type IssueState = z.infer<typeof IssueStateSchema>;

/**
 * Schema for basic issue input.
 */
export const IssueInputSchema = z.object({
  /** Unique identifier for the issue */
  id: z.string().min(1, "Issue ID is required"),
  /** Issue number in the repository */
  number: z.number().int().positive("Issue number must be positive"),
  /** Issue title */
  title: z.string().min(1, "Issue title is required"),
  /** Issue body/description */
  body: z.string(),
  /** Labels assigned to the issue */
  labels: z.array(z.string()),
  /** Issue state */
  state: IssueStateSchema,
  /** Creation timestamp (ISO string) */
  createdAt: z.string(),
  /** Last update timestamp (ISO string) */
  updatedAt: z.string().optional(),
});

export type IssueInput = z.infer<typeof IssueInputSchema>;

/**
 * Schema for repository label.
 */
export const RepositoryLabelSchema = z.object({
  /** Label name */
  name: z.string().min(1, "Label name is required"),
  /** Optional description of the label */
  description: z.string().optional(),
  /** Optional color (hex without #) */
  color: z.string().optional(),
});

export type RepositoryLabel = z.infer<typeof RepositoryLabelSchema>;

/**
 * Schema for repository context.
 */
export const RepositoryContextSchema = z.object({
  /** Repository owner */
  owner: z.string().min(1, "Repository owner is required"),
  /** Repository name */
  repo: z.string().min(1, "Repository name is required"),
  /** Available labels in the repository */
  labels: z.array(RepositoryLabelSchema),
});

export type RepositoryContext = z.infer<typeof RepositoryContextSchema>;

/**
 * Schema for confidence tier output.
 */
export const ConfidenceTierOutputSchema = z.object({
  /** Confidence tier */
  tier: z.enum(["high", "medium", "low"]),
  /** Confidence score (0-1) */
  score: z.number().min(0).max(1),
});

export type ConfidenceTierOutput = z.infer<typeof ConfidenceTierOutputSchema>;

// ============================================================================
// Enrich Issue Schemas (AI-17)
// ============================================================================

/**
 * Schema for enriched section.
 */
export const EnrichedSectionSchema = z.object({
  /** The enriched content for this section */
  content: z.string(),
  /** Confidence score for this section (0-100) */
  confidence: z.number().min(0).max(100),
});

export type EnrichedSection = z.infer<typeof EnrichedSectionSchema>;

/**
 * Schema for enriched issue sections.
 */
export const EnrichedIssueSectionsSchema = z.object({
  /** Problem statement section */
  problem: EnrichedSectionSchema.optional(),
  /** Proposed solution section */
  solution: EnrichedSectionSchema.optional(),
  /** Additional context section */
  context: EnrichedSectionSchema.optional(),
  /** Impact assessment section */
  impact: EnrichedSectionSchema.optional(),
  /** Acceptance criteria section */
  acceptanceCriteria: EnrichedSectionSchema.optional(),
});

export type EnrichedIssueSections = z.infer<typeof EnrichedIssueSectionsSchema>;

/**
 * Input schema for enrich_issue tool (AI-17).
 */
export const EnrichIssueInputSchema = z.object({
  /** Issue title to enrich */
  issueTitle: z.string().min(1, "Issue title is required"),
  /** Issue description (can be empty for sparse issues) */
  issueDescription: z.string().describe("Issue body/description, can be empty"),
  /** Optional project context for better enrichment */
  projectContext: z.string().optional().describe("Project description or context"),
  /** Optional repository labels for label suggestions */
  repositoryLabels: z
    .array(RepositoryLabelSchema)
    .optional()
    .describe("Available labels in the repository"),
});

export type EnrichIssueInput = z.infer<typeof EnrichIssueInputSchema>;

/**
 * Output schema for enrich_issue tool (AI-17).
 */
export const EnrichIssueOutputSchema = z.object({
  /** Original issue title and body */
  original: z.object({
    title: z.string(),
    body: z.string(),
  }),
  /** Whether to preserve the original body alongside enriched content */
  preserveOriginal: z.boolean(),
  /** The fully enriched body text */
  enrichedBody: z.string(),
  /** Structured sections extracted/generated */
  sections: EnrichedIssueSectionsSchema,
  /** Suggested labels based on content analysis */
  suggestedLabels: z.array(z.string()),
  /** Suggested assignees based on content analysis */
  suggestedAssignees: z.array(z.string()).optional(),
  /** Overall confidence in the enrichment */
  overallConfidence: SectionConfidenceSchema,
});

export type EnrichIssueOutput = z.infer<typeof EnrichIssueOutputSchema>;

// ============================================================================
// Suggest Labels Schemas (AI-18)
// ============================================================================

/**
 * Schema for issue history item (for pattern learning).
 */
export const IssueHistoryItemSchema = z.object({
  /** Labels that were applied */
  labels: z.array(z.string()),
  /** Issue title for pattern matching */
  title: z.string(),
});

export type IssueHistoryItem = z.infer<typeof IssueHistoryItemSchema>;

/**
 * Schema for label suggestion configuration.
 */
export const LabelSuggestionConfigSchema = z.object({
  /** Prefer existing labels over new proposals */
  preferExisting: z.boolean().optional().default(true),
  /** Maximum number of suggestions to return */
  maxSuggestions: z.number().int().positive().optional().default(10),
  /** Whether to include new label proposals */
  includeNewProposals: z.boolean().optional().default(true),
});

export type LabelSuggestionConfig = z.infer<typeof LabelSuggestionConfigSchema>;

/**
 * Input schema for suggest_labels tool (AI-18).
 */
export const SuggestLabelsInputSchema = z.object({
  /** Issue title for analysis */
  issueTitle: z.string().min(1, "Issue title is required"),
  /** Issue description for analysis */
  issueDescription: z.string().describe("Issue body/description"),
  /** Existing labels in the repository */
  existingLabels: z.array(RepositoryLabelSchema).describe("Available labels in the repository"),
  /** Optional issue history for pattern learning */
  issueHistory: z
    .array(IssueHistoryItemSchema)
    .optional()
    .describe("Historical issues with labels for pattern learning"),
  /** Optional configuration */
  config: LabelSuggestionConfigSchema.optional(),
});

export type SuggestLabelsInput = z.infer<typeof SuggestLabelsInputSchema>;

/**
 * Schema for a label suggestion with rationale.
 */
export const LabelSuggestionSchema = z.object({
  /** Label name */
  label: z.string(),
  /** Whether this label already exists in the repository */
  isExisting: z.boolean(),
  /** Confidence score (0-1) */
  confidence: z.number().min(0).max(1),
  /** Explanation for why this label is suggested */
  rationale: z.string(),
  /** Patterns in the issue that matched this label */
  matchedPatterns: z.array(z.string()),
});

export type LabelSuggestion = z.infer<typeof LabelSuggestionSchema>;

/**
 * Schema for new label proposal.
 */
export const NewLabelProposalSchema = z.object({
  /** Proposed label name */
  name: z.string().min(1),
  /** Description for the new label */
  description: z.string(),
  /** Suggested color (hex without #) */
  color: z.string().regex(/^[0-9A-Fa-f]{6}$/, "Color must be a 6-character hex string"),
  /** Rationale for creating this new label */
  rationale: z.string(),
});

export type NewLabelProposal = z.infer<typeof NewLabelProposalSchema>;

/**
 * Output schema for suggest_labels tool (AI-18).
 */
export const SuggestLabelsOutputSchema = z.object({
  /** High confidence suggestions (>= high threshold) */
  high: z.array(LabelSuggestionSchema),
  /** Medium confidence suggestions (>= medium threshold, < high threshold) */
  medium: z.array(LabelSuggestionSchema),
  /** Low confidence suggestions (< medium threshold) */
  low: z.array(LabelSuggestionSchema),
  /** Proposals for new labels not in repository */
  newLabelProposals: z.array(NewLabelProposalSchema).optional(),
  /** Overall confidence in suggestions */
  confidence: SectionConfidenceSchema,
});

export type SuggestLabelsOutput = z.infer<typeof SuggestLabelsOutputSchema>;

// ============================================================================
// Detect Duplicates Schemas (AI-19)
// ============================================================================

/**
 * Schema for existing issue in duplicate detection.
 */
export const ExistingIssueSchema = z.object({
  /** Issue ID */
  id: z.string(),
  /** Issue number */
  number: z.number().int().positive(),
  /** Issue title */
  title: z.string(),
  /** Issue body */
  body: z.string(),
  /** Issue state */
  state: IssueStateSchema,
});

export type ExistingIssue = z.infer<typeof ExistingIssueSchema>;

/**
 * Schema for duplicate detection thresholds.
 */
export const DuplicateThresholdsSchema = z.object({
  /** Threshold for high confidence duplicates (default 0.92) */
  high: z.number().min(0).max(1).optional().default(0.92),
  /** Threshold for medium confidence duplicates (default 0.75) */
  medium: z.number().min(0).max(1).optional().default(0.75),
});

export type DuplicateThresholds = z.infer<typeof DuplicateThresholdsSchema>;

/**
 * Input schema for detect_duplicates tool (AI-19).
 */
export const DetectDuplicatesInputSchema = z.object({
  /** Issue title to check for duplicates */
  issueTitle: z.string().min(1, "Issue title is required"),
  /** Issue description to check for duplicates */
  issueDescription: z.string().describe("Issue body/description"),
  /** Existing issues to compare against */
  existingIssues: z
    .array(ExistingIssueSchema)
    .describe("Issues to compare against for duplicate detection"),
  /** Optional thresholds for confidence tiers */
  thresholds: DuplicateThresholdsSchema.optional(),
  /** Maximum number of results to return */
  maxResults: z.number().int().positive().optional().default(10),
});

export type DetectDuplicatesInput = z.infer<typeof DetectDuplicatesInputSchema>;

/**
 * Schema for a duplicate candidate.
 */
export const DuplicateCandidateSchema = z.object({
  /** Issue ID of the potential duplicate */
  issueId: z.string(),
  /** Issue number of the potential duplicate */
  issueNumber: z.number().int().positive(),
  /** Title of the potential duplicate */
  title: z.string(),
  /** Similarity score (0-1) */
  similarity: z.number().min(0).max(1),
  /** Explanation of why this is considered a duplicate */
  reasoning: z.string(),
});

export type DuplicateCandidate = z.infer<typeof DuplicateCandidateSchema>;

/**
 * Output schema for detect_duplicates tool (AI-19).
 */
export const DetectDuplicatesOutputSchema = z.object({
  /** High confidence duplicates (auto-linkable) */
  highConfidence: z.array(DuplicateCandidateSchema),
  /** Medium confidence duplicates (review recommended) */
  mediumConfidence: z.array(DuplicateCandidateSchema),
  /** Low confidence duplicates (possible but uncertain) */
  lowConfidence: z.array(DuplicateCandidateSchema),
  /** Overall confidence in detection */
  confidence: SectionConfidenceSchema,
});

export type DetectDuplicatesOutput = z.infer<typeof DetectDuplicatesOutputSchema>;

// ============================================================================
// Find Related Issues Schemas (AI-20)
// ============================================================================

/**
 * Schema for relationship types.
 */
export const RelationshipTypeSchema = z.enum(["semantic", "dependency", "component"]);

export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

/**
 * Schema for dependency sub-types.
 */
export const DependencySubTypeSchema = z.enum(["blocks", "blocked_by", "related_to"]);

export type DependencySubType = z.infer<typeof DependencySubTypeSchema>;

/**
 * Schema for repository issue (for related issue search).
 */
export const RepositoryIssueSchema = z.object({
  /** Issue ID */
  id: z.string(),
  /** Issue number */
  number: z.number().int().positive(),
  /** Issue title */
  title: z.string(),
  /** Issue body */
  body: z.string(),
  /** Issue labels */
  labels: z.array(z.string()),
  /** Issue state */
  state: IssueStateSchema,
});

export type RepositoryIssue = z.infer<typeof RepositoryIssueSchema>;

/**
 * Schema for related issue linking configuration.
 */
export const RelatedIssueLinkingConfigSchema = z.object({
  /** Include semantic similarity-based relationships */
  includeSemanticSimilarity: z.boolean().optional().default(true),
  /** Include dependency relationships (blocks/blocked_by) */
  includeDependencies: z.boolean().optional().default(true),
  /** Include component/area grouping relationships */
  includeComponentGrouping: z.boolean().optional().default(true),
});

export type RelatedIssueLinkingConfig = z.infer<typeof RelatedIssueLinkingConfigSchema>;

/**
 * Input schema for find_related_issues tool (AI-20).
 */
export const FindRelatedIssuesInputSchema = z.object({
  /** ID of the issue to find related issues for */
  issueId: z.string().min(1, "Issue ID is required"),
  /** Issue title for analysis */
  issueTitle: z.string().min(1, "Issue title is required"),
  /** Issue description for analysis */
  issueDescription: z.string().describe("Issue body/description"),
  /** Optional issue labels for component grouping */
  issueLabels: z.array(z.string()).optional(),
  /** Repository issues to search for relationships */
  repositoryIssues: z
    .array(RepositoryIssueSchema)
    .describe("Issues to search for relationships"),
  /** Optional configuration for relationship types */
  config: RelatedIssueLinkingConfigSchema.optional(),
});

export type FindRelatedIssuesInput = z.infer<typeof FindRelatedIssuesInputSchema>;

/**
 * Schema for an issue relationship.
 */
export const IssueRelationshipSchema = z.object({
  /** Source issue ID (the issue being analyzed) */
  sourceIssueId: z.string(),
  /** Target issue ID */
  targetIssueId: z.string(),
  /** Target issue number */
  targetIssueNumber: z.number().int().positive(),
  /** Target issue title */
  targetIssueTitle: z.string(),
  /** Type of relationship */
  relationshipType: RelationshipTypeSchema,
  /** Sub-type for dependency relationships */
  subType: DependencySubTypeSchema.optional(),
  /** Confidence in this relationship (0-1) */
  confidence: z.number().min(0).max(1),
  /** Explanation of the relationship */
  reasoning: z.string(),
});

export type IssueRelationship = z.infer<typeof IssueRelationshipSchema>;

/**
 * Output schema for find_related_issues tool (AI-20).
 */
export const FindRelatedIssuesOutputSchema = z.object({
  /** Found relationships */
  relationships: z.array(IssueRelationshipSchema),
  /** Overall confidence in analysis */
  confidence: SectionConfidenceSchema,
});

export type FindRelatedIssuesOutput = z.infer<typeof FindRelatedIssuesOutputSchema>;
