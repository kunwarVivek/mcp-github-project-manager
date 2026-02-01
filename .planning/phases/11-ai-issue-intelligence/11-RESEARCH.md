# Phase 11: AI Issue Intelligence - Research

**Researched:** 2026-02-01
**Domain:** AI-powered issue enrichment, label suggestions, duplicate detection, and related issue linking
**Confidence:** MEDIUM-HIGH

## Summary

Phase 11 implements AI-powered intelligence for issue management, building on the existing `IssueEnrichmentService` and `IssueTriagingService` foundations. The four requirements focus on enhancing issue quality through AI analysis:

1. **AI-17: Issue Enrichment Quality** - Improve enrichment with structured sections (Problem/Solution/Context/Impact), per-section confidence scores, and smart preserve-vs-rewrite logic
2. **AI-18: Label Suggestions** - Multi-tier label suggestions with existing label preference, new label proposals when needed, and learning from issue history
3. **AI-19: Duplicate Detection** - Semantic similarity using embeddings with tiered response (auto-link high, review medium, ignore low)
4. **AI-20: Related Issue Linking** - Detect semantic similarity, dependency chains, and component grouping relationships

The standard approach uses the Vercel AI SDK's `embed`, `embedMany`, and `cosineSimilarity` functions for semantic similarity, combined with structured AI generation (`generateObject`) for enrichment and label analysis. The existing codebase patterns from Phase 9-10 (confidence scoring, AI service architecture, prompt templates) apply directly.

**Primary recommendation:** Create four new AI services (`IssueEnrichmentAIService`, `LabelSuggestionService`, `DuplicateDetectionService`, `RelatedIssueLinkingService`) following the BacklogPrioritizer pattern with per-section confidence, fallback behavior, and configurable thresholds.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| ai | ^4.3.16 | Vercel AI SDK for structured generation + embeddings | Installed |
| @ai-sdk/openai | installed | OpenAI embeddings (`text-embedding-3-small`) | Installed |
| @ai-sdk/anthropic | installed | Claude for structured generation | Installed |
| zod | ^3.25.32 | Schema validation and type inference | Installed |
| graphlib | ^2.1.8 | Graph algorithms for dependency detection | Installed |
| cockatiel | ^3.2.1 | Resilience policies for AI calls | Installed |

### New Dependencies

None required. The Vercel AI SDK already includes embedding support via `embed`, `embedMany`, and `cosineSimilarity` functions. OpenAI's `text-embedding-3-small` (1536 dimensions) is the recommended embedding model.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| OpenAI embeddings | Cohere embeddings | OpenAI more widely supported; Cohere has more dimension options |
| cosineSimilarity (AI SDK) | Custom similarity function | AI SDK function is tested and optimized |
| In-memory embedding storage | Vector database (Pinecone/Milvus) | Overkill for MVP; can add later if scale requires |

**No new installation needed** - all embedding functionality is available through existing `ai` package.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── domain/
│   └── issue-intelligence-types.ts    # NEW: Types for enrichment, labels, duplicates
├── services/
│   ├── ai/
│   │   ├── IssueEnrichmentAIService.ts    # NEW: Enhanced enrichment with confidence
│   │   ├── LabelSuggestionService.ts      # NEW: Multi-tier label suggestions
│   │   ├── DuplicateDetectionService.ts   # NEW: Embedding-based duplicate finder
│   │   ├── RelatedIssueLinkingService.ts  # NEW: Relationship detection
│   │   └── prompts/
│   │       └── IssueIntelligencePrompts.ts # NEW: Prompts for issue analysis
│   ├── IssueEnrichmentService.ts          # MODIFY: Delegate to AI service
│   └── IssueTriagingService.ts            # MODIFY: Use new label suggestions
├── infrastructure/
│   └── tools/
│       ├── issue-intelligence-tools.ts    # NEW: 4 MCP tools
│       └── schemas/
│           └── issue-intelligence-schemas.ts # NEW: Zod schemas for tools
└── cache/
    └── EmbeddingCache.ts                  # NEW: Cache for issue embeddings
