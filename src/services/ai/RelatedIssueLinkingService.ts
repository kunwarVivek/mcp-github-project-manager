/**
 * AI-Powered Related Issue Linking Service (AI-20)
 *
 * Detects relationships between issues:
 * - Semantic: Similar topic/feature (via embeddings)
 * - Dependency: Blocks/blocked-by chains (via keyword analysis + AI)
 * - Component: Same area of codebase (via label/path analysis)
 *
 * Falls back to keyword/label matching when AI unavailable.
 */

import { embed, embedMany, cosineSimilarity } from 'ai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { AIServiceFactory } from './AIServiceFactory.js';
import { ConfidenceScorer, calculateWeightedScore, getConfidenceTier } from './ConfidenceScorer.js';
import { EmbeddingCache } from '../../cache/EmbeddingCache.js';
import {
  RELATED_ISSUE_SYSTEM_PROMPT,
  formatRelatedIssuePrompt
} from './prompts/IssueIntelligencePrompts.js';
import {
  IssueRelationship,
  RelatedIssueResult,
  RelatedIssueLinkingConfig,
  RelationshipType,
  DependencySubType,
  IssueInput
} from '../../domain/issue-intelligence-types.js';
import { SectionConfidence, ConfidenceFactors } from '../../domain/ai-types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration for related issue linking.
 */
const DEFAULT_CONFIG: Required<Pick<RelatedIssueLinkingConfig, 'includeSemanticSimilarity' | 'includeDependencies' | 'includeComponentGrouping'>> = {
  includeSemanticSimilarity: true,
  includeDependencies: true,
  includeComponentGrouping: true
};

/**
 * Keywords indicating the issue blocks something else.
 */
const BLOCKS_KEYWORDS = [
  'enables', 'unblocks', 'required for', 'blocks', 'prerequisite for',
  'must be done before', 'needed for', 'enables work on'
];

/**
 * Keywords indicating the issue is blocked by something.
 */
const BLOCKING_KEYWORDS = [
  'prerequisite', 'requires', 'depends on', 'needs', 'blocked by',
  'waiting for', 'depends upon', 'cannot start until', 'after #'
];

/**
 * Threshold for semantic similarity relationships.
 */
const SEMANTIC_THRESHOLD = 0.75;

/**
 * Minimum label overlap for component relationships.
 */
const COMPONENT_LABEL_THRESHOLD = 0.3;

/**
 * Zod schema for AI dependency analysis response.
 */
const AIDependencySchema = z.object({
  relationships: z.array(z.object({
    targetIssueId: z.string(),
    subType: z.enum(['blocks', 'blocked_by', 'related_to']),
    confidence: z.number().min(0).max(1),
    reasoning: z.string()
  }))
});

type AIDependencyResult = z.infer<typeof AIDependencySchema>;

// ============================================================================
// RelatedIssueLinkingService
// ============================================================================

/**
 * Service for detecting relationships between issues.
 *
 * Uses multiple strategies:
 * - Embedding-based semantic similarity
 * - Keyword-based dependency detection
 * - AI-powered implicit dependency analysis
 * - Label-based component grouping
 */
export class RelatedIssueLinkingService {
  private aiFactory: AIServiceFactory;
  private embeddingCache: EmbeddingCache;
  private confidenceScorer: ConfidenceScorer;
  private config: Required<Pick<RelatedIssueLinkingConfig, 'includeSemanticSimilarity' | 'includeDependencies' | 'includeComponentGrouping'>>;

