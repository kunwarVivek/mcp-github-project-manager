import { z } from 'zod';

/**
 * Comprehensive Task Context Schemas for Runtime Validation
 * Addresses Technical Debt: Missing runtime validation for enhanced task context
 */

// ============================================================================
// Feature Context Schema
// ============================================================================

export const FeatureContextSchema = z.object({
  id: z.string().describe('Unique feature identifier'),
  title: z.string().min(3).describe('Feature title'),
  description: z.string().min(10).describe('Feature description'),
  userStories: z.array(z.string()).min(1).describe('Associated user stories'),
  businessValue: z.string().min(10).describe('Business value statement')
});

export type FeatureContext = z.infer<typeof FeatureContextSchema>;

// ============================================================================
// PRD Context Summary Schema
// ============================================================================

export const PRDContextSummarySchema = z.object({
  relevantObjectives: z.array(z.string()).min(1).describe('Relevant PRD objectives'),
  relevantRequirements: z.array(z.string()).min(1).describe('Relevant requirements'),
  scopeConstraints: z.array(z.string()).describe('Scope constraints and limitations')
});

export type PRDContextSummary = z.infer<typeof PRDContextSummarySchema>;

// ============================================================================
// Implementation Step Schema
// ============================================================================

export const ImplementationStepSchema = z.object({
  step: z.number().int().positive().describe('Step number'),
  title: z.string().min(3).describe('Step title'),
  description: z.string().min(10).describe('Detailed step description'),
  estimatedTime: z.string().describe('Estimated time for this step'),
  dependencies: z.array(z.string()).describe('Dependencies for this step')
});

export type ImplementationStep = z.infer<typeof ImplementationStepSchema>;

// ============================================================================
// Best Practice Schema
// ============================================================================

export const BestPracticeSchema = z.object({
  category: z.enum(['coding', 'architecture', 'security', 'performance', 'testing'])
    .describe('Category of best practice'),
  practice: z.string().min(10).describe('Best practice description'),
  rationale: z.string().min(10).describe('Why this practice is important')
});

export type BestPractice = z.infer<typeof BestPracticeSchema>;

// ============================================================================
// Common Pitfall Schema
// ============================================================================

export const CommonPitfallSchema = z.object({
  pitfall: z.string().min(10).describe('Description of the pitfall'),
  consequence: z.string().min(10).describe('What happens if you fall into this pitfall'),
  mitigation: z.string().min(10).describe('How to avoid or mitigate this pitfall')
});

export type CommonPitfall = z.infer<typeof CommonPitfallSchema>;

// ============================================================================
// Testing Strategy Schema
// ============================================================================

export const TestingStrategySchema = z.object({
  approach: z.string().min(20).describe('Overall testing approach'),
  testTypes: z.array(z.string()).min(1).describe('Types of tests needed'),
  coverage: z.string().describe('Required test coverage'),
  tools: z.array(z.string()).describe('Recommended testing tools')
});

export type TestingStrategy = z.infer<typeof TestingStrategySchema>;

// ============================================================================
// Implementation Guidance Schema (FR-3)
// ============================================================================

export const ImplementationGuidanceSchema = z.object({
  recommendedApproach: z.string().min(50)
    .describe('Overall implementation strategy and approach'),
  implementationSteps: z.array(z.string()).min(3)
    .describe('Step-by-step implementation guide'),
  technicalConsiderations: z.array(z.string()).min(1)
    .describe('Important technical points to consider'),
  commonPitfalls: z.array(z.string()).min(1)
    .describe('Common mistakes to avoid'),
  testingStrategy: z.string().min(20)
    .describe('How to test this implementation'),
  recommendedTools: z.array(z.string())
    .describe('Recommended tools and technologies'),
  codeQualityStandards: z.array(z.string())
    .describe('Quality checks and standards to maintain'),
  performanceConsiderations: z.array(z.string())
    .describe('Performance optimization considerations'),
  securityConsiderations: z.array(z.string())
    .describe('Security considerations and best practices')
});

export type ImplementationGuidance = z.infer<typeof ImplementationGuidanceSchema>;

// ============================================================================
// PRD Section Reference Schema
// ============================================================================

export const PRDSectionReferenceSchema = z.object({
  section: z.string().min(3).describe('PRD section name'),
  content: z.string().min(10).describe('Relevant content from the section'),
  relevance: z.string().min(20).describe('Why this section is relevant to the task'),
  importance: z.enum(['critical', 'high', 'medium', 'low'])
    .describe('Importance level of this reference')
});

export type PRDSectionReference = z.infer<typeof PRDSectionReferenceSchema>;