```

### Pattern 1: Embedding-Based Semantic Similarity

**What:** Use Vercel AI SDK embeddings to compute semantic similarity between issues for duplicate detection and related issue linking.

**When to use:** Duplicate detection (AI-19) and related issue linking (AI-20).

**Source:** [AI SDK Core: Embeddings](https://ai-sdk.dev/docs/ai-sdk-core/embeddings)

**Example:**
```typescript
// Source: Vercel AI SDK embeddings documentation
import { embed, embedMany, cosineSimilarity } from 'ai';
import { openai } from '@ai-sdk/openai';

const EMBEDDING_MODEL = openai.embeddingModel('text-embedding-3-small');

interface IssueEmbedding {
  issueId: string;
  issueNumber: number;
  title: string;
  embedding: number[];
  createdAt: Date;
}

class DuplicateDetectionService {
  private embeddingCache: Map<string, IssueEmbedding> = new Map();

  async findDuplicates(params: {
    issueTitle: string;
    issueDescription: string;
    existingIssues: Array<{ id: string; number: number; title: string; body: string }>;
    thresholds: { high: number; medium: number }; // e.g., { high: 0.9, medium: 0.75 }
  }): Promise<DuplicateDetectionResult> {
    // 1. Embed the new issue
    const newIssueText = `${params.issueTitle}\n\n${params.issueDescription}`;
    const { embedding: newEmbedding } = await embed({
      model: EMBEDDING_MODEL,
      value: newIssueText,
    });

    // 2. Get/compute embeddings for existing issues
    const issueTexts = params.existingIssues.map(i => `${i.title}\n\n${i.body}`);
    const { embeddings: existingEmbeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: issueTexts,
    });

    // 3. Calculate similarities
    const similarities = existingEmbeddings.map((emb, i) => ({
      issue: params.existingIssues[i],
      similarity: cosineSimilarity(newEmbedding, emb),
    }));

    // 4. Tier the results
    const highConfidence = similarities.filter(s => s.similarity >= params.thresholds.high);
    const mediumConfidence = similarities.filter(
      s => s.similarity >= params.thresholds.medium && s.similarity < params.thresholds.high
    );

    return { highConfidence, mediumConfidence, newEmbedding };
  }
}
```

### Pattern 2: Tiered Label Suggestions with Rationale

**What:** Generate label suggestions grouped by confidence tier (High/Medium/Low) with rationale for each suggestion.

**When to use:** Label suggestion (AI-18).

**Source:** Extends codebase pattern from BacklogPrioritizer

**Example:**
```typescript
// Source: Codebase BacklogPrioritizer pattern + research
import { generateObject } from 'ai';
import { z } from 'zod';

const LabelSuggestionSchema = z.object({
  suggestions: z.array(z.object({
    label: z.string(),
    isExisting: z.boolean(),
    confidence: z.number().min(0).max(1),
    rationale: z.string(),
    matchedPatterns: z.array(z.string()).optional(),
  })),
  newLabelProposals: z.array(z.object({
    name: z.string(),
    description: z.string(),
    color: z.string(), // hex without #
    rationale: z.string(),
  })).optional(),
});

class LabelSuggestionService {
  async suggestLabels(params: {
    issueTitle: string;
    issueDescription: string;
    existingLabels: Array<{ name: string; description?: string; color?: string }>;
    issueHistory?: Array<{ labels: string[]; title: string }>; // For learning
  }): Promise<LabelSuggestionResult> {
    const model = this.aiFactory.getModel('main') || this.aiFactory.getBestAvailableModel();

    if (!model) {
      return this.getFallbackSuggestions(params); // Pattern-based fallback
    }

    const result = await generateObject({
      model,
      system: LABEL_SUGGESTION_SYSTEM_PROMPT,
      prompt: formatLabelPrompt(params),
      schema: LabelSuggestionSchema,
      temperature: 0.3,
    });

    // Group by confidence tiers
    const suggestions = result.object.suggestions;
    return {
      high: suggestions.filter(s => s.confidence >= 0.8),
      medium: suggestions.filter(s => s.confidence >= 0.5 && s.confidence < 0.8),
      low: suggestions.filter(s => s.confidence < 0.5),
      newLabelProposals: result.object.newLabelProposals || [],
      confidence: this.calculateConfidence(params, suggestions),
    };
  }
}
```

### Pattern 3: Structured Issue Enrichment with Sections

**What:** Enrich issues with structured sections (Problem/Solution/Context/Impact), per-section confidence scores, and smart preserve-vs-rewrite logic.

**When to use:** Issue enrichment (AI-17).

**Source:** CONTEXT.md decisions + Phase 9 SectionConfidence pattern

**Example:**
```typescript
// Source: Phase 9 SectionConfidence pattern + CONTEXT.md decisions
import { SectionConfidence, ConfidenceFactors } from '../../domain/ai-types';

