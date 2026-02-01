/**
 * Issue Intelligence Domain Types
 *
 * TypeScript interfaces for AI-powered issue management:
 * - AI-17: Issue enrichment with structured sections
 * - AI-18: Multi-tier label suggestions with rationale
 * - AI-19: Duplicate detection with similarity scoring
 * - AI-20: Related issue linking by relationship type
 */

import { SectionConfidence } from "./ai-types";

// ============================================================================
// Common Types
// ============================================================================

/**
 * Basic issue input for AI processing.
 */
export interface IssueInput {
  /** Unique identifier for the issue */
  id: string;
  /** Issue number in the repository */
  number: number;
  /** Issue title */
  title: string;
  /** Issue body/description */
  body: string;
  /** Labels assigned to the issue */
  labels: string[];
  /** Issue state */
  state: "open" | "closed";
  /** Creation timestamp (ISO string) */
  createdAt: string;
  /** Last update timestamp (ISO string) */
  updatedAt?: string;
}

/**
 * Repository label with optional metadata.
 */
export interface RepositoryLabel {
  /** Label name */
  name: string;
  /** Optional description of the label */
  description?: string;
  /** Optional color (hex without #) */
  color?: string;
}

/**
 * Repository context for issue intelligence operations.
 */
export interface RepositoryContext {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Available labels in the repository */
  labels: RepositoryLabel[];
}

// ============================================================================
// Issue Enrichment Types (AI-17)
// ============================================================================

/**
 * A section of enriched content with confidence score.
 */
export interface EnrichedSection {
  /** The enriched content for this section */
  content: string;
  /** Confidence score for this section (0-100) */
  confidence: number;
}

/**
 * Structured sections of an enriched issue.
 *
 * All sections are optional as not all issues require all sections.
 */
export interface EnrichedIssueSections {
  /** Problem statement section */
  problem?: EnrichedSection;
  /** Proposed solution section */
  solution?: EnrichedSection;
  /** Additional context section */
  context?: EnrichedSection;
  /** Impact assessment section */
  impact?: EnrichedSection;
  /** Acceptance criteria section */
  acceptanceCriteria?: EnrichedSection;
}

/**
 * Enriched issue with structured sections and AI-generated content.
 *
 * Represents the result of AI-17 issue enrichment.
 */
export interface EnrichedIssue {
  /** Original issue title and body */
  original: {
    title: string;
    body: string;
  };
  /** Whether to preserve the original body alongside enriched content */
  preserveOriginal: boolean;
  /** The fully enriched body text */
  enrichedBody: string;
  /** Structured sections extracted/generated */
  sections: EnrichedIssueSections;
  /** Suggested labels based on content analysis */
  suggestedLabels: string[];
  /** Suggested assignees based on content analysis */
  suggestedAssignees?: string[];
  /** Overall confidence in the enrichment */
  overallConfidence: SectionConfidence;
}

/**
 * Configuration for issue enrichment.
 */
export interface IssueEnrichmentConfig {
  /** Whether to preserve original content */
  preserveOriginal: boolean;
  /** Sections to generate */
  includeSections: Array<keyof EnrichedIssueSections>;
  /** Whether to suggest labels */
  suggestLabels: boolean;
  /** Whether to suggest assignees */
  suggestAssignees: boolean;
}

// ============================================================================
// Label Suggestion Types (AI-18)
// ============================================================================

/**
 * A suggested label with confidence and rationale.
 */
export interface LabelSuggestion {
  /** Label name */
  label: string;
  /** Whether this label already exists in the repository */
  isExisting: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Explanation for why this label is suggested */
  rationale: string;
  /** Patterns in the issue that matched this label */
  matchedPatterns: string[];
}

/**
 * Proposal for a new label to be created.
 */
export interface NewLabelProposal {
  /** Proposed label name */
  name: string;
  /** Description for the new label */
  description: string;
  /** Suggested color (hex without #) */
  color: string;
  /** Rationale for creating this new label */
  rationale: string;
}

/**
 * Result of label suggestion with tiered confidence.
 */
export interface LabelSuggestionResult {
  /** High confidence suggestions (>= high threshold) */
  high: LabelSuggestion[];
  /** Medium confidence suggestions (>= medium threshold, < high threshold) */
  medium: LabelSuggestion[];
  /** Low confidence suggestions (< medium threshold) */
  low: LabelSuggestion[];
  /** Proposals for new labels not in repository */
  newLabelProposals?: NewLabelProposal[];
  /** Overall confidence in suggestions */
  confidence: SectionConfidence;
}

/**
 * Confidence thresholds for label suggestions.
 */
export interface LabelConfidenceThresholds {
  /** Threshold for high confidence (default 0.8) */
  high: number;
  /** Threshold for medium confidence (default 0.5) */
  medium: number;
}

/**
 * Configuration for label suggestion behavior.
 */
export interface LabelSuggestionConfig {
  /** Prefer existing labels over new proposals */
  preferExisting: boolean;
  /** Maximum number of suggestions to return */
  maxSuggestions: number;
  /** Whether to include new label proposals */
  includeNewProposals: boolean;
  /** Confidence thresholds */
  confidenceThresholds: LabelConfidenceThresholds;
}

// ============================================================================
// Duplicate Detection Types (AI-19)
// ============================================================================