// ============================================================================
// Related Feature Schema
// ============================================================================

export const RelatedFeatureSchema = z.object({
  featureId: z.string().describe('Related feature identifier'),
  title: z.string().min(3).describe('Feature title'),
  relationship: z.enum(['implements', 'extends', 'integrates_with', 'depends_on', 'enables'])
    .describe('Type of relationship'),
  context: z.string().min(20).describe('Explanation of the relationship')
});

export type RelatedFeature = z.infer<typeof RelatedFeatureSchema>;

// ============================================================================
// Technical Specification Reference Schema
// ============================================================================

export const TechnicalSpecReferenceSchema = z.object({
  type: z.enum(['api_spec', 'data_model', 'architecture_doc', 'design_system', 'protocol'])
    .describe('Type of technical specification'),
  title: z.string().min(3).describe('Specification title'),
  description: z.string().min(10).describe('What this spec covers'),
  relevantSections: z.array(z.string()).describe('Specific relevant sections'),
  url: z.string().url().optional().describe('URL to the specification')
});

export type TechnicalSpecReference = z.infer<typeof TechnicalSpecReferenceSchema>;

// ============================================================================
// Code Example Schema
// ============================================================================

export const CodeExampleSchema = z.object({
  title: z.string().min(3).describe('Example title'),
  description: z.string().min(10).describe('What this example demonstrates'),
  language: z.string().describe('Programming language'),
  snippet: z.string().min(20).describe('Code snippet'),
  explanation: z.string().min(20).describe('Explanation of the code'),
  source: z.string().describe('Source or origin of the example')
});

export type CodeExample = z.infer<typeof CodeExampleSchema>;

// ============================================================================
// External Reference Schema
// ============================================================================

export const ExternalReferenceSchema = z.object({
  type: z.enum(['documentation', 'tutorial', 'best_practice', 'tool', 'library'])
    .describe('Type of external reference'),
  title: z.string().min(3).describe('Reference title'),
  description: z.string().min(10).describe('What this reference provides'),
  url: z.string().url().describe('URL to the resource'),
  relevance: z.string().min(20).describe('Why this is relevant to the task')
});

export type ExternalReference = z.infer<typeof ExternalReferenceSchema>;

// ============================================================================
// Contextual References Schema (FR-4)
// ============================================================================

export const ContextualReferencesSchema = z.object({
  prdSections: z.array(PRDSectionReferenceSchema)
    .describe('Relevant PRD sections with context'),
  relatedFeatures: z.array(RelatedFeatureSchema)
    .describe('Related features and their relationships'),
  technicalSpecs: z.array(TechnicalSpecReferenceSchema)
    .describe('Technical specification references'),
  codeExamples: z.array(CodeExampleSchema)
    .describe('Relevant code examples'),
  externalReferences: z.array(ExternalReferenceSchema)
    .describe('External documentation and resources')
});

export type ContextualReferences = z.infer<typeof ContextualReferencesSchema>;

// ============================================================================
// Enhanced Acceptance Criterion Schema
// ============================================================================

export const EnhancedAcceptanceCriterionSchema = z.object({
  id: z.string().describe('Unique criterion identifier'),
  category: z.enum(['functional', 'technical', 'quality', 'integration', 'performance', 'security'])
    .describe('Category of acceptance criterion'),
  description: z.string().min(20).describe('Clear, testable description'),
  verificationMethod: z.enum([
    'unit_test',
    'integration_test',
    'manual_test',
    'code_review',
    'demo',
    'automated_test'
  ]).describe('How to verify this criterion'),
  verificationDetails: z.string().min(20)
    .describe('Detailed verification instructions'),
  priority: z.enum(['must_have', 'should_have', 'nice_to_have'])
    .describe('Priority level'),
  acceptanceThreshold: z.string().min(10)
    .describe('Specific threshold or success condition'),
  testingNotes: z.string().optional()
    .describe('Additional testing notes')
});

export type EnhancedAcceptanceCriterion = z.infer<typeof EnhancedAcceptanceCriterionSchema>;

// ============================================================================
// Enhanced Acceptance Criteria Collection Schema (FR-5)
// ============================================================================

export const EnhancedAcceptanceCriteriaSchema = z.object({
  criteria: z.array(EnhancedAcceptanceCriterionSchema).min(1)
    .describe('Collection of enhanced acceptance criteria'),
  coverageAnalysis: z.object({
    functionalCoverage: z.number().min(0).max(100).describe('% functional requirements covered'),
    technicalCoverage: z.number().min(0).max(100).describe('% technical requirements covered'),
    qualityCoverage: z.number().min(0).max(100).describe('% quality requirements covered')
  }).optional().describe('Coverage analysis metrics')
});