  /**
   * Create a new related issue linking service.
   *
   * @param config - Optional configuration overrides
   */
  constructor(config?: Partial<RelatedIssueLinkingConfig>) {
    this.aiFactory = AIServiceFactory.getInstance();
    this.embeddingCache = new EmbeddingCache();
    this.confidenceScorer = new ConfidenceScorer();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Find issues related to a source issue.
   *
   * @param params - Source issue and repository context
   * @returns Related issues with relationship types and confidence
   */
  async findRelatedIssues(params: {
    issueId: string;
    issueTitle: string;
    issueDescription: string;
    issueLabels?: string[];
    repositoryIssues: IssueInput[];
  }): Promise<RelatedIssueResult> {
    const { issueId, issueTitle, issueDescription, issueLabels = [], repositoryIssues } = params;

    // Filter out the source issue
    const candidateIssues = repositoryIssues.filter(i => i.id !== issueId);

    if (candidateIssues.length === 0) {
      return this.getEmptyResult();
    }

    // Collect relationships from all enabled strategies
    const allRelationships: IssueRelationship[] = [];

    // Semantic similarity (embedding-based)
    if (this.config.includeSemanticSimilarity) {
      try {
        const semanticRelations = await this.findSemanticRelations({
          sourceId: issueId,
          sourceTitle: issueTitle,
          sourceDescription: issueDescription,
          candidateIssues
        });
        allRelationships.push(...semanticRelations);
      } catch (error) {
        process.stderr.write(`[RelatedIssueLinking] Semantic analysis failed: ${error}\n`);
        // Continue with other strategies
      }
    }

    // Dependency detection (keyword + AI)
    if (this.config.includeDependencies) {
      const dependencyRelations = await this.detectDependencies({
        sourceId: issueId,
        sourceTitle: issueTitle,
        sourceDescription: issueDescription,
        candidateIssues
      });
      allRelationships.push(...dependencyRelations);
    }

    // Component grouping (label-based)
    if (this.config.includeComponentGrouping) {
      const componentRelations = this.detectComponentGrouping({
        sourceId: issueId,
        sourceLabels: issueLabels,
        candidateIssues
      });
      allRelationships.push(...componentRelations);
    }

    // Deduplicate and merge relationships (keep highest confidence for same target)
    const mergedRelationships = this.deduplicateRelationships(allRelationships);

    // Sort by confidence descending
    mergedRelationships.sort((a, b) => b.confidence - a.confidence);

    // Calculate overall confidence
    const confidence = this.calculateConfidence({
      totalCandidates: candidateIssues.length,
      relationshipsFound: mergedRelationships.length,
      strategiesUsed: [
        this.config.includeSemanticSimilarity,
        this.config.includeDependencies,
        this.config.includeComponentGrouping
      ].filter(Boolean).length
    });

    return {
      relationships: mergedRelationships,
      confidence
    };
  }

  /**
   * Find semantically similar issues using embeddings.
   */
  private async findSemanticRelations(params: {
    sourceId: string;
    sourceTitle: string;
    sourceDescription: string;
    candidateIssues: IssueInput[];
  }): Promise<IssueRelationship[]> {
    const { sourceId, sourceTitle, sourceDescription, candidateIssues } = params;

    // Get embedding for source issue
    const sourceText = `${sourceTitle}\n\n${sourceDescription || ''}`;
    const { embedding: sourceEmbedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: sourceText
    });

    // Get embeddings for candidates
    const candidateEmbeddings = await this.getOrComputeEmbeddings(candidateIssues);

    const relationships: IssueRelationship[] = [];

    for (const candidate of candidateIssues) {
      const candidateEmbedding = candidateEmbeddings.get(candidate.id);
      if (!candidateEmbedding) continue;

      const similarity = cosineSimilarity(sourceEmbedding, candidateEmbedding);

      if (similarity >= SEMANTIC_THRESHOLD) {
        relationships.push({
          sourceIssueId: sourceId,
          targetIssueId: candidate.id,
          targetIssueNumber: candidate.number,
          targetIssueTitle: candidate.title,
          relationshipType: 'semantic',
          confidence: similarity,
          reasoning: `${(similarity * 100).toFixed(0)}% semantic similarity - similar topic or feature area`
        });
      }
    }

    return relationships;
  }

  /**
   * Get or compute embeddings for candidate issues.
   */
  private async getOrComputeEmbeddings(issues: IssueInput[]): Promise<Map<string, number[]>> {
    const result = new Map<string, number[]>();
    const uncachedIssues: IssueInput[] = [];
    const uncachedTexts: string[] = [];

    // Check cache
    for (const issue of issues) {
      const contentHash = EmbeddingCache.computeContentHash(issue.title, issue.body);
      const cached = this.embeddingCache.get(issue.id, contentHash);

      if (cached) {
        result.set(issue.id, cached);
      } else {
        uncachedIssues.push(issue);
        uncachedTexts.push(`${issue.title}\n\n${issue.body || ''}`);
      }
    }

    // Batch compute uncached
    if (uncachedTexts.length > 0) {
      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: uncachedTexts
      });

