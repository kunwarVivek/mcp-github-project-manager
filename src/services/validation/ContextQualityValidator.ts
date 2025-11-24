import {
  TaskExecutionContext,
  ContextQualityMetrics,
  calculateCompletenessScore,
  meetsQualityThresholds,
  getMissingFields
} from '../../domain/task-context-schemas';
import { AITask } from '../../domain/ai-types';

/**
 * Quality thresholds from PRD requirements
 */
export const QUALITY_THRESHOLDS = {
  COMPLETENESS_TARGET: 95, // PRD requirement: 95% of required context fields populated
  ACCURACY_TARGET: 90,     // PRD requirement: 90% accuracy validated
  RELEVANCE_TARGET: 85,    // PRD requirement: 85% rated as "highly relevant"
  GENERATION_TIME_MAX: 30, // PRD requirement: < 30 seconds per task
  TOKEN_USAGE_MAX: 2000,   // PRD requirement: < 2000 tokens per task
  ERROR_RATE_MAX: 5        // PRD requirement: < 5% error rate
};

/**
 * Validation result interface
 */
export interface ValidationResult {
  passes: boolean;
  score: number;
  issues: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Quality report interface
 */
export interface QualityReport {
  taskId: string;
  taskTitle: string;
  metrics: ContextQualityMetrics;
  validation: {
    completeness: ValidationResult;
    accuracy: ValidationResult;
    relevance: ValidationResult;
    performance: ValidationResult;
  };
  overallScore: number;
  overallPasses: boolean;
  recommendations: string[];
}

/**
 * Validates context quality against PRD requirements (Phase 4: Quality & Validation)
 *
 * Validates:
 * - Completeness: 95% of required fields populated
 * - Accuracy: Context is correct and consistent
 * - Relevance: Context is relevant to the task
 * - Performance: Generation time and token usage within limits
 */
export class ContextQualityValidator {
  /**
   * Validate task execution context completeness
   */
  validateCompleteness(context: Partial<TaskExecutionContext>): ValidationResult {
    const score = calculateCompletenessScore(context);
    const missingFields = getMissingFields(context);
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check against PRD threshold: 95%
    if (score < QUALITY_THRESHOLDS.COMPLETENESS_TARGET) {
      issues.push(
        `Completeness score ${score}% is below target of ${QUALITY_THRESHOLDS.COMPLETENESS_TARGET}%`
      );
    }

    // Check required fields
    if (missingFields.length > 0) {
      issues.push(`Missing required fields: ${missingFields.join(', ')}`);
      suggestions.push(`Populate missing fields: ${missingFields.join(', ')}`);
    }

    // Check field quality
    if (context.businessObjective && context.businessObjective.length < 20) {
      warnings.push('Business objective is too short (minimum 20 characters recommended)');
      suggestions.push('Expand business objective with more detail about WHY this task matters');
    }

    if (context.userImpact && context.userImpact.length < 20) {
      warnings.push('User impact is too short (minimum 20 characters recommended)');
      suggestions.push('Provide specific details about HOW this affects end users');
    }

    if (context.successMetrics && context.successMetrics.length === 0) {
      issues.push('No success metrics defined');
      suggestions.push('Add at least one measurable success metric');
    }

    // Check optional but valuable fields
    if (!context.implementationGuidance) {
      warnings.push('No implementation guidance provided');
      suggestions.push('Add implementation guidance for better developer experience');
    }

    if (!context.contextualReferences) {
      warnings.push('No contextual references provided');
      suggestions.push('Add PRD references and code examples');
    }

    if (!context.enhancedAcceptanceCriteria) {
      warnings.push('No enhanced acceptance criteria provided');
      suggestions.push('Add detailed acceptance criteria with verification methods');
    }

    return {
      passes: issues.length === 0 && score >= QUALITY_THRESHOLDS.COMPLETENESS_TARGET,
      score,
      issues,
      warnings,
      suggestions
    };
  }

  /**
   * Validate context accuracy
   */
  validateAccuracy(
    context: TaskExecutionContext,
    task: AITask
  ): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Validate consistency between fields
    const taskTitleLower = task.title.toLowerCase();
    const taskDescLower = task.description.toLowerCase();

    // Check if business objective aligns with task
    if (context.businessObjective) {
      const hasTaskKeywords = this.containsKeywords(
        context.businessObjective.toLowerCase(),
        this.extractKeywords(taskTitleLower + ' ' + taskDescLower)
      );

      if (!hasTaskKeywords) {
        warnings.push('Business objective may not align with task title/description');
        score -= 10;
        suggestions.push('Ensure business objective relates to the specific task');
      }
    }

