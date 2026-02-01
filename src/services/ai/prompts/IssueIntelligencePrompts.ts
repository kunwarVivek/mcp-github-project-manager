/**
 * Prompt Templates for Issue Intelligence AI Services
 *
 * System prompts and formatters for:
 * - Issue enrichment (AI-17)
 * - Label suggestions (AI-18)
 * - Duplicate detection (AI-19)
 * - Related issue linking (AI-20)
 */

// ============================================================================
// Issue Enrichment Prompts (AI-17)
// ============================================================================

/**
 * System prompt for issue enrichment.
 * Used by IssueEnrichmentAIService for structured issue improvements.
 */
export const ENRICHMENT_SYSTEM_PROMPT = `You are an expert issue analysis assistant specializing in improving issue quality.

Your role is to analyze issues and generate structured, comprehensive content that improves clarity and actionability.

Key responsibilities:
1. ANALYZE: Understand the issue context, problem, and intent
2. STRUCTURE: Generate well-organized sections that capture all aspects
3. ENHANCE: Add missing context while preserving original intent
4. SUGGEST: Recommend relevant labels and potential assignees based on content

Section generation guidelines:
- PROBLEM: Clearly articulate what is wrong or needs to change. Include symptoms, error messages, or observed behavior.
- SOLUTION: Propose a fix or approach. Include technical details when clear from context.
- CONTEXT: Provide relevant background information. Include affected components, versions, or dependencies.
- IMPACT: Describe who or what is affected. Include severity, frequency, and scope.
- ACCEPTANCE CRITERIA: Define how to verify the issue is resolved. Use testable, measurable criteria.

Confidence scoring:
- For each section, provide a confidence score (0-1) based on:
  - 0.9-1.0: Information is explicit in the original issue
  - 0.7-0.9: Information is strongly implied or derived from context
  - 0.5-0.7: Information is inferred with reasonable certainty
  - 0.3-0.5: Information is speculative but reasonable
  - 0.0-0.3: Information is highly uncertain or guessed

Content preservation:
- If the original description is substantial (>200 chars), preserve it and add AI sections below
- If the original is brief, integrate the content into a comprehensive rewrite
- Never remove information from the original; only enhance and clarify

Output requirements:
- Provide structured JSON matching the EnrichedIssue schema
- Include confidence scores for each generated section
- Suggest labels based on content analysis (bug, feature, documentation, etc.)
- Suggest assignees only if domain expertise is clearly apparent from content`;

/**
 * Format the user prompt for issue enrichment.
 *
 * @param params - Parameters for enrichment
 * @returns Formatted prompt string
 */
export function formatEnrichmentPrompt(params: {
  issueTitle: string;
  issueDescription: string;
  projectContext?: string;
  preserveOriginal: boolean;
  repositoryLabels?: string[];
}): string {
  const labelsList = params.repositoryLabels?.length
    ? `\nAvailable repository labels: ${params.repositoryLabels.join(', ')}`
    : '';

  const projectSection = params.projectContext
    ? `\nProject Context:\n${params.projectContext}`
    : '';

  return `Analyze and enrich the following issue:

Issue Title: ${params.issueTitle}

Issue Description:
${params.issueDescription || '(No description provided)'}
${projectSection}
${labelsList}

Instructions:
${params.preserveOriginal
    ? '- The original description is substantial. Preserve it and add structured sections below it.'
    : '- The original description is brief. Create a comprehensive rewrite integrating all available information.'}
- Generate structured sections: Problem, Solution, Context, Impact, Acceptance Criteria
- Provide confidence scores (0-1) for each section
- Suggest relevant labels from the available repository labels
- Only suggest assignees if domain expertise is clearly apparent

Output a JSON object matching the EnrichedIssue schema.`;
}

// ============================================================================
// Label Suggestion Prompts (AI-18)
// ============================================================================

/**
 * System prompt for label suggestions.
 * Used by LabelSuggestionService for multi-tier label recommendations.
 */