/**
 * A candidate duplicate issue with similarity score.
 */
export interface DuplicateCandidate {
  /** Issue ID of the potential duplicate */
  issueId: string;
  /** Issue number of the potential duplicate */
  issueNumber: number;
  /** Title of the potential duplicate */
  title: string;
  /** Similarity score (0-1) */
  similarity: number;
  /** Explanation of why this is considered a duplicate */
  reasoning: string;
}

/**
 * Thresholds for duplicate detection confidence tiers.
 */
export interface DuplicateDetectionThresholds {
  /** Threshold for high confidence duplicates (default 0.92) */
  high: number;
  /** Threshold for medium confidence duplicates (default 0.75) */
  medium: number;
}

/**
 * Default duplicate detection thresholds.
 */
export const DEFAULT_DUPLICATE_THRESHOLDS: DuplicateDetectionThresholds = {
  high: 0.92,
  medium: 0.75,
};

/**
 * Action to take for detected duplicates.
 */
export type DuplicateAction = "auto_link" | "flag_for_review" | "ignore";

/**
 * Result of duplicate detection with tiered candidates.
 */
export interface DuplicateDetectionResult {
  /** High confidence duplicates (auto-linkable) */
  highConfidence: DuplicateCandidate[];
  /** Medium confidence duplicates (review recommended) */
  mediumConfidence: DuplicateCandidate[];
  /** Low confidence duplicates (possible but uncertain) */
  lowConfidence: DuplicateCandidate[];
  /** New embedding vector for the issue (optional, for caching) */
  newEmbedding?: number[];
  /** Overall confidence in detection */
  confidence: SectionConfidence;
}

/**
 * Configuration for duplicate detection behavior.
 */
export interface DuplicateDetectionConfig {
  /** Thresholds for confidence tiers */
  thresholds: DuplicateDetectionThresholds;
  /** Maximum number of results to return */
  maxResults: number;
  /** Actions to take at each confidence tier */
  actions: {
    high: DuplicateAction;
    medium: DuplicateAction;
    low: DuplicateAction;
  };
}

// ============================================================================
// Related Issue Linking Types (AI-20)
// ============================================================================

/**
 * Type of relationship between issues.
 */
export type RelationshipType = "semantic" | "dependency" | "component";

/**
 * Sub-type for dependency relationships.
 */
export type DependencySubType = "blocks" | "blocked_by" | "related_to";

/**
 * A relationship between two issues.
 */
export interface IssueRelationship {
  /** Source issue ID (the issue being analyzed) */
  sourceIssueId: string;
  /** Target issue ID */
  targetIssueId: string;
  /** Target issue number */
  targetIssueNumber: number;
  /** Target issue title */
  targetIssueTitle: string;
  /** Type of relationship */
  relationshipType: RelationshipType;
  /** Sub-type for dependency relationships */
  subType?: DependencySubType;
  /** Confidence in this relationship (0-1) */
  confidence: number;
  /** Explanation of the relationship */
  reasoning: string;
}

/**
 * Result of related issue analysis.
 */
export interface RelatedIssueResult {
  /** Found relationships */
  relationships: IssueRelationship[];
  /** Overall confidence in analysis */
  confidence: SectionConfidence;
}

/**
 * Configuration for related issue linking.
 */
export interface RelatedIssueLinkingConfig {
  /** Include semantic similarity-based relationships */
  includeSemanticSimilarity: boolean;
  /** Include dependency relationships (blocks/blocked_by) */
  includeDependencies: boolean;
  /** Include component/area grouping relationships */
  includeComponentGrouping: boolean;
  /** Minimum confidence threshold for relationships */
  minConfidence: number;
  /** Maximum number of relationships to return */
  maxRelationships: number;
}

// ============================================================================
// Composite Configuration Types
// ============================================================================

/**
 * Combined configuration for all issue intelligence features.
 */
export interface IssueIntelligenceConfig {
  /** Issue enrichment configuration (AI-17) */
  enrichment: IssueEnrichmentConfig;
  /** Label suggestion configuration (AI-18) */
  labelSuggestion: LabelSuggestionConfig;
  /** Duplicate detection configuration (AI-19) */
  duplicateDetection: DuplicateDetectionConfig;
  /** Related issue linking configuration (AI-20) */
  relatedLinking: RelatedIssueLinkingConfig;
}

/**
 * Default configuration for issue intelligence features.
 */
export const DEFAULT_ISSUE_INTELLIGENCE_CONFIG: IssueIntelligenceConfig = {
  enrichment: {
    preserveOriginal: true,
    includeSections: ["problem", "solution", "context", "impact", "acceptanceCriteria"],
    suggestLabels: true,
    suggestAssignees: false,
  },
  labelSuggestion: {
    preferExisting: true,
    maxSuggestions: 10,
    includeNewProposals: true,
    confidenceThresholds: {
      high: 0.8,
      medium: 0.5,
    },
  },
  duplicateDetection: {
    thresholds: DEFAULT_DUPLICATE_THRESHOLDS,
    maxResults: 10,
    actions: {
      high: "auto_link",
      medium: "flag_for_review",
      low: "ignore",
    },
  },
  relatedLinking: {
    includeSemanticSimilarity: true,
    includeDependencies: true,
    includeComponentGrouping: true,
    minConfidence: 0.5,
    maxRelationships: 20,
  },
};