    // Check if technical constraints are realistic
    if (context.technicalConstraints.length === 0) {
      warnings.push('No technical constraints identified - may be incomplete');
      score -= 5;
    }

    // Check if implementation guidance aligns with complexity
    if (context.implementationGuidance) {
      const guidanceSteps = context.implementationGuidance.implementationSteps.length;
      const complexity = task.complexity;

      if (complexity >= 7 && guidanceSteps < 3) {
        warnings.push('High complexity task has minimal implementation guidance');
        score -= 10;
        suggestions.push('Add more detailed implementation steps for complex tasks');
      }

      if (complexity <= 3 && guidanceSteps > 5) {
        warnings.push('Low complexity task has excessive implementation steps');
        score -= 5;
      }
    }

    // Check for placeholder or generic content
    const genericPhrases = [
      'to be determined',
      'tbd',
      'placeholder',
      'todo',
      'not specified',
      'unknown'
    ];

    const allText = JSON.stringify(context).toLowerCase();
    for (const phrase of genericPhrases) {
      if (allText.includes(phrase)) {
        issues.push(`Contains placeholder text: "${phrase}"`);
        score -= 15;
      }
    }

    // Accuracy score should meet PRD target: 90%
    const passes = issues.length === 0 && score >= QUALITY_THRESHOLDS.ACCURACY_TARGET;

    return {
      passes,
      score,
      issues,
      warnings,
      suggestions
    };
  }

  /**
   * Validate context relevance to task
   */
  validateRelevance(
    context: TaskExecutionContext,
    task: AITask
  ): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    const taskKeywords = this.extractKeywords(
      `${task.title} ${task.description}`.toLowerCase()
    );

    // Check business context relevance
    if (context.businessObjective) {
      const objectiveKeywords = this.extractKeywords(context.businessObjective.toLowerCase());
      const overlap = this.calculateKeywordOverlap(taskKeywords, objectiveKeywords);

      if (overlap < 0.2) {
        warnings.push('Business objective has low relevance to task (low keyword overlap)');
        score -= 15;
        suggestions.push('Ensure business objective directly relates to the task');
      }
    }

    // Check technical context relevance
    const techContextText = [
      ...context.technicalConstraints,
      ...context.architecturalDecisions,
      ...context.integrationPoints
    ].join(' ').toLowerCase();

    if (techContextText.length > 0) {
      const techKeywords = this.extractKeywords(techContextText);
      const overlap = this.calculateKeywordOverlap(taskKeywords, techKeywords);

      if (overlap < 0.15) {
        warnings.push('Technical context has low relevance to task');
        score -= 10;
      }
    }

    // Check code examples relevance (if provided)
    if (context.contextualReferences?.codeExamples) {
      const exampleTexts = context.contextualReferences.codeExamples
        .map(ex => `${ex.title} ${ex.description}`.toLowerCase())
        .join(' ');

      const exampleKeywords = this.extractKeywords(exampleTexts);
      const overlap = this.calculateKeywordOverlap(taskKeywords, exampleKeywords);

      if (overlap < 0.1) {
        warnings.push('Code examples may not be relevant to task');
        score -= 10;
        suggestions.push('Ensure code examples match task requirements');
      }
    }

    // Relevance score should meet PRD target: 85%
    const passes = issues.length === 0 && score >= QUALITY_THRESHOLDS.RELEVANCE_TARGET;