      for (let i = 0; i < uncachedIssues.length; i++) {
        const issue = uncachedIssues[i];
        const embedding = embeddings[i];
        const contentHash = EmbeddingCache.computeContentHash(issue.title, issue.body);

        this.embeddingCache.set(issue.id, contentHash, embedding);
        result.set(issue.id, embedding);
      }
    }

    return result;
  }

  /**
   * Detect dependency relationships using keyword analysis and AI.
   */
  private async detectDependencies(params: {
    sourceId: string;
    sourceTitle: string;
    sourceDescription: string;
    candidateIssues: IssueInput[];
  }): Promise<IssueRelationship[]> {
    const { sourceId, sourceTitle, sourceDescription, candidateIssues } = params;
    const relationships: IssueRelationship[] = [];

    const sourceText = `${sourceTitle}\n${sourceDescription || ''}`.toLowerCase();

    // First pass: keyword-based detection
    for (const candidate of candidateIssues) {
      const candidateText = `${candidate.title}\n${candidate.body || ''}`.toLowerCase();

      // Check if source references candidate (blocks or blocked_by)
      const issuePattern = new RegExp(`#${candidate.number}\\b|issue\\s*${candidate.number}\\b`, 'i');

      if (issuePattern.test(sourceText)) {
        // Source mentions candidate - determine direction
        const blocksMatch = BLOCKS_KEYWORDS.some(kw =>
          sourceText.includes(kw) && sourceText.indexOf(kw) < sourceText.search(issuePattern)
        );
        const blockedByMatch = BLOCKING_KEYWORDS.some(kw =>
          sourceText.includes(kw) && sourceText.indexOf(kw) < sourceText.search(issuePattern)
        );

        let subType: DependencySubType = 'related_to';
        if (blocksMatch && !blockedByMatch) {
          subType = 'blocks';
        } else if (blockedByMatch && !blocksMatch) {
          subType = 'blocked_by';
        }

        relationships.push({
          sourceIssueId: sourceId,
          targetIssueId: candidate.id,
          targetIssueNumber: candidate.number,
          targetIssueTitle: candidate.title,
          relationshipType: 'dependency',
          subType,
          confidence: 0.9, // High confidence for explicit references
          reasoning: `Source issue explicitly references #${candidate.number}`
        });
      }

      // Check for keyword overlap suggesting implicit dependency
      const hasBlocksKeyword = BLOCKS_KEYWORDS.some(kw => sourceText.includes(kw));
      const hasBlockedByKeyword = BLOCKING_KEYWORDS.some(kw => sourceText.includes(kw));

      if ((hasBlocksKeyword || hasBlockedByKeyword) && !relationships.find(r => r.targetIssueId === candidate.id)) {
        // Check for strong thematic overlap that might indicate dependency
        const overlapScore = this.calculateKeywordOverlap(sourceText, candidateText);
        if (overlapScore > 0.4) {
          // Add as potential dependency (lower confidence)
          relationships.push({
            sourceIssueId: sourceId,
            targetIssueId: candidate.id,
            targetIssueNumber: candidate.number,
            targetIssueTitle: candidate.title,
            relationshipType: 'dependency',
            subType: 'related_to',
            confidence: 0.5 + (overlapScore * 0.2),
            reasoning: `Potential dependency based on keyword overlap (${(overlapScore * 100).toFixed(0)}% overlap)`
          });
        }
      }
    }

    // Second pass: AI analysis for implicit dependencies
    const aiRelationships = await this.aiDependencyAnalysis(
      { id: sourceId, title: sourceTitle, body: sourceDescription || '' },
      candidateIssues.filter(c => !relationships.find(r => r.targetIssueId === c.id))
    );

    // Merge AI results (don't duplicate)
    for (const aiRel of aiRelationships) {
      if (!relationships.find(r => r.targetIssueId === aiRel.targetIssueId)) {
        relationships.push(aiRel);
      }
    }

    return relationships;
  }

  /**
   * Use AI to detect implicit dependencies.
   */
  private async aiDependencyAnalysis(
    sourceIssue: { id: string; title: string; body: string },
    candidateIssues: IssueInput[]
  ): Promise<IssueRelationship[]> {
    if (candidateIssues.length === 0) {
      return [];
    }

    const model = this.aiFactory.getModel('main') || this.aiFactory.getBestAvailableModel();
    if (!model) {
      // AI unavailable
      return [];
    }

    try {
      // Limit candidates to prevent token overflow
      const limitedCandidates = candidateIssues.slice(0, 20);

      const result = await generateObject({
        model,
        system: RELATED_ISSUE_SYSTEM_PROMPT,
        prompt: this.formatDependencyAnalysisPrompt(sourceIssue, limitedCandidates),
        schema: AIDependencySchema,
        temperature: 0.3
      });

      // Convert AI result to IssueRelationship[]
      const relationships: IssueRelationship[] = [];

      for (const rel of result.object.relationships) {
        if (rel.confidence < 0.5) continue;

        const candidate = candidateIssues.find(c => c.id === rel.targetIssueId);
        if (!candidate) continue;

        relationships.push({
          sourceIssueId: sourceIssue.id,
          targetIssueId: rel.targetIssueId,
          targetIssueNumber: candidate.number,
          targetIssueTitle: candidate.title,
          relationshipType: 'dependency',
          subType: rel.subType as DependencySubType,
          confidence: rel.confidence,
          reasoning: rel.reasoning
        });
      }

      return relationships;
    } catch (error) {
      process.stderr.write(`[RelatedIssueLinking] AI dependency analysis failed: ${error}\n`);
      return [];
    }
  }

  /**
   * Format prompt for AI dependency analysis.
   */
  private formatDependencyAnalysisPrompt(
    sourceIssue: { id: string; title: string; body: string },
    candidateIssues: IssueInput[]
  ): string {
    const candidatesText = candidateIssues.map((issue, i) =>
      `${i + 1}. ID: ${issue.id}, #${issue.number}: ${issue.title}\n   ${(issue.body || '').substring(0, 200)}${(issue.body || '').length > 200 ? '...' : ''}`
    ).join('\n\n');

    return `Analyze the following source issue and identify any dependency relationships with the candidate issues.

Source Issue (ID: ${sourceIssue.id}):
Title: ${sourceIssue.title}
Description: ${sourceIssue.body}

Candidate Issues:
${candidatesText}

For each candidate, determine if there is a dependency relationship:
- "blocks": Source issue blocks the candidate (must complete source first)
- "blocked_by": Source issue is blocked by the candidate (must complete candidate first)
- "related_to": Issues are connected but neither blocks the other

Only return relationships with confidence >= 0.5.
Return an empty array if no relationships are detected.`;
  }

  /**
   * Detect component relationships based on label overlap.
   */
  private detectComponentGrouping(params: {
    sourceId: string;
    sourceLabels: string[];
    candidateIssues: IssueInput[];
  }): IssueRelationship[] {
    const { sourceId, sourceLabels, candidateIssues } = params;
    const relationships: IssueRelationship[] = [];

    if (sourceLabels.length === 0) {
      return relationships;
    }

    // Component-related label prefixes to prioritize
    const componentPrefixes = ['component:', 'area:', 'module:', 'package:', 'scope:'];

    // Extract component labels from source
    const sourceComponentLabels = sourceLabels.filter(label =>
      componentPrefixes.some(prefix => label.toLowerCase().startsWith(prefix)) ||
      !['bug', 'feature', 'enhancement', 'documentation', 'help wanted', 'good first issue'].includes(label.toLowerCase())
    );

    for (const candidate of candidateIssues) {
      const candidateLabels = candidate.labels || [];
      if (candidateLabels.length === 0) continue;

      const overlapScore = this.calculateLabelOverlap(sourceLabels, candidateLabels);

      if (overlapScore >= COMPONENT_LABEL_THRESHOLD) {
        // Find the common labels for reasoning
        const commonLabels = sourceLabels.filter(l => candidateLabels.includes(l));

        relationships.push({
          sourceIssueId: sourceId,
          targetIssueId: candidate.id,
          targetIssueNumber: candidate.number,
          targetIssueTitle: candidate.title,
          relationshipType: 'component',
          confidence: Math.min(1, overlapScore + 0.1), // Slight boost since we matched
          reasoning: `Shared labels: ${commonLabels.join(', ')}`
        });
      }
    }

    return relationships;
  }

  /**
   * Calculate Jaccard similarity for label sets.
   */
  private calculateLabelOverlap(labels1: string[], labels2: string[]): number {
    if (labels1.length === 0 || labels2.length === 0) {
      return 0;
    }

    const set1 = new Set(labels1.map(l => l.toLowerCase()));
    const set2 = new Set(labels2.map(l => l.toLowerCase()));

    const intersection = [...set1].filter(l => set2.has(l)).length;
    const union = new Set([...set1, ...set2]).size;

    return intersection / union;
  }

  /**
   * Calculate keyword overlap score between two texts.
   */
  private calculateKeywordOverlap(text1: string, text2: string): number {
    const keywords1 = this.extractKeywords(text1);
    const keywords2 = this.extractKeywords(text2);

    if (keywords1.size === 0 || keywords2.size === 0) {
      return 0;
    }

    const intersection = [...keywords1].filter(k => keywords2.has(k)).length;
    const union = new Set([...keywords1, ...keywords2]).size;

    return intersection / union;
  }

  /**
   * Extract meaningful keywords from text.
   */
  private extractKeywords(text: string): Set<string> {
    const stopwords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
      'the', 'to', 'was', 'were', 'will', 'with', 'this', 'but', 'they',
      'have', 'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how'
    ]);

    const words = text.toLowerCase().split(/[^a-z0-9]+/);
    return new Set(words.filter(w => w.length >= 3 && !stopwords.has(w)));
  }

  /**
   * Deduplicate relationships, keeping highest confidence for each target.
   */
  private deduplicateRelationships(relationships: IssueRelationship[]): IssueRelationship[] {
    const byTarget = new Map<string, IssueRelationship[]>();

    for (const rel of relationships) {
      const existing = byTarget.get(rel.targetIssueId) || [];
      existing.push(rel);
      byTarget.set(rel.targetIssueId, existing);
    }

    const merged: IssueRelationship[] = [];

    for (const [targetId, rels] of byTarget) {
      // Sort by confidence descending
      rels.sort((a, b) => b.confidence - a.confidence);

      // Take the highest confidence relationship
      const best = rels[0];

      // If there are multiple relationship types, combine reasoning
      if (rels.length > 1) {
        const types = [...new Set(rels.map(r => r.relationshipType))];
        if (types.length > 1) {
          best.reasoning = `Multiple relationships detected: ${types.join(', ')}. ${best.reasoning}`;
        }
      }

      merged.push(best);
    }

    return merged;
  }

  /**
   * Calculate confidence for the overall result.
   */
  private calculateConfidence(params: {
    totalCandidates: number;
    relationshipsFound: number;
    strategiesUsed: number;
  }): SectionConfidence {
    const { totalCandidates, relationshipsFound, strategiesUsed } = params;

    // Input completeness: based on candidates analyzed
    const inputCompleteness = Math.min(1, totalCandidates / 50) * 0.8 + 0.2;

    // AI self-assessment: higher when multiple strategies used
    const aiSelfAssessment = strategiesUsed >= 2 ? 0.8 : 0.6;

    // Pattern match: based on finding reasonable relationships
    const relationshipRatio = totalCandidates > 0 ? relationshipsFound / totalCandidates : 0;
    const patternMatch = relationshipRatio > 0 && relationshipRatio < 0.5 ? 0.8 : 0.5;

    const factors: ConfidenceFactors = {
      inputCompleteness,
      aiSelfAssessment,
      patternMatch
    };

    const score = calculateWeightedScore(factors);
    const tier = getConfidenceTier(score);
    const needsReview = score < 70;

    return {
      sectionId: 'related-issue-linking',
      sectionName: 'Related Issue Linking',
      score,
      tier,
      factors,
      reasoning: `Analyzed ${totalCandidates} candidates using ${strategiesUsed} detection strategies. Found ${relationshipsFound} relationships.`,
      needsReview
    };
  }

  /**
   * Get empty result when there are no candidates.
   */
  private getEmptyResult(): RelatedIssueResult {
    return {
      relationships: [],
      confidence: {
        sectionId: 'related-issue-linking',
        sectionName: 'Related Issue Linking',
        score: 100,
        tier: 'high',
        factors: {
          inputCompleteness: 1,
          aiSelfAssessment: 1,
          patternMatch: 1
        },
        reasoning: 'No candidate issues to analyze.',
        needsReview: false
      }
    };
  }

  /**
   * Get the embedding cache for external access.
   */
  getCache(): EmbeddingCache {
    return this.embeddingCache;
  }

  /**
   * Get current configuration.
   */
  getConfig(): typeof this.config {
    return { ...this.config };
  }
}