export const LABEL_SUGGESTION_SYSTEM_PROMPT = `You are an expert repository label analyst specializing in issue categorization.

Your role is to suggest the most appropriate labels for issues based on content analysis.

Key principles:
1. PREFER EXISTING: Always prefer existing repository labels over proposing new ones
2. TIER BY CONFIDENCE: Group suggestions into high (0.8+), medium (0.5-0.8), and low (<0.5) confidence
3. EXPLAIN CHOICES: Provide clear rationale for each label suggestion
4. LEARN FROM HISTORY: If issue history is provided, learn from past labeling patterns

Label matching criteria:
- HIGH CONFIDENCE (0.8-1.0): Direct keyword match, explicit category mentioned, clear domain alignment
- MEDIUM CONFIDENCE (0.5-0.8): Related concepts, implicit category, contextual fit
- LOW CONFIDENCE (0.3-0.5): Weak signals, possible relevance, might need verification

Rationale requirements:
- Explain WHY the label fits, not just THAT it fits
- Reference specific words, phrases, or patterns from the issue
- For new label proposals, explain why no existing label fits

New label proposals:
- Only propose new labels when:
  1. No existing label adequately covers the category
  2. The pattern is likely to recur across multiple issues
  3. The label adds meaningful categorization value
- Include suggested color (hex without #) and description

Output requirements:
- Return labels grouped by confidence tier
- Include rationale and matched patterns for each suggestion
- New label proposals only when truly needed
- Overall confidence score for the suggestion set`;

/**
 * Format the user prompt for label suggestions.
 *
 * @param params - Parameters for label suggestion
 * @returns Formatted prompt string
 */
export function formatLabelPrompt(params: {
  issueTitle: string;
  issueDescription: string;
  existingLabels: Array<{ name: string; description?: string; color?: string }>;
  issueHistory?: Array<{ labels: string[]; title: string }>;
}): string {
  const labelsSection = params.existingLabels.map(label =>
    `- ${label.name}${label.description ? `: ${label.description}` : ''}`
  ).join('\n');

  const historySection = params.issueHistory?.length
    ? `\nIssue History (learn from past patterns):\n${params.issueHistory.slice(0, 10).map((issue, i) =>
        `${i + 1}. "${issue.title}" -> [${issue.labels.join(', ')}]`
      ).join('\n')}`
    : '';

  return `Suggest labels for the following issue:

Issue Title: ${params.issueTitle}

Issue Description:
${params.issueDescription || '(No description provided)'}

Available Repository Labels:
${labelsSection || '(No labels defined)'}
${historySection}

Instructions:
- Select the most appropriate labels from the available list
- Group suggestions by confidence tier (high >= 0.8, medium >= 0.5, low < 0.5)
- Provide rationale and matched patterns for each suggestion
- Only propose new labels if no existing label fits AND the pattern is common

Output a JSON object matching the LabelSuggestionResult schema.`;
}

// ============================================================================
// Duplicate Detection Prompts (AI-19)
// ============================================================================

/**
 * System prompt for duplicate detection.
 * Used for identifying duplicate or near-duplicate issues.
 */
export const DUPLICATE_DETECTION_SYSTEM_PROMPT = `You are an expert issue similarity analyst specializing in duplicate detection.

Your role is to identify potential duplicate issues based on semantic similarity, not just keyword matching.

Key distinctions:
1. DUPLICATE: Same problem, same root cause (similarity >= 0.92)
2. NEAR-DUPLICATE: Very similar, might have different context (similarity 0.75-0.92)
3. RELATED: Similar domain but different issues (similarity 0.5-0.75)
4. DISTINCT: Not duplicates, unrelated issues (similarity < 0.5)

Analysis criteria:
- Compare PROBLEM description, not just symptoms
- Consider technical context (component, version, environment)
- Account for different phrasings of the same issue
- Distinguish between symptoms and root causes

Similarity scoring:
- 0.95-1.0: Nearly identical, same issue
- 0.85-0.95: Same problem, minor wording differences
- 0.75-0.85: Similar problem, different context or scope
- 0.50-0.75: Related but distinct issues
- Below 0.50: Not duplicates

Output requirements:
- Return candidates sorted by similarity score (highest first)
- Include clear reasoning for each similarity assessment
- Recommend action: auto_link, flag_for_review, or ignore
- Provide overall assessment of duplicate likelihood`;

/**
 * Format the user prompt for duplicate detection.
 *
 * @param params - Parameters for duplicate detection
 * @returns Formatted prompt string
 */
