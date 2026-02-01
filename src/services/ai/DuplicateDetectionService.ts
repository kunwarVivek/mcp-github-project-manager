/**
 * AI-Powered Duplicate Detection Service (AI-19)
 *
 * Detects duplicate issues using semantic similarity via embeddings.
 * Results are tiered by confidence:
 * - High (0.92+): Recommend auto-link as duplicate
 * - Medium (0.75-0.92): Flag for user review
 * - Low (<0.75): Don't surface
 *
 * Falls back to keyword-based detection when embedding API unavailable.
 */

import { embed, embedMany, cosineSimilarity } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ConfidenceScorer, calculateWeightedScore, getConfidenceTier } from './ConfidenceScorer.js';
import { EmbeddingCache } from '../../cache/EmbeddingCache.js';
import {
  DuplicateCandidate,
  DuplicateDetectionResult,
  DuplicateDetectionThresholds,
  IssueInput
} from '../../domain/issue-intelligence-types.js';
import { SectionConfidence, ConfidenceFactors } from '../../domain/ai-types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default thresholds for duplicate detection.
 */
const DEFAULT_THRESHOLDS: DuplicateDetectionThresholds = {
  high: 0.92,
  medium: 0.75
};

/**
 * Fallback thresholds when using keyword-based detection.
 * Lower thresholds because keyword matching is less precise.
 */
const FALLBACK_THRESHOLDS: DuplicateDetectionThresholds = {
  high: 0.8,
  medium: 0.6
};

/**
 * Common English stopwords to filter out during keyword extraction.
 */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
  'the', 'to', 'was', 'were', 'will', 'with', 'this', 'but', 'they',
  'have', 'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 'can', 'just', 'should', 'now', 'i', 'we', 'you', 'your', 'my'
]);

/**
 * Default maximum results to return.
 */
const DEFAULT_MAX_RESULTS = 10;

// ============================================================================
// DuplicateDetectionService
// ============================================================================

/**
 * Service for detecting duplicate issues using semantic similarity.
 *
 * Uses OpenAI text-embedding-3-small for embedding generation with
 * in-memory caching to reduce API calls. Falls back to keyword-based
 * Jaccard similarity when embeddings are unavailable.
 */
export class DuplicateDetectionService {
  private embeddingCache: EmbeddingCache;
  private confidenceScorer: ConfidenceScorer;
  private thresholds: DuplicateDetectionThresholds;