    return {
      passes,
      score,
      issues,
      warnings,
      suggestions
    };
  }

  /**
   * Validate performance metrics
   */
  validatePerformance(metrics: ContextQualityMetrics): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check generation time: PRD requirement < 30 seconds
    if (metrics.generationTime > QUALITY_THRESHOLDS.GENERATION_TIME_MAX) {
      issues.push(
        `Generation time ${metrics.generationTime}s exceeds target of ${QUALITY_THRESHOLDS.GENERATION_TIME_MAX}s`
      );
      score -= 20;
      suggestions.push('Optimize AI prompts or enable caching to improve generation time');
    } else if (metrics.generationTime > QUALITY_THRESHOLDS.GENERATION_TIME_MAX * 0.8) {
      warnings.push(`Generation time ${metrics.generationTime}s is approaching limit`);
      score -= 5;
    }

    // Check token usage: PRD requirement < 2000 tokens
    if (metrics.tokenUsage > QUALITY_THRESHOLDS.TOKEN_USAGE_MAX) {
      issues.push(
        `Token usage ${metrics.tokenUsage} exceeds target of ${QUALITY_THRESHOLDS.TOKEN_USAGE_MAX}`
      );
      score -= 20;
      suggestions.push('Reduce prompt size or implement token optimization');
    } else if (metrics.tokenUsage > QUALITY_THRESHOLDS.TOKEN_USAGE_MAX * 0.8) {
      warnings.push(`Token usage ${metrics.tokenUsage} is approaching limit`);
      score -= 5;
    }

    // Check for errors
    if (metrics.errors.length > 0) {
      issues.push(`Generation errors encountered: ${metrics.errors.join(', ')}`);
      score -= 30;
    }

    // Check cache usage
    if (!metrics.cacheHit && metrics.aiEnhanced) {
      warnings.push('AI-enhanced context was not cached (performance opportunity)');
      suggestions.push('Enable context caching to improve performance');
    }

    const passes = issues.length === 0 && score >= 70; // 70% minimum for performance

    return {
      passes,
      score,
      issues,
      warnings,
      suggestions
    };
  }

  /**
   * Generate comprehensive quality report
   */
  generateQualityReport(
    task: AITask,
    context: TaskExecutionContext,
    metrics: ContextQualityMetrics
  ): QualityReport {
    const completeness = this.validateCompleteness(context);
    const accuracy = this.validateAccuracy(context, task);
    const relevance = this.validateRelevance(context, task);
    const performance = this.validatePerformance(metrics);

    // Calculate overall score (weighted average)
    const overallScore = Math.round(
      completeness.score * 0.35 +  // Completeness: 35%
      accuracy.score * 0.30 +       // Accuracy: 30%
      relevance.score * 0.25 +      // Relevance: 25%
      performance.score * 0.10      // Performance: 10%
    );

    const overallPasses =
      completeness.passes &&
      accuracy.passes &&
      relevance.passes &&
      performance.passes;

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      completeness,
      accuracy,
      relevance,
      performance
    );

    return {
      taskId: task.id || task.title,
      taskTitle: task.title,
      metrics,
      validation: {
        completeness,
        accuracy,
        relevance,
        performance
      },
      overallScore,
      overallPasses,
      recommendations
    };
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(
    completeness: ValidationResult,
    accuracy: ValidationResult,
    relevance: ValidationResult,
    performance: ValidationResult
  ): string[] {
    const recommendations: string[] = [];

    // Priority: Critical issues first
    if (!completeness.passes) {
      recommendations.push(
        '🔴 CRITICAL: Improve context completeness to meet 95% target',
        ...completeness.suggestions
      );
    }

    if (!accuracy.passes) {
      recommendations.push(
        '🔴 CRITICAL: Address accuracy issues to meet 90% target',
        ...accuracy.suggestions
      );
    }

    if (!relevance.passes) {
      recommendations.push(
        '🟡 HIGH: Improve context relevance to meet 85% target',
        ...relevance.suggestions
      );
    }

    if (!performance.passes) {
      recommendations.push(
        '🟡 HIGH: Optimize performance to meet PRD targets',
        ...performance.suggestions
      );
    }

    // Add general recommendations if quality is good
    if (completeness.passes && accuracy.passes && relevance.passes && performance.passes) {
      recommendations.push(
        '✅ Context quality meets all PRD requirements',
        'Consider adding more code examples for enhanced developer experience',
        'Review periodically to ensure continued quality'
      );
    }

    return recommendations;
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): Set<string> {
    // Remove common words and extract meaningful keywords
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'should', 'could', 'may', 'might', 'can', 'this', 'that'
    ]);

    return new Set(
      text
        .toLowerCase()
        .split(/\W+/)
        .filter(word => word.length > 3 && !commonWords.has(word))
    );
  }

  /**
   * Check if text contains keywords
   */
  private containsKeywords(text: string, keywords: Set<string>): boolean {
    const textWords = this.extractKeywords(text);
    for (const keyword of keywords) {
      if (textWords.has(keyword)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate keyword overlap between two sets
   */
  private calculateKeywordOverlap(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 || set2.size === 0) {
      return 0;
    }

    const intersection = new Set([...set1].filter(k => set2.has(k)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }
}
