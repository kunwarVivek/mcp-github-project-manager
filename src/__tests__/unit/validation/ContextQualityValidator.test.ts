import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  ContextQualityValidator,
  QUALITY_THRESHOLDS,
  ValidationResult,
  QualityReport
} from '../../../services/validation/ContextQualityValidator';
import {
  TaskExecutionContext,
  ContextQualityMetrics,
  FeatureContext,
  PRDContextSummary,
  ImplementationGuidance,
  ContextualReferences,
  EnhancedAcceptanceCriteria
} from '../../../domain/task-context-schemas';
import { AITask, TaskStatus, TaskPriority } from '../../../domain/ai-types';

describe('ContextQualityValidator', () => {
  let validator: ContextQualityValidator;

  // Helper to create a valid feature context
  const createFeatureContext = (): FeatureContext => ({
    id: 'feature-1',
    title: 'User Authentication Feature',
    description: 'Complete user authentication with OAuth support',
    userStories: ['As a user, I can log in with my credentials'],
    businessValue: 'Enable secure user access to the platform'
  });

  // Helper to create a valid PRD context summary
  const createPRDContextSummary = (): PRDContextSummary => ({
    relevantObjectives: ['Enable secure user authentication'],
    relevantRequirements: ['Support OAuth 2.0', 'Password reset functionality'],
    scopeConstraints: ['No third-party SSO in MVP']
  });

  // Helper to create implementation guidance
  const createImplementationGuidance = (): ImplementationGuidance => ({
    recommendedApproach: 'Use JWT tokens with refresh token rotation for secure session management. Implement OAuth 2.0 flow for social login.',
    implementationSteps: [
      'Set up authentication middleware',
      'Create JWT token service',
      'Implement login and registration endpoints'
    ],
    technicalConsiderations: ['Token expiration strategy'],
    commonPitfalls: ['Not validating token signature properly'],
    testingStrategy: 'Unit test token generation and validation',
    recommendedTools: ['jsonwebtoken', 'passport'],
    codeQualityStandards: ['100% test coverage for auth'],
    performanceConsiderations: ['Cache token validation'],
    securityConsiderations: ['Use secure cookies', 'Implement rate limiting']
  });

  // Helper to create contextual references
  const createContextualReferences = (): ContextualReferences => ({
    prdSections: [{
      section: 'Authentication Requirements',
      content: 'Users must be able to authenticate using email/password',
      relevance: 'Directly specifies the authentication requirements for this task',
      importance: 'critical'
    }],
    relatedFeatures: [{
      featureId: 'feature-2',
      title: 'User Profile',
      relationship: 'depends_on',
      context: 'User profile depends on authentication being in place'
    }],
    technicalSpecs: [{
      type: 'api_spec',
      title: 'Auth API Specification',
      description: 'REST API spec for authentication endpoints',
      relevantSections: ['POST /auth/login', 'POST /auth/register']
    }],
    codeExamples: [{
      title: 'JWT Token Generation',
      description: 'Example of generating a JWT token',
      language: 'typescript',
      snippet: 'const token = jwt.sign({ userId }, secret, { expiresIn: "1h" });',
      explanation: 'Creates a signed JWT token with user ID and 1 hour expiration',
      source: 'internal'
    }],
    externalReferences: [{
      type: 'documentation',
      title: 'JWT Best Practices',
      description: 'Official JWT security best practices',
      url: 'https://jwt.io/introduction',
      relevance: 'Provides security guidelines for JWT implementation'
    }]
  });

  // Helper to create enhanced acceptance criteria
  const createEnhancedAcceptanceCriteria = (): EnhancedAcceptanceCriteria => ({
    criteria: [{
      id: 'AC-1',
      category: 'functional',
      description: 'User can log in with valid credentials and receive a JWT token',
      verificationMethod: 'integration_test',
      verificationDetails: 'Test login endpoint with valid credentials',
      priority: 'must_have',
      acceptanceThreshold: 'Login succeeds with 200 status'
    }]
  });

  // Helper to create dependency context
  const createDependencyContext = () => ({
    dependencies: [{
      dependencyId: 'dep-1',
      dependencyTitle: 'User Service Setup',
      dependencyType: 'blocks' as const,
      rationale: 'Need user service running before implementing authentication',
      providedBy: 'User management infrastructure',
      integrationGuidance: 'Import user service and use its APIs',
      interfaces: ['UserService', 'UserRepository'],
      canRunInParallel: false
    }],
    parallelOpportunities: [],
    criticalPath: ['dep-1', 'task-1'],
    estimatedUnblockDate: '2024-01-15T00:00:00Z'
  });

  // Helper to create valid task execution context
  const createValidContext = (overrides?: Partial<TaskExecutionContext>): TaskExecutionContext => ({
    businessObjective: 'Enable users to securely authenticate and access personalized features',
    userImpact: 'Users can log in and access their personal data securely',
    successMetrics: ['90% login success rate', 'Under 2s login latency'],
    parentFeature: createFeatureContext(),
    technicalConstraints: ['Must use HTTPS', 'Token expiry under 1 hour'],
    architecturalDecisions: ['JWT for stateless auth', 'Redis for session cache'],
    integrationPoints: ['OAuth providers', 'User database'],
    dataRequirements: ['User credentials table', 'Session storage'],
    prdContextSummary: createPRDContextSummary(),
    implementationGuidance: createImplementationGuidance(),
    contextualReferences: createContextualReferences(),
    enhancedAcceptanceCriteria: createEnhancedAcceptanceCriteria(),
    dependencyContext: createDependencyContext(),
    ...overrides
  });

  // Helper to create a mock task
  const createMockTask = (overrides?: Partial<AITask>): AITask => ({
    id: 'task-1',
    title: 'Implement User Authentication',
    description: 'Add user login and registration with JWT tokens',
    status: TaskStatus.PENDING,
    priority: TaskPriority.HIGH,
    complexity: 7,
    estimatedHours: 16,
    aiGenerated: false,
    subtasks: [],
    dependencies: [],
    acceptanceCriteria: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    tags: [],
    ...overrides
  });

  // Helper to create quality metrics
  const createQualityMetrics = (overrides?: Partial<ContextQualityMetrics>): ContextQualityMetrics => ({
    completenessScore: 95,
    generationTime: 10,
    tokenUsage: 1500,
    cacheHit: false,
    aiEnhanced: true,
    errors: [],
    warnings: [],
    ...overrides
  });

  beforeEach(() => {
    validator = new ContextQualityValidator();
  });

  describe('QUALITY_THRESHOLDS', () => {
    it('should have correct PRD-defined thresholds', () => {
      expect(QUALITY_THRESHOLDS.COMPLETENESS_TARGET).toBe(95);
      expect(QUALITY_THRESHOLDS.ACCURACY_TARGET).toBe(90);
      expect(QUALITY_THRESHOLDS.RELEVANCE_TARGET).toBe(85);
      expect(QUALITY_THRESHOLDS.GENERATION_TIME_MAX).toBe(30);
      expect(QUALITY_THRESHOLDS.TOKEN_USAGE_MAX).toBe(2000);
      expect(QUALITY_THRESHOLDS.ERROR_RATE_MAX).toBe(5);
    });
  });

  describe('validateCompleteness', () => {
    it('should pass for complete context', () => {
      const context = createValidContext();

      const result = validator.validateCompleteness(context);

      // Debug: check score and issues
      if (!result.passes) {
        console.log('Completeness score:', result.score);
        console.log('Issues:', result.issues);
        console.log('Warnings:', result.warnings);
      }

      // With all fields populated, we should reach 100%
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
      expect(result.passes).toBe(true);
    });

    it('should fail for context missing required fields', () => {
      const context: Partial<TaskExecutionContext> = {
        businessObjective: 'Some objective',
        userImpact: 'Some impact'
        // Missing most required fields
      };

      const result = validator.validateCompleteness(context);

      expect(result.passes).toBe(false);
      expect(result.score).toBeLessThan(QUALITY_THRESHOLDS.COMPLETENESS_TARGET);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should warn about short business objective', () => {
      const context = createValidContext({
        businessObjective: 'Short objective' // Less than 20 chars
      });

      const result = validator.validateCompleteness(context);

      expect(result.warnings.some(w => w.includes('Business objective'))).toBe(true);
    });

    it('should warn about short user impact', () => {
      const context = createValidContext({
        userImpact: 'Short impact' // Less than 20 chars
      });

      const result = validator.validateCompleteness(context);

      expect(result.warnings.some(w => w.includes('User impact'))).toBe(true);
    });

    it('should report issue for empty success metrics', () => {
      const context = createValidContext({
        successMetrics: []
      });

      const result = validator.validateCompleteness(context);

      expect(result.issues.some(i => i.includes('success metrics'))).toBe(true);
    });

    it('should warn about missing implementation guidance', () => {
      const context = createValidContext();
      delete (context as any).implementationGuidance;

      const result = validator.validateCompleteness(context);

      expect(result.warnings.some(w => w.includes('implementation guidance'))).toBe(true);
    });

    it('should warn about missing contextual references', () => {
      const context = createValidContext();
      delete (context as any).contextualReferences;

      const result = validator.validateCompleteness(context);

      expect(result.warnings.some(w => w.includes('contextual references'))).toBe(true);
    });

    it('should warn about missing enhanced acceptance criteria', () => {
      const context = createValidContext();
      delete (context as any).enhancedAcceptanceCriteria;

      const result = validator.validateCompleteness(context);

      expect(result.warnings.some(w => w.includes('acceptance criteria'))).toBe(true);
    });

    it('should provide suggestions for improvements', () => {
      const context: Partial<TaskExecutionContext> = {
        businessObjective: 'Test',
        userImpact: 'Test'
      };

      const result = validator.validateCompleteness(context);

      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('validateAccuracy', () => {
    it('should pass for accurate context', () => {
      const context = createValidContext();
      const task = createMockTask();

      const result = validator.validateAccuracy(context, task);

      expect(result.passes).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(QUALITY_THRESHOLDS.ACCURACY_TARGET);
    });

    it('should warn when business objective does not align with task', () => {
      const context = createValidContext({
        businessObjective: 'Improve database performance and query optimization'
      });
      const task = createMockTask(); // About authentication, not databases

      const result = validator.validateAccuracy(context, task);

      expect(result.warnings.some(w => w.includes('Business objective'))).toBe(true);
      expect(result.score).toBeLessThan(100);
    });

    it('should warn for high complexity tasks with minimal guidance', () => {
      const context = createValidContext({
        implementationGuidance: {
          ...createImplementationGuidance(),
          implementationSteps: ['Just one step'] // Too few for complexity 7
        }
      });
      const task = createMockTask({ complexity: 8 });

      const result = validator.validateAccuracy(context, task);

      expect(result.warnings.some(w => w.includes('High complexity'))).toBe(true);
    });

    it('should warn for low complexity tasks with excessive guidance', () => {
      const context = createValidContext({
        implementationGuidance: {
          ...createImplementationGuidance(),
          implementationSteps: ['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 6']
        }
      });
      const task = createMockTask({ complexity: 2 });

      const result = validator.validateAccuracy(context, task);

      expect(result.warnings.some(w => w.includes('Low complexity'))).toBe(true);
    });

    it('should detect placeholder text', () => {
      const context = createValidContext({
        businessObjective: 'This is to be determined later in the process'
      });
      const task = createMockTask();

      const result = validator.validateAccuracy(context, task);

      expect(result.issues.some(i => i.includes('placeholder'))).toBe(true);
      expect(result.score).toBeLessThan(100);
    });

    it('should detect tbd placeholder', () => {
      const context = createValidContext({
        businessObjective: 'TBD - will be defined later'
      });
      const task = createMockTask();

      const result = validator.validateAccuracy(context, task);

      expect(result.issues.some(i => i.includes('placeholder'))).toBe(true);
    });

    it('should warn about missing technical constraints', () => {
      const context = createValidContext({
        technicalConstraints: []
      });
      const task = createMockTask();

      const result = validator.validateAccuracy(context, task);

      expect(result.warnings.some(w => w.includes('technical constraints'))).toBe(true);
    });
  });

  describe('validateRelevance', () => {
    it('should pass for relevant context', () => {
      // Ensure high keyword overlap
      const task = createMockTask({
        title: 'Implement Authentication Service',
        description: 'Create user authentication with JWT tokens'
      });
      const context = createValidContext({
        businessObjective: 'Implement authentication service with JWT tokens for user access',
        technicalConstraints: ['authentication', 'JWT tokens', 'user service'],
        architecturalDecisions: ['JWT authentication pattern'],
        integrationPoints: ['user authentication endpoint']
      });

      const result = validator.validateRelevance(context, task);

      expect(result.score).toBeGreaterThanOrEqual(QUALITY_THRESHOLDS.RELEVANCE_TARGET);
      expect(result.passes).toBe(true);
    });

    it('should warn when business objective has low keyword overlap', () => {
      const context = createValidContext({
        businessObjective: 'Optimize memory usage and garbage collection performance'
      });
      const task = createMockTask(); // About authentication

      const result = validator.validateRelevance(context, task);

      expect(result.warnings.some(w => w.includes('Business objective') && w.includes('low relevance'))).toBe(true);
    });

    it('should warn when technical context has low relevance', () => {
      const context = createValidContext({
        technicalConstraints: ['Use Python only'],
        architecturalDecisions: ['GraphQL only'],
        integrationPoints: ['Legacy mainframe system']
      });
      const task = createMockTask();

      const result = validator.validateRelevance(context, task);

      expect(result.warnings.some(w => w.includes('Technical context'))).toBe(true);
    });

    it('should warn when code examples have low relevance', () => {
      const context = createValidContext({
        contextualReferences: {
          ...createContextualReferences(),
          codeExamples: [{
            title: 'Database Migration',
            description: 'How to migrate databases',
            language: 'sql',
            snippet: 'ALTER TABLE users ADD COLUMN age INTEGER;',
            explanation: 'Adding a column to users table',
            source: 'internal'
          }]
        }
      });
      const task = createMockTask();

      const result = validator.validateRelevance(context, task);

      expect(result.warnings.some(w => w.includes('Code examples'))).toBe(true);
    });

    it('should handle context without code examples', () => {
      const context = createValidContext();
      (context.contextualReferences as any).codeExamples = undefined;
      const task = createMockTask();

      const result = validator.validateRelevance(context, task);

      // Should not throw
      expect(result).toBeDefined();
    });
  });

  describe('validatePerformance', () => {
    it('should pass for good performance metrics', () => {
      const metrics = createQualityMetrics({
        generationTime: 10,
        tokenUsage: 1000
      });

      const result = validator.validatePerformance(metrics);

      expect(result.passes).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it('should fail when generation time exceeds limit', () => {
      const metrics = createQualityMetrics({
        generationTime: 35 // > 30 seconds
      });

      const result = validator.validatePerformance(metrics);

      expect(result.issues.some(i => i.includes('Generation time'))).toBe(true);
      expect(result.score).toBeLessThan(100);
    });

    it('should warn when generation time approaches limit', () => {
      const metrics = createQualityMetrics({
        generationTime: 25 // > 80% of 30 seconds
      });

      const result = validator.validatePerformance(metrics);

      expect(result.warnings.some(w => w.includes('approaching limit'))).toBe(true);
    });

    it('should fail when token usage exceeds limit', () => {
      const metrics = createQualityMetrics({
        tokenUsage: 2500 // > 2000
      });

      const result = validator.validatePerformance(metrics);

      expect(result.issues.some(i => i.includes('Token usage'))).toBe(true);
      expect(result.score).toBeLessThan(100);
    });

    it('should warn when token usage approaches limit', () => {
      const metrics = createQualityMetrics({
        tokenUsage: 1700 // > 80% of 2000
      });

      const result = validator.validatePerformance(metrics);

      expect(result.warnings.some(w => w.includes('Token usage') && w.includes('approaching limit'))).toBe(true);
    });

    it('should fail when errors are present', () => {
      const metrics = createQualityMetrics({
        errors: ['AI model timeout', 'Rate limit exceeded']
      });

      const result = validator.validatePerformance(metrics);

      expect(result.issues.some(i => i.includes('errors encountered'))).toBe(true);
      expect(result.score).toBeLessThan(100);
    });

    it('should warn about cache miss for AI-enhanced content', () => {
      const metrics = createQualityMetrics({
        cacheHit: false,
        aiEnhanced: true
      });

      const result = validator.validatePerformance(metrics);

      expect(result.warnings.some(w => w.includes('cached'))).toBe(true);
    });

    it('should provide optimization suggestions', () => {
      const metrics = createQualityMetrics({
        generationTime: 35,
        tokenUsage: 2500
      });

      const result = validator.validatePerformance(metrics);

      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('generateQualityReport', () => {
    it('should generate complete quality report', () => {
      const task = createMockTask();
      const context = createValidContext();
      const metrics = createQualityMetrics();

      const report = validator.generateQualityReport(task, context, metrics);

      expect(report.taskId).toBe('task-1');
      expect(report.taskTitle).toBe('Implement User Authentication');
      expect(report.metrics).toEqual(metrics);
      expect(report.validation.completeness).toBeDefined();
      expect(report.validation.accuracy).toBeDefined();
      expect(report.validation.relevance).toBeDefined();
      expect(report.validation.performance).toBeDefined();
      expect(report.overallScore).toBeGreaterThan(0);
      expect(typeof report.overallPasses).toBe('boolean');
      expect(report.recommendations).toBeDefined();
    });

    it('should calculate weighted overall score correctly', () => {
      const task = createMockTask();
      const context = createValidContext();
      const metrics = createQualityMetrics();

      const report = validator.generateQualityReport(task, context, metrics);

      // All validations should pass, so score should be high
      expect(report.overallScore).toBeGreaterThanOrEqual(85);
    });

    it('should set overallPasses to true when all validations pass', () => {
      // Ensure maximum keyword overlap across all fields
      const task = createMockTask({
        title: 'Implement Authentication Service',
        description: 'Create user authentication with JWT tokens'
      });
      const context = createValidContext({
        businessObjective: 'Implement authentication service with JWT tokens for user access control',
        technicalConstraints: ['authentication', 'JWT tokens', 'user service'],
        architecturalDecisions: ['JWT authentication pattern'],
        integrationPoints: ['user authentication endpoint']
      });
      const metrics = createQualityMetrics({
        cacheHit: true
      });

      const report = validator.generateQualityReport(task, context, metrics);

      // All individual validations should pass
      expect(report.validation.completeness.passes).toBe(true);
      expect(report.validation.accuracy.passes).toBe(true);
      expect(report.validation.relevance.passes).toBe(true);
      expect(report.validation.performance.passes).toBe(true);
      expect(report.overallPasses).toBe(true);
    });

    it('should set overallPasses to false when any validation fails', () => {
      const task = createMockTask();
      const context = createValidContext({
        successMetrics: [] // Will fail completeness
      });
      const metrics = createQualityMetrics();

      const report = validator.generateQualityReport(task, context, metrics);

      expect(report.overallPasses).toBe(false);
    });

    it('should provide critical recommendations for failing validations', () => {
      const task = createMockTask();
      // Create a minimal context that will fail validations but not crash
      const context = createValidContext({
        businessObjective: 'TBD - placeholder text',
        successMetrics: [] // Will fail completeness
      });
      const metrics = createQualityMetrics({ errors: ['Error'] });

      const report = validator.generateQualityReport(task, context, metrics);

      expect(report.recommendations.some(r => r.includes('CRITICAL'))).toBe(true);
    });

    it('should provide positive message when all validations pass', () => {
      const task = createMockTask({
        title: 'Implement Authentication Service',
        description: 'Create user authentication with JWT tokens'
      });
      const context = createValidContext({
        businessObjective: 'Implement authentication service with JWT tokens for user access control',
        technicalConstraints: ['authentication', 'JWT tokens', 'user service'],
        architecturalDecisions: ['JWT authentication pattern'],
        integrationPoints: ['user authentication endpoint']
      });
      const metrics = createQualityMetrics({
        cacheHit: true
      });

      const report = validator.generateQualityReport(task, context, metrics);

      // Verify all pass first
      expect(report.overallPasses).toBe(true);
      expect(report.recommendations.some(r => r.includes('meets all PRD requirements'))).toBe(true);
    });

    it('should use task title as fallback for taskId', () => {
      const task = createMockTask({ id: undefined as any });
      const context = createValidContext();
      const metrics = createQualityMetrics();

      const report = validator.generateQualityReport(task, context, metrics);

      expect(report.taskId).toBe('Implement User Authentication');
    });
  });

  describe('keyword extraction and matching', () => {
    it('should filter common words from keywords', () => {
      const context = createValidContext({
        businessObjective: 'The user can authenticate with the system'
      });
      const task = createMockTask({
        title: 'User Authentication',
        description: 'Users can authenticate'
      });

      const result = validator.validateRelevance(context, task);

      // Should match on 'user', 'authenticate', not on 'the', 'can', 'with'
      expect(result.score).toBeGreaterThan(0);
    });

    it('should filter short words (3 chars or less)', () => {
      const context = createValidContext({
        businessObjective: 'API for JWT token auth'
      });
      const task = createMockTask({
        title: 'API Token Auth',
        description: 'API token authentication'
      });

      const result = validator.validateRelevance(context, task);

      // Should match on 'token', 'auth', not on 'API', 'for', 'JWT'
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty context gracefully', () => {
      const emptyContext: Partial<TaskExecutionContext> = {};

      const result = validator.validateCompleteness(emptyContext);

      expect(result.passes).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should handle context with empty arrays', () => {
      const context = createValidContext({
        technicalConstraints: [],
        architecturalDecisions: [],
        integrationPoints: [],
        successMetrics: []
      });
      const task = createMockTask();

      // Should not throw
      const result = validator.validateRelevance(context, task);
      expect(result).toBeDefined();
    });

    it('should handle undefined optional fields', () => {
      const context = createValidContext();
      delete (context as any).implementationGuidance;
      delete (context as any).contextualReferences;
      delete (context as any).enhancedAcceptanceCriteria;
      delete (context as any).dependencyContext;
      const task = createMockTask();

      // Should not throw
      const result = validator.validateAccuracy(context, task);
      expect(result).toBeDefined();
    });

    it('should handle metrics with edge values', () => {
      const metrics = createQualityMetrics({
        generationTime: 30, // Exactly at limit
        tokenUsage: 2000 // Exactly at limit
      });

      const result = validator.validatePerformance(metrics);

      // Should pass since not exceeding
      expect(result.issues.filter(i => i.includes('exceeds'))).toHaveLength(0);
    });
  });
});
