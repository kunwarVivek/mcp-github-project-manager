---
phase: 11-ai-issue-intelligence
plan: 03
status: complete
started: 2026-02-01T05:01:03Z
completed: 2026-02-01T05:08:54Z

subsystem: ai-services
tags: [embeddings, duplicate-detection, related-issues, caching, semantic-similarity]

dependency-graph:
  requires: [11-01]
  provides: [DuplicateDetectionService, RelatedIssueLinkingService, EmbeddingCache]
  affects: [11-04]

tech-stack:
  added:
    - text-embedding-3-small (OpenAI embedding model)
  patterns:
    - Embedding-based semantic similarity
    - Tiered confidence thresholds
    - TTL-based caching with content hash validation
    - Keyword-based fallback for AI unavailability

file-tracking:
  created:
    - src/cache/EmbeddingCache.ts
    - src/services/ai/DuplicateDetectionService.ts
    - src/services/ai/RelatedIssueLinkingService.ts

decisions:
  - id: embedding-model-choice
    choice: text-embedding-3-small
    rationale: Best cost/performance ratio for issue similarity
  - id: cache-ttl
    choice: 24 hours default
    rationale: Issues don't change frequently; balance freshness vs API costs
  - id: duplicate-thresholds
    choice: "high: 0.92, medium: 0.75"
    rationale: High threshold for auto-linking to prevent false positives
  - id: fallback-strategy
    choice: Jaccard keyword similarity
    rationale: Simple, no external dependencies, reasonable accuracy

metrics:
  duration: ~8 minutes
  completed: 2026-02-01
---

# Phase 11 Plan 03: Duplicate Detection and Related Issue Linking Summary

**One-liner:** Embedding-based duplicate detection and multi-type related issue linking services with caching and keyword fallback.

## What Was Built

### 1. EmbeddingCache (src/cache/EmbeddingCache.ts)
In-memory cache for issue embeddings with:
- **TTL-based expiration**: Default 24 hours, configurable
- **Content hash validation**: SHA256 hash of title+body to detect changed issues
- **LRU-style eviction**: Removes oldest 10% when max size exceeded (default 10k)
- **Static computeContentHash()**: Consistent hashing across services

### 2. DuplicateDetectionService (src/services/ai/DuplicateDetectionService.ts)
Embedding-based duplicate issue detection:
- **Primary method**: OpenAI text-embedding-3-small embeddings with cosine similarity
- **Tiered thresholds**: High (0.92+) for auto-link, Medium (0.75-0.92) for review, Low for context
- **Caching**: Uses EmbeddingCache to avoid recomputing embeddings
- **Fallback**: Jaccard keyword similarity when embeddings unavailable
- **Batch processing**: Uses embedMany() for efficient bulk embedding

### 3. RelatedIssueLinkingService (src/services/ai/RelatedIssueLinkingService.ts)
Multi-type relationship detection:
- **Semantic relationships**: Embedding similarity (threshold 0.75)
- **Dependency relationships**: Keyword detection + AI analysis for blocks/blocked_by/related_to
- **Component relationships**: Label overlap analysis
- **Configurable strategies**: Each detection type can be enabled/disabled
- **Deduplication**: Merges relationships, keeps highest confidence per target

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Embedding model | text-embedding-3-small | Best cost/performance for semantic similarity |
| Cache TTL | 24 hours | Issues rarely change; reduces API costs |
| High threshold | 0.92 | Prevents false positive auto-linking |
| Medium threshold | 0.75 | Reasonable cutoff for review suggestions |
| Fallback thresholds | 0.8/0.6 | Lower because keyword matching is less precise |

## Key Patterns

```typescript
// Embedding with caching pattern
const contentHash = EmbeddingCache.computeContentHash(title, body);
const cached = this.embeddingCache.get(issueId, contentHash);
if (cached) return cached;
// else compute and cache

// Tiered result pattern
if (similarity >= thresholds.high) {
  highConfidence.push(candidate);
} else if (similarity >= thresholds.medium) {
  mediumConfidence.push(candidate);
}

// Multi-strategy with fallback pattern
try {
  return await this.detectWithEmbeddings(params);
} catch (error) {
  return this.getFallbackDetection(params);
}
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 0a12c3f | feat | EmbeddingCache with TTL, content hash, LRU eviction |
| ecb5468 | feat | DuplicateDetectionService with embeddings and fallback |
| a15aa4d | feat | RelatedIssueLinkingService with 3 relationship types |

## Integration Points

**Imports from ai package:**
- `embed`, `embedMany`, `cosineSimilarity` for embedding operations
- `generateObject` for AI dependency analysis

**Uses from project:**
- `EmbeddingCache` for caching embeddings
- `ConfidenceScorer` for SectionConfidence generation
- `AIServiceFactory` for model access
- Types from `issue-intelligence-types.ts`
- Prompts from `IssueIntelligencePrompts.ts`

## Deviations from Plan

None - plan executed exactly as written.

## Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| src/cache/EmbeddingCache.ts | 245 | TTL-based embedding cache |
| src/services/ai/DuplicateDetectionService.ts | 469 | Semantic duplicate detection |
| src/services/ai/RelatedIssueLinkingService.ts | 671 | Multi-type relationship linking |

## Next Phase Readiness

Plan 11-04 can proceed. Services are complete and ready for MCP tool integration:
- `DuplicateDetectionService.detectDuplicates()` ready for `detect_duplicate_issues` tool
- `RelatedIssueLinkingService.findRelatedIssues()` ready for `find_related_issues` tool
