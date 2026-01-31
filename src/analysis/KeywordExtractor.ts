/**
 * Keyword patterns for detecting task dependencies
 */
interface DependencyPattern {
  keywords: string[];
  dependsOn: string[];  // Keywords this pattern typically depends on
  confidence: number;   // How confident we are in this pattern (0-1)
}

/**
 * Common dependency patterns in software development
 */
const DEPENDENCY_PATTERNS: DependencyPattern[] = [
  // Infrastructure/setup tasks
  {
    keywords: ['setup', 'infrastructure', 'init', 'configure', 'scaffold'],
    dependsOn: [],
    confidence: 0.9
  },
  // Database/schema tasks
  {
    keywords: ['database', 'schema', 'model', 'migration', 'db'],
    dependsOn: ['setup', 'infrastructure'],
    confidence: 0.85
  },
  // API/backend tasks
  {
    keywords: ['api', 'endpoint', 'route', 'controller', 'service', 'backend'],
    dependsOn: ['database', 'schema', 'model'],
    confidence: 0.8
  },
  // Frontend/UI tasks
  {
    keywords: ['ui', 'frontend', 'component', 'page', 'view', 'interface'],
    dependsOn: ['api', 'endpoint'],
    confidence: 0.75
  },
  // Integration tasks
  {
    keywords: ['integration', 'connect', 'wire', 'link'],
    dependsOn: ['api', 'ui', 'frontend', 'backend'],
    confidence: 0.7
  },
  // Testing tasks
  {
    keywords: ['test', 'testing', 'unit', 'integration', 'e2e', 'spec'],
    dependsOn: ['implement', 'create', 'build'],
    confidence: 0.85
  },
  // Documentation tasks
  {
    keywords: ['document', 'docs', 'readme', 'documentation'],
    dependsOn: ['implement', 'create', 'test'],
    confidence: 0.7
  },
  // Deployment tasks
  {
    keywords: ['deploy', 'release', 'publish', 'ship'],
    dependsOn: ['test', 'testing', 'documentation'],
    confidence: 0.9
  }
];

/**
 * Extract keywords from task title and description
 */
export function extractKeywords(text: string): string[] {
  const normalized = text.toLowerCase();

  // Remove common stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'this', 'that', 'these', 'those', 'it', 'its', 'which', 'who', 'whom',
    'what', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very'
  ]);

  // Extract words
  const words = normalized
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  return [...new Set(words)];
}

/**
 * Find matching dependency pattern for keywords
 */
export function findMatchingPattern(keywords: string[]): DependencyPattern | null {
  for (const pattern of DEPENDENCY_PATTERNS) {
    const matchCount = pattern.keywords.filter(k =>
      keywords.some(kw => kw.includes(k) || k.includes(kw))
    ).length;

    if (matchCount > 0) {
      return pattern;
    }
  }
  return null;
}

/**
 * Check if task B likely depends on task A based on keywords
 */
export function checkKeywordDependency(
  taskAKeywords: string[],
  taskBKeywords: string[]
): { likely: boolean; confidence: number; reason: string } {
  const patternB = findMatchingPattern(taskBKeywords);

  if (!patternB) {
    return { likely: false, confidence: 0, reason: 'No pattern match' };
  }

  // Check if task A matches any of B's dependency patterns
  const matchingDeps = patternB.dependsOn.filter(dep =>
    taskAKeywords.some(kw => kw.includes(dep) || dep.includes(kw))
  );

  if (matchingDeps.length > 0) {
    return {
      likely: true,
      confidence: patternB.confidence * (matchingDeps.length / Math.max(patternB.dependsOn.length, 1)),
      reason: `Task matches dependency pattern: ${matchingDeps.join(', ')}`
    };
  }

  return { likely: false, confidence: 0, reason: 'Keywords do not suggest dependency' };
}

/**
 * Get all dependency patterns for documentation
 */
export function getDependencyPatterns(): DependencyPattern[] {
  return [...DEPENDENCY_PATTERNS];
}