interface EnrichedIssue {
  original: {
    title: string;
    body: string;
  };
  preserveOriginal: boolean; // True if original is substantial (>200 chars)
  enrichedBody: string; // Full enriched content
  sections: {
    problem?: EnrichedSection;
    solution?: EnrichedSection;
    context?: EnrichedSection;
    impact?: EnrichedSection;
    acceptanceCriteria?: EnrichedSection;
  };
  suggestedLabels: LabelSuggestion[];
  suggestedAssignees?: string[];
  overallConfidence: SectionConfidence;
}

interface EnrichedSection {
  content: string;
  confidence: SectionConfidence;
}

class IssueEnrichmentAIService {
  async enrichIssue(params: {
    issueTitle: string;
    issueDescription: string;
    projectContext?: string;
    repositoryLabels?: string[];
  }): Promise<EnrichedIssue> {
    // Decide preserve vs rewrite based on description length
    const preserveOriginal = (params.issueDescription?.length || 0) > 200;

    const result = await generateObject({
      model,
      system: ENRICHMENT_SYSTEM_PROMPT,
      prompt: formatEnrichmentPrompt(params, preserveOriginal),
      schema: EnrichedIssueSchema,
      temperature: 0.4,
    });

    // Calculate per-section confidence
    return this.addConfidenceScores(result.object, params);
  }
}
```

### Pattern 4: Relationship Type Detection

**What:** Detect multiple relationship types between issues: semantic similarity, dependency chains (blocks/blocked-by), and component grouping.

**When to use:** Related issue linking (AI-20).

**Source:** Research on issue relationships + graphlib patterns from Phase 9

**Example:**
```typescript
// Source: Research + graphlib patterns
interface IssueRelationship {
  sourceIssueId: string;
  targetIssueId: string;
  relationshipType: 'semantic' | 'dependency' | 'component';
  subType?: 'blocks' | 'blocked_by' | 'related_to';
  confidence: number;
  reasoning: string;
}

class RelatedIssueLinkingService {
  async findRelatedIssues(params: {
    issueId: string;
    issueTitle: string;
    issueDescription: string;
    repositoryIssues: Array<{ id: string; title: string; body: string; labels: string[] }>;
  }): Promise<RelatedIssueResult> {
    // 1. Semantic similarity via embeddings
    const semanticRelations = await this.findSemanticRelations(params);

    // 2. Dependency chains via keyword analysis
    const dependencyRelations = await this.detectDependencies(params);

    // 3. Component grouping via label/path analysis
    const componentRelations = this.detectComponentGrouping(params);

    return {
      relationships: [...semanticRelations, ...dependencyRelations, ...componentRelations],
      confidence: this.calculateOverallConfidence(semanticRelations, dependencyRelations),
    };
  }