  /**
   * Create a new duplicate detection service.
   *
   * @param thresholds - Optional custom confidence thresholds
   */
  constructor(thresholds?: Partial<DuplicateDetectionThresholds>) {
    this.embeddingCache = new EmbeddingCache();
    this.confidenceScorer = new ConfidenceScorer();
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Detect potential duplicate issues for a new issue.
   *
   * @param params - Detection parameters
   * @returns Tiered duplicate candidates with confidence
   */
  async detectDuplicates(params: {
    issueTitle: string;
    issueDescription: string;
    existingIssues: IssueInput[];
    maxResults?: number;
  }): Promise<DuplicateDetectionResult> {
    const { issueTitle, issueDescription, existingIssues, maxResults = DEFAULT_MAX_RESULTS } = params;

    // Handle empty existing issues
    if (existingIssues.length === 0) {
      return this.getEmptyResult();
    }

    // Prepare the new issue text
    const newIssueText = `${issueTitle}\n\n${issueDescription || ''}`;

    try {
      // Try embedding-based detection
      return await this.detectWithEmbeddings({
        newIssueText,
        issueTitle,
        issueDescription,
        existingIssues,
        maxResults
      });
    } catch (error) {
      // Fallback to keyword-based detection
      process.stderr.write(`[DuplicateDetection] Embedding failed, using keyword fallback: ${error}\n`);
      return this.getFallbackDetection({
        newIssueText,
        existingIssues,
        maxResults
      });
    }
  }

  /**
   * Detect duplicates using embedding-based similarity.
   */
  private async detectWithEmbeddings(params: {
    newIssueText: string;
    issueTitle: string;
    issueDescription: string;
    existingIssues: IssueInput[];
    maxResults: number;
  }): Promise<DuplicateDetectionResult> {
    const { newIssueText, issueTitle, issueDescription, existingIssues, maxResults } = params;

    // Get embedding for the new issue
    const newIssueEmbedding = await this.getEmbedding(newIssueText);

    // Get or compute embeddings for existing issues
    const existingEmbeddings = await this.getOrComputeEmbeddings(existingIssues);

    // Calculate similarities
    const candidates: DuplicateCandidate[] = [];

    for (const issue of existingIssues) {
      const embedding = existingEmbeddings.get(issue.id);
      if (!embedding) continue;

      const similarity = cosineSimilarity(newIssueEmbedding, embedding);

      // Only include if above low threshold (medium threshold / 1.5)
      if (similarity >= this.thresholds.medium / 1.5) {
        candidates.push({
          issueId: issue.id,
          issueNumber: issue.number,
          title: issue.title,
          similarity,
          reasoning: this.generateReasoning(similarity, issue, issueTitle)
        });
      }
    }

    // Sort by similarity descending
    candidates.sort((a, b) => b.similarity - a.similarity);

    // Tier the results
    const tiered = this.tierCandidates(candidates, maxResults);

    // Calculate confidence
    const confidence = this.calculateConfidence({
      totalIssuesScanned: existingIssues.length,
      candidatesFound: candidates.length,
      aiAvailable: true
    });

    return {
      ...tiered,
      newEmbedding: newIssueEmbedding,
      confidence
    };
  }

  /**
   * Get embedding for a single text using OpenAI.
   */
  private async getEmbedding(text: string): Promise<number[]> {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: text
    });
    return embedding;
  }

  /**
   * Get or compute embeddings for multiple issues.
   *
   * Uses cache to avoid recomputing embeddings for unchanged issues.
   *
   * @param issues - Issues to get embeddings for
   * @returns Map of issue ID to embedding vector
   */
  private async getOrComputeEmbeddings(issues: IssueInput[]): Promise<Map<string, number[]>> {
    const result = new Map<string, number[]>();
    const uncachedIssues: IssueInput[] = [];
    const uncachedTexts: string[] = [];

    // Check cache for each issue
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

    // Batch compute embeddings for uncached issues
    if (uncachedTexts.length > 0) {
      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: uncachedTexts
      });

      // Store in cache and result map
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
   * Fallback detection using keyword overlap (Jaccard similarity).
   */
  private getFallbackDetection(params: {
    newIssueText: string;
    existingIssues: IssueInput[];
    maxResults: number;
  }): DuplicateDetectionResult {
    const { newIssueText, existingIssues, maxResults } = params;

    const candidates: DuplicateCandidate[] = [];

    for (const issue of existingIssues) {
      const issueText = `${issue.title}\n\n${issue.body || ''}`;
      const similarity = this.keywordOverlapScore(newIssueText, issueText);

      // Use fallback thresholds (lower)
      if (similarity >= FALLBACK_THRESHOLDS.medium / 1.5) {
        candidates.push({
          issueId: issue.id,
          issueNumber: issue.number,
          title: issue.title,
          similarity,
          reasoning: `Keyword-based similarity: ${(similarity * 100).toFixed(0)}% overlap in terms`
        });
      }
    }

    // Sort by similarity descending
    candidates.sort((a, b) => b.similarity - a.similarity);

    // Tier with fallback thresholds
    const tiered = this.tierCandidates(candidates, maxResults, FALLBACK_THRESHOLDS);

    // Lower confidence for fallback
    const confidence = this.calculateConfidence({
      totalIssuesScanned: existingIssues.length,
      candidatesFound: candidates.length,
      aiAvailable: false
    });

    return {
      ...tiered,
      confidence
    };
  }

  /**
   * Calculate keyword overlap score using Jaccard similarity.
   *
   * @param text1 - First text
   * @param text2 - Second text
   * @returns Jaccard similarity (0-1)
   */
  private keywordOverlapScore(text1: string, text2: string): number {
    const keywords1 = this.extractKeywords(text1);
    const keywords2 = this.extractKeywords(text2);

    if (keywords1.size === 0 || keywords2.size === 0) {
      return 0;
    }

    // Calculate Jaccard similarity
    const intersection = new Set([...keywords1].filter(k => keywords2.has(k)));
    const union = new Set([...keywords1, ...keywords2]);

    return intersection.size / union.size;
  }

  /**
   * Extract meaningful keywords from text.
   */
  private extractKeywords(text: string): Set<string> {
    // Lowercase and split on non-alphanumeric
    const words = text.toLowerCase().split(/[^a-z0-9]+/);

    // Filter stopwords, short words, and numbers
    const keywords = words.filter(word =>
      word.length >= 3 &&
      !STOPWORDS.has(word) &&
      !/^\d+$/.test(word)
    );

    return new Set(keywords);
  }

  /**
   * Tier candidates by confidence thresholds.
   */
  private tierCandidates(
    candidates: DuplicateCandidate[],
    maxResults: number,
    thresholds: DuplicateDetectionThresholds = this.thresholds
  ): Omit<DuplicateDetectionResult, 'confidence' | 'newEmbedding'> {
    const highConfidence: DuplicateCandidate[] = [];
    const mediumConfidence: DuplicateCandidate[] = [];
    const lowConfidence: DuplicateCandidate[] = [];

    let totalAdded = 0;

    for (const candidate of candidates) {
      if (totalAdded >= maxResults) break;

      if (candidate.similarity >= thresholds.high) {
        highConfidence.push(candidate);
      } else if (candidate.similarity >= thresholds.medium) {
        mediumConfidence.push(candidate);
      } else {
        lowConfidence.push(candidate);
      }

      totalAdded++;
    }

    return { highConfidence, mediumConfidence, lowConfidence };
  }

  /**
   * Generate reasoning for a duplicate candidate.
   */
  private generateReasoning(
    similarity: number,
    candidate: IssueInput,
    newTitle: string
  ): string {
    const percent = (similarity * 100).toFixed(0);

    if (similarity >= this.thresholds.high) {
      return `${percent}% semantic similarity - very likely duplicate. Titles both relate to similar concepts.`;
    } else if (similarity >= this.thresholds.medium) {
      return `${percent}% semantic similarity - potential duplicate worth reviewing.`;
    } else {
      return `${percent}% semantic similarity - some overlap in topics.`;
    }
  }

  /**
   * Calculate confidence for the detection result.
   */
  private calculateConfidence(params: {
    totalIssuesScanned: number;
    candidatesFound: number;
    aiAvailable: boolean;
  }): SectionConfidence {
    const { totalIssuesScanned, candidatesFound, aiAvailable } = params;

    // Input completeness: based on number of issues scanned
    const inputCompleteness = Math.min(1, totalIssuesScanned / 100) * 0.8 + 0.2;

    // AI self-assessment: higher when embeddings available
    const aiSelfAssessment = aiAvailable ? 0.85 : 0.4;

    // Pattern match: based on finding reasonable number of candidates
    const patternMatch = candidatesFound > 0 && candidatesFound < totalIssuesScanned * 0.5
      ? 0.8
      : 0.5;

    const factors: ConfidenceFactors = {
      inputCompleteness,
      aiSelfAssessment,
      patternMatch
    };

    const score = calculateWeightedScore(factors);
    const tier = getConfidenceTier(score);
    const needsReview = score < 70;

    const reasoning = aiAvailable
      ? `Semantic duplicate detection using AI embeddings. Scanned ${totalIssuesScanned} issues.`
      : `Keyword-based fallback detection (embeddings unavailable). Scanned ${totalIssuesScanned} issues.`;

    return {
      sectionId: 'duplicate-detection',
      sectionName: 'Duplicate Detection',
      score,
      tier,
      factors,
      reasoning,
      needsReview
    };
  }

  /**
   * Get empty result for when there are no existing issues.
   */
  private getEmptyResult(): DuplicateDetectionResult {
    return {
      highConfidence: [],
      mediumConfidence: [],
      lowConfidence: [],
      confidence: {
        sectionId: 'duplicate-detection',
        sectionName: 'Duplicate Detection',
        score: 100,
        tier: 'high',
        factors: {
          inputCompleteness: 1,
          aiSelfAssessment: 1,
          patternMatch: 1
        },
        reasoning: 'No existing issues to compare against.',
        needsReview: false
      }
    };
  }

  /**
   * Get the embedding cache for external access (e.g., warming).
   */
  getCache(): EmbeddingCache {
    return this.embeddingCache;
  }

  /**
   * Get current thresholds.
   */
  getThresholds(): DuplicateDetectionThresholds {
    return { ...this.thresholds };
  }
}