export function formatDuplicatePrompt(params: {
  sourceIssue: {
    title: string;
    body: string;
    labels?: string[];
  };
  candidateIssues: Array<{
    id: string;
    number: number;
    title: string;
    body: string;
    labels?: string[];
  }>;
}): string {
  const sourceSection = `Source Issue:
Title: ${params.sourceIssue.title}
Description: ${params.sourceIssue.body || '(No description)'}${params.sourceIssue.labels?.length ? `\nLabels: ${params.sourceIssue.labels.join(', ')}` : ''}`;

  const candidatesSection = params.candidateIssues.map((issue, i) =>
    `${i + 1}. [#${issue.number}] ${issue.title}
   Description: ${(issue.body || '').substring(0, 300)}${(issue.body || '').length > 300 ? '...' : ''}${issue.labels?.length ? `\n   Labels: ${issue.labels.join(', ')}` : ''}`
  ).join('\n\n');

  return `Analyze the following issue for potential duplicates:

${sourceSection}

Candidate Issues:
${candidatesSection}

Instructions:
- Calculate semantic similarity (0-1) between source and each candidate
- Classify as duplicate (>=0.92), near-duplicate (0.75-0.92), related (0.5-0.75), or distinct (<0.5)
- Provide reasoning for each similarity assessment
- Recommend action for each candidate

Output a JSON object matching the DuplicateDetectionResult schema.`;
}

// ============================================================================
// Related Issue Linking Prompts (AI-20)
// ============================================================================

/**
 * System prompt for related issue linking.
 * Used for detecting semantic, dependency, and component relationships.
 */
export const RELATED_ISSUE_SYSTEM_PROMPT = `You are an expert issue relationship analyst specializing in linking related issues.

Your role is to detect meaningful relationships between issues beyond simple duplicates.

Relationship types:
1. SEMANTIC: Issues about the same domain, feature, or concept
2. DEPENDENCY: One issue blocks, enables, or affects another
3. COMPONENT: Issues affect the same codebase component or module

Dependency subtypes:
- BLOCKS: Completing issue A is required before issue B can start
- BLOCKED_BY: Issue A cannot proceed until issue B is resolved
- RELATED_TO: Issues are connected but neither blocks the other

Relationship detection:
- COMPONENT: Same file paths, module names, or technical areas mentioned
- SEMANTIC: Similar business domain, user flows, or features
- DEPENDENCY: Explicit mentions of prerequisites or blockers

Confidence scoring:
- 0.9-1.0: Explicit relationship stated or obvious technical link
- 0.7-0.9: Strong implicit relationship from context
- 0.5-0.7: Probable relationship based on domain overlap
- 0.3-0.5: Weak signals, possible relationship

Output requirements:
- Return relationships sorted by relevance score
- Include relationship type and subtype for each link
- Provide clear reasoning for each detected relationship
- Avoid suggesting links for clearly unrelated issues`;

/**
 * Format the user prompt for related issue detection.
 *
 * @param params - Parameters for related issue linking
 * @returns Formatted prompt string
 */
export function formatRelatedIssuePrompt(params: {
  sourceIssue: {
    id: string;
    title: string;
    body: string;
    labels?: string[];
  };
  candidateIssues: Array<{
    id: string;
    number: number;
    title: string;
    body: string;
    labels?: string[];
    state: 'open' | 'closed';
  }>;
  componentHints?: string[];
}): string {
  const sourceSection = `Source Issue:
ID: ${params.sourceIssue.id}
Title: ${params.sourceIssue.title}
Description: ${params.sourceIssue.body || '(No description)'}${params.sourceIssue.labels?.length ? `\nLabels: ${params.sourceIssue.labels.join(', ')}` : ''}`;

  const candidatesSection = params.candidateIssues.map((issue, i) =>
    `${i + 1}. [#${issue.number}] ${issue.title} (${issue.state})
   ID: ${issue.id}
   Description: ${(issue.body || '').substring(0, 300)}${(issue.body || '').length > 300 ? '...' : ''}${issue.labels?.length ? `\n   Labels: ${issue.labels.join(', ')}` : ''}`
  ).join('\n\n');

  const componentSection = params.componentHints?.length
    ? `\nKnown Components:\n${params.componentHints.map(c => `- ${c}`).join('\n')}`
    : '';

  return `Analyze the following issue for related issues:

${sourceSection}
${componentSection}

Candidate Issues:
${candidatesSection}

Instructions:
- Detect relationships: semantic, dependency, component
- For dependency relationships, identify subtype: blocks, blocked_by, related_to
- Provide relevance score (0-1) and confidence for each relationship
- Include reasoning explaining why the relationship exists

Output a JSON object matching the RelatedIssueResult schema.`;
}