  private async detectDependencies(params: any): Promise<IssueRelationship[]> {
    // Keywords indicating dependencies
    const blockingKeywords = ['prerequisite', 'requires', 'depends on', 'needs', 'blocked by'];
    const blocksKeywords = ['enables', 'unblocks', 'required for', 'blocks'];

    // Use AI to detect implicit dependencies
    // Fall back to keyword matching when AI unavailable
  }
}
```

### Anti-Patterns to Avoid

- **Embedding all issues on every request:** Cache embeddings with TTL; recompute only when issue content changes
- **Single similarity threshold:** Use tiered thresholds (high/medium/low) for different actions
- **Ignoring existing labels:** Always prefer matching existing repository labels over proposing new ones
- **Overwriting good descriptions:** Preserve original content when it's substantial; augment rather than replace
- **Blocking on AI unavailable:** Always provide pattern-based fallback for core functionality

## Don't Hand-Roll

Problems with existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cosine similarity | Custom vector math | `cosineSimilarity` from 'ai' | Tested, optimized for embeddings |
| Text embeddings | TF-IDF or custom encoding | OpenAI `text-embedding-3-small` | Much better semantic understanding |
| Keyword extraction | Regex patterns | AI structured extraction | Handles context, negation, synonyms |
| Similarity thresholds | Arbitrary cutoffs | Configurable with org defaults | Different projects need different sensitivity |

**Key insight:** The Vercel AI SDK provides embedding primitives that eliminate the need for custom similarity code. Focus on orchestration logic, not low-level vector operations.

## Common Pitfalls

### Pitfall 1: Embedding Cost Explosion

**What goes wrong:** Computing embeddings for all issues on every duplicate check causes high API costs.
**Why it happens:** Embeddings are relatively cheap per call, but scale quickly with issue count.
**How to avoid:**
1. Cache embeddings by issue ID with invalidation on content change
2. Batch embed multiple issues in single `embedMany` call
3. Pre-compute embeddings for existing issues during low-traffic periods
4. Set reasonable limits on issues to scan (e.g., last 1000, open issues only)
**Warning signs:** API costs spike when duplicate detection is enabled; slow response times.

### Pitfall 2: Label Suggestion Noise

**What goes wrong:** Too many low-confidence suggestions create noise and user fatigue.
**Why it happens:** AI tends to find patterns even when they're weak.
**How to avoid:**
1. Only surface high and medium confidence suggestions by default
2. Low confidence only shown if user explicitly requests
3. Track accept/reject rates to tune thresholds
4. Prefer existing labels over new label proposals (per CONTEXT.md)
**Warning signs:** Users ignoring suggestions; high rate of rejected labels.

### Pitfall 3: False Positive Duplicates

**What goes wrong:** System flags unrelated issues as duplicates due to superficial similarity.
**Why it happens:** Embeddings capture semantic similarity but miss domain-specific distinctions.
**How to avoid:**
1. Use tiered response (auto-link only at very high threshold: 0.92+)
2. Never auto-close; always flag for human review
3. Include title + description in embedding, not just title
4. Consider label overlap as additional signal
**Warning signs:** Users frequently unmarking duplicate flags; trust in system decreases.

### Pitfall 4: Ignoring Issue History

**What goes wrong:** Label suggestions don't improve over time.
**Why it happens:** System doesn't learn from user's accept/reject decisions.
**How to avoid:**
1. Track which suggestions users accept vs reject
2. Use historical labeling patterns as prompt context
3. Weight recent decisions higher than old ones
4. Consider per-organization learning (per CONTEXT.md: configurable at org level)
**Warning signs:** Same irrelevant labels suggested repeatedly despite rejections.

## Code Examples

### Verified Example 1: Embedding and Similarity Calculation

```typescript
// Source: https://ai-sdk.dev/docs/ai-sdk-core/embeddings
import { embed, embedMany, cosineSimilarity } from 'ai';
import { openai } from '@ai-sdk/openai';

// Single embedding
const { embedding } = await embed({
  model: openai.embeddingModel('text-embedding-3-small'),
  value: 'sunny day at the beach',
});

// Batch embedding (more efficient)
const { embeddings } = await embedMany({
  model: openai.embeddingModel('text-embedding-3-small'),
  values: ['text1', 'text2', 'text3'],
});

// Calculate similarity (-1 to 1, higher is more similar)
const similarity = cosineSimilarity(embeddings[0], embeddings[1]);
```

### Verified Example 2: Structured AI Response with Confidence

```typescript
// Source: Codebase BacklogPrioritizer.ts pattern
import { generateObject } from 'ai';
import { z } from 'zod';

const EnrichmentSchema = z.object({
  sections: z.object({
    problem: z.string(),
    solution: z.string().optional(),
    context: z.string().optional(),
    impact: z.string().optional(),
    acceptanceCriteria: z.array(z.string()),
  }),
  selfAssessment: z.object({
    confidence: z.number().min(0).max(1),
    uncertainAreas: z.array(z.string()),
  }),
});