export type EnhancedAcceptanceCriteria = z.infer<typeof EnhancedAcceptanceCriteriaSchema>;

// ============================================================================
// Dependency Context Schema
// ============================================================================

export const DependencySchema = z.object({
  dependencyId: z.string().describe('ID of the dependency'),
  dependencyTitle: z.string().min(3).describe('Title of the dependency'),
  dependencyType: z.enum(['blocks', 'required_by', 'relates_to', 'implements'])
    .describe('Type of dependency'),
  rationale: z.string().min(20)
    .describe('Why this dependency exists'),
  providedBy: z.string().min(10)
    .describe('What the dependent task provides'),
  integrationGuidance: z.string().min(20)
    .describe('How to integrate with this dependency'),
  interfaces: z.array(z.string())
    .describe('Integration interfaces or contracts'),
  canRunInParallel: z.boolean()
    .describe('Whether this can be worked on in parallel')
});

export type Dependency = z.infer<typeof DependencySchema>;

// ============================================================================
// Dependency Context Schema (FR-6)
// ============================================================================

export const DependencyContextSchema = z.object({
  dependencies: z.array(DependencySchema)
    .describe('Detailed dependency information'),
  parallelOpportunities: z.array(z.object({
    taskIds: z.array(z.string()).min(2).describe('Tasks that can run in parallel'),
    reason: z.string().min(20).describe('Why these can run in parallel'),
    considerations: z.array(z.string()).describe('Things to consider when parallelizing')
  })).describe('Opportunities for parallel work'),
  criticalPath: z.array(z.string())
    .describe('Critical path task IDs'),
  estimatedUnblockDate: z.string().optional()
    .describe('When dependencies are expected to be resolved')
});

export type DependencyContext = z.infer<typeof DependencyContextSchema>;

// ============================================================================
// Complete Task Execution Context Schema
// ============================================================================

export const TaskExecutionContextSchema = z.object({
  // Business Context (FR-1)
  businessObjective: z.string().min(20)
    .describe('Primary business objective this task supports'),
  userImpact: z.string().min(20)
    .describe('Specific impact on end users'),
  successMetrics: z.array(z.string()).min(1)
    .describe('Measurable success indicators'),

  // Feature Context
  parentFeature: FeatureContextSchema
    .describe('Parent feature information'),

  // Technical Context (FR-2)
  technicalConstraints: z.array(z.string()).min(1)
    .describe('Technical limitations and requirements'),
  architecturalDecisions: z.array(z.string())
    .describe('Relevant architectural decisions'),
  integrationPoints: z.array(z.string())
    .describe('System integration requirements'),
  dataRequirements: z.array(z.string())
    .describe('Data-related requirements'),

  // PRD Context Summary
  prdContextSummary: PRDContextSummarySchema
    .describe('Summary of relevant PRD content'),

  // Enhanced Context (Optional - requires AI)
  implementationGuidance: ImplementationGuidanceSchema.optional()
    .describe('AI-generated implementation guidance (FR-3)'),
  contextualReferences: ContextualReferencesSchema.optional()
    .describe('Contextual references to PRD, specs, examples (FR-4)'),
  enhancedAcceptanceCriteria: EnhancedAcceptanceCriteriaSchema.optional()
    .describe('Enhanced acceptance criteria with verification (FR-5)'),
  dependencyContext: DependencyContextSchema.optional()
    .describe('Enhanced dependency context (FR-6)')
});

export type TaskExecutionContext = z.infer<typeof TaskExecutionContextSchema>;

// ============================================================================
// Context Quality Metrics Schema
// ============================================================================

export const ContextQualityMetricsSchema = z.object({
  completenessScore: z.number().min(0).max(100)
    .describe('% of required context fields populated (target: 95%)'),
  accuracyScore: z.number().min(0).max(100).optional()
    .describe('Context accuracy score (target: 90%)'),
  relevanceScore: z.number().min(0).max(100).optional()
    .describe('Context relevance score (target: 85%)'),
  generationTime: z.number().positive()
    .describe('Time taken to generate context in seconds (target: <30s)'),
  tokenUsage: z.number().int().positive()
    .describe('Number of tokens used (target: <2000)'),
  cacheHit: z.boolean()
    .describe('Whether this context was retrieved from cache'),
  aiEnhanced: z.boolean()
    .describe('Whether AI enhancement was used'),
  errors: z.array(z.string())
    .describe('Any errors encountered during generation'),
  warnings: z.array(z.string())
    .describe('Any warnings or issues')
});