const result = await generateObject({
  model,
  system: SYSTEM_PROMPT,
  prompt: formatPrompt(issueData),
  schema: EnrichmentSchema,
  temperature: 0.3, // Lower temperature for more consistent enrichment
});
```

### Verified Example 3: Fallback Pattern

```typescript
// Source: Codebase BacklogPrioritizer.ts pattern
async suggestLabels(params: LabelParams): Promise<LabelSuggestionResult> {
  const model = this.aiFactory.getModel('main') || this.aiFactory.getBestAvailableModel();

  if (!model) {
    // Fallback: keyword-based matching against existing labels
    return {
      high: this.keywordMatchLabels(params, 0.8),
      medium: this.keywordMatchLabels(params, 0.5),
      low: [],
      newLabelProposals: [],
      confidence: {
        sectionId: 'label-suggestions',
        sectionName: 'Label Suggestions',
        score: 40, // Lower confidence for fallback
        tier: 'low',
        factors: { inputCompleteness: 0.5, aiSelfAssessment: 0.3, patternMatch: 0.4 },
        reasoning: 'Fallback: AI unavailable, using keyword matching',
        needsReview: true,
      },
    };
  }

  // Full AI-powered suggestion
  // ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TF-IDF for duplicate detection | Embeddings + cosine similarity | 2023-2024 | Much better semantic matching |
| Rule-based labeling | AI + learning from history | 2024 | Higher accuracy, adapts to project |
| Simple keyword dependency | Graph + semantic analysis | 2025 | Catches implicit dependencies |
| Single confidence score | Per-section confidence | Phase 9 pattern | More actionable feedback |

**Current best practices:**
- Use embedding models (OpenAI text-embedding-3-small or larger) for semantic similarity
- Tiered confidence thresholds with different actions per tier
- Learn from user feedback (accept/reject rates)
- Always provide fallback when AI unavailable

**Research findings:**
- Simple retrieval-based approaches can beat sophisticated deep learning for duplicate detection ([ACM TOSEM 2023](https://dl.acm.org/doi/10.1145/3576042))
- Comments in bug reports improve duplicate detection accuracy
- Multi-label classification benefits from per-project personalization

## Open Questions

1. **Embedding Caching Strategy**
   - What we know: Embeddings should be cached to avoid recomputation
   - What's unclear: Where to store (memory? file? external service?)
   - Recommendation: Start with in-memory Map with optional file persistence (like ResourceCache pattern from Phase 5); add vector database if scale requires

2. **Duplicate Auto-Link Threshold**
   - What we know: High confidence should auto-link, medium should flag
   - What's unclear: Exact threshold values (0.9? 0.92? 0.95?)
   - Recommendation: Start conservative (0.92 for auto-link, 0.75 for review) and tune based on false positive rate; make configurable per org

3. **Issue History Scope for Learning**
   - What we know: Past labeling decisions improve suggestions
   - What's unclear: How much history is optimal? (100 issues? 1000? all time?)
   - Recommendation: Start with last 500 closed issues with labels; allow org configuration

4. **Related Issue Relationship Types**
   - What we know: Need semantic, dependency, and component relationships
   - What's unclear: How to weight different relationship types in combined relevance score
   - Recommendation: Per CONTEXT.md, this is Claude's discretion. Start with equal weights, tune based on user feedback

## Sources

### Primary (HIGH confidence)

- [AI SDK Core: Embeddings](https://ai-sdk.dev/docs/ai-sdk-core/embeddings) - Vercel AI SDK embedding functions
- [AI SDK Node: Embed Text](https://ai-sdk.dev/cookbook/node/embed-text) - Practical embedding examples
- Codebase: `src/services/ai/BacklogPrioritizer.ts` - Pattern for AI service with fallback
- Codebase: `src/domain/ai-types.ts` - SectionConfidence type for per-section scoring
- Codebase: `src/services/ai/ConfidenceScorer.ts` - Multi-factor confidence calculation

### Secondary (MEDIUM confidence)

- [Duplicate Bug Report Detection: How Far Are We? (ACM TOSEM)](https://dl.acm.org/doi/10.1145/3576042) - Research benchmark on duplicate detection
- [GitHub duplicatebugdetection](https://github.com/simplysuvi/duplicatebugdetection) - ML approach using title + description
- GitHub Community Discussion on Issue Dependencies - Context on relationship types users want

### Tertiary (LOW confidence)

- [Personalizing Label Prediction for GitHub Issues (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0950584922000192) - Research on personalized labeling (paper not accessible, abstract only)
- Various blog posts on embedding-based search - General patterns, not specific to issues

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - Uses existing installed packages, no new dependencies needed
- Architecture: HIGH - Follows established codebase patterns from Phase 9-10
- Duplicate Detection: MEDIUM - Approach is standard, thresholds need tuning
- Label Suggestions: MEDIUM - AI approach standard, learning-from-history design is custom
- Related Linking: MEDIUM - Multiple relationship types add complexity

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable domain, embeddings API unlikely to change)