export type ContextQualityMetrics = z.infer<typeof ContextQualityMetricsSchema>;

// ============================================================================
// Enhanced Task with Context Schema
// ============================================================================

export const EnhancedTaskWithContextSchema = z.object({
  id: z.string().describe('Unique task identifier'),
  title: z.string().min(3).describe('Task title'),
  description: z.string().min(10).describe('Task description'),
  complexity: z.number().int().min(1).max(10).describe('Task complexity (1-10)'),
  estimatedHours: z.number().positive().describe('Estimated hours to complete'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).describe('Task priority'),

  // Execution Context
  executionContext: TaskExecutionContextSchema
    .describe('Complete execution context for the task'),

  // Quality Metrics
  contextQuality: ContextQualityMetricsSchema.optional()
    .describe('Quality metrics for generated context'),

  // Metadata
  generatedAt: z.string().datetime().describe('When this task was generated'),
  generatedBy: z.string().describe('What generated this task'),
  version: z.number().int().positive().default(1).describe('Schema version')
});

export type EnhancedTaskWithContext = z.infer<typeof EnhancedTaskWithContextSchema>;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate task execution context
 */
export function validateTaskExecutionContext(context: unknown): TaskExecutionContext {
  return TaskExecutionContextSchema.parse(context);
}

/**
 * Safe validation that returns errors instead of throwing
 */
export function safeValidateTaskExecutionContext(
  context: unknown
): { success: true; data: TaskExecutionContext } | { success: false; errors: string[] } {
  const result = TaskExecutionContextSchema.safeParse(context);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return {
      success: false,
      errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
    };
  }
}

/**
 * Calculate context completeness score
 */
export function calculateCompletenessScore(context: Partial<TaskExecutionContext>): number {
  const requiredFields = [
    'businessObjective',
    'userImpact',
    'successMetrics',
    'parentFeature',
    'technicalConstraints',
    'architecturalDecisions',
    'integrationPoints',
    'dataRequirements',
    'prdContextSummary'
  ];

  const optionalButValuableFields = [
    'implementationGuidance',
    'contextualReferences',
    'enhancedAcceptanceCriteria',
    'dependencyContext'
  ];

  const allFields = [...requiredFields, ...optionalButValuableFields];

  const populatedRequired = requiredFields.filter(field => {
    const value = context[field as keyof TaskExecutionContext];
    return value !== undefined && value !== null && (
      typeof value !== 'object' ||
      (Array.isArray(value) && value.length > 0) ||
      (!Array.isArray(value) && Object.keys(value).length > 0)
    );
  }).length;

  const populatedOptional = optionalButValuableFields.filter(field => {
    const value = context[field as keyof TaskExecutionContext];
    return value !== undefined && value !== null;
  }).length;

  // Required fields worth 70%, optional fields worth 30%
  const requiredScore = (populatedRequired / requiredFields.length) * 70;
  const optionalScore = (populatedOptional / optionalButValuableFields.length) * 30;

  return Math.round(requiredScore + optionalScore);
}

/**
 * Validate context meets quality thresholds
 */
export function meetsQualityThresholds(context: Partial<TaskExecutionContext>): {
  passes: boolean;
  score: number;
  issues: string[];
} {
  const score = calculateCompletenessScore(context);
  const issues: string[] = [];

  // PRD target: 95% completeness
  if (score < 95) {
    issues.push(`Completeness score ${score}% is below target of 95%`);
  }

  // Check required field lengths
  if (context.businessObjective && context.businessObjective.length < 20) {
    issues.push('Business objective too short (minimum 20 characters)');
  }

  if (context.userImpact && context.userImpact.length < 20) {
    issues.push('User impact too short (minimum 20 characters)');
  }

  if (context.successMetrics && context.successMetrics.length === 0) {
    issues.push('No success metrics defined');
  }

  return {
    passes: issues.length === 0 && score >= 95,
    score,
    issues
  };
}

/**
 * Get missing context fields
 */
export function getMissingFields(context: Partial<TaskExecutionContext>): string[] {
  const requiredFields = [
    'businessObjective',
    'userImpact',
    'successMetrics',
    'parentFeature',
    'technicalConstraints',
    'architecturalDecisions',
    'integrationPoints',
    'dataRequirements',
    'prdContextSummary'
  ];

  return requiredFields.filter(field => {
    const value = context[field as keyof TaskExecutionContext];
    return value === undefined || value === null || (
      Array.isArray(value) && value.length === 0
    );
  });
}
