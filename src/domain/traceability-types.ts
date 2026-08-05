import { z } from "zod";
import type {
  TaskPriority,
  TaskComplexity,
  AcceptanceCriteria,
  AITask,
  TaskDependency,
  AIGenerationMetadata
} from './ai-task-types';
import {
  TaskPrioritySchema,
  TaskComplexitySchema,
  AcceptanceCriteriaSchema,
  AITaskSchema,
  AIGenerationMetadataSchema
} from './ai-task-types';
import type { FeatureRequirement } from './prd-types';
import { FeatureRequirementSchema } from './prd-types';

// ============================================================================
// Requirements Traceability System
// ============================================================================

/**
 * Requirement Types in the hierarchy
 */
export enum RequirementType {
  BUSINESS = 'business',           // High-level business requirements from PRD
  FUNCTIONAL = 'functional',       // Functional requirements (features)
  USE_CASE = 'use_case',          // Use cases and user stories
  TASK = 'task',                  // Implementation tasks
  ACCEPTANCE = 'acceptance'        // Acceptance criteria
}

/**
 * Requirement Status for tracking
 */
export enum RequirementStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  IN_PROGRESS = 'in_progress',
  IMPLEMENTED = 'implemented',
  TESTED = 'tested',
  VERIFIED = 'verified',
  REJECTED = 'rejected'
}

/**
 * Traceability Link Types
 */
export enum TraceabilityLinkType {
  DERIVES_FROM = 'derives_from',     // Child derives from parent
  IMPLEMENTS = 'implements',         // Task implements requirement
  VERIFIES = 'verifies',            // Test verifies requirement
  DEPENDS_ON = 'depends_on',        // Dependency relationship
  CONFLICTS_WITH = 'conflicts_with', // Conflict relationship
  RELATES_TO = 'relates_to'         // General relationship
}

/**
 * Core Requirement with full traceability
 */
export interface Requirement {
  id: string;
  type: RequirementType;
  title: string;
  description: string;
  status: RequirementStatus;
  priority: TaskPriority;

  // Traceability
  parentRequirements: string[];     // IDs of parent requirements
  childRequirements: string[];      // IDs of child requirements
  traceabilityLinks: TraceabilityLink[];

  // Source tracking
  sourceDocument: string;           // PRD ID, Feature ID, etc.
  sourceSection: string;           // Section within source document

  // Verification
  verificationMethod: 'inspection' | 'analysis' | 'test' | 'demonstration';
  verificationStatus: 'not_verified' | 'verified' | 'failed';
  testCases: string[];             // IDs of test cases that verify this requirement

  // Metadata
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  rationale: string;              // Why this requirement exists

  // AI metadata
  aiGenerated: boolean;
  aiMetadata?: AIGenerationMetadata;
}

/**
 * Traceability Link between requirements
 */
export interface TraceabilityLink {
  id: string;
  fromRequirementId: string;
  toRequirementId: string;
  linkType: TraceabilityLinkType;
  description: string;
  createdAt: string;
  createdBy: string;
}

/**
 * Use Case with full actor-goal-scenario structure
 */
export interface UseCase {
  id: string;
  title: string;
  description: string;

  // Use case structure
  primaryActor: string;
  goal: string;
  preconditions: string[];
  postconditions: string[];
  mainScenario: UseCaseStep[];
  alternativeScenarios: AlternativeScenario[];
  exceptionScenarios: ExceptionScenario[];

  // Traceability
  parentFeatureId: string;         // Feature this use case belongs to
  parentRequirementIds: string[];  // Business requirements this implements
  implementingTaskIds: string[];   // Tasks that implement this use case

  // Verification
  acceptanceCriteria: AcceptanceCriteria[];
  testCases: string[];

  // Metadata
  priority: TaskPriority;
  complexity: TaskComplexity;
  estimatedHours: number;
  status: RequirementStatus;
  createdAt: string;
  updatedAt: string;

  // AI metadata
  aiGenerated: boolean;
  aiMetadata?: AIGenerationMetadata;
}

/**
 * Use Case Step
 */
export interface UseCaseStep {
  stepNumber: number;
  actor: string;
  action: string;
  systemResponse?: string;
  notes?: string;
}

/**
 * Alternative Scenario
 */
export interface AlternativeScenario {
  id: string;
  title: string;
  condition: string;
  steps: UseCaseStep[];
}

/**
 * Exception Scenario
 */
export interface ExceptionScenario {
  id: string;
  title: string;
  trigger: string;
  steps: UseCaseStep[];
  recovery: string;
}

/**
 * Enhanced Feature Requirement with full traceability
 */
export interface EnhancedFeatureRequirement extends FeatureRequirement {
  // Traceability
  parentPRDId: string;
  parentBusinessRequirements: string[];  // Business requirements this feature addresses
  useCases: string[];                   // Use case IDs for this feature
  implementingTasks: string[];          // Task IDs that implement this feature

  // Requirements breakdown
  functionalRequirements: Requirement[];
  nonFunctionalRequirements: Requirement[];

  // Verification
  verificationMethod: 'inspection' | 'analysis' | 'test' | 'demonstration';
  verificationStatus: 'not_verified' | 'verified' | 'failed';
  testSuite: string;                    // Test suite ID for this feature

  // Impact analysis
  impactedComponents: string[];         // System components affected
  riskLevel: 'low' | 'medium' | 'high';
  mitigationStrategies: string[];
}

/**
 * Task Execution Context - comprehensive context for task execution
 */
export interface TaskExecutionContext {
  // Business Context
  businessObjective: string;           // Why this task matters to the business
  userImpact: string;                 // How this affects end users
  successMetrics: string[];           // How success is measured

  // Feature Context
  parentFeature: {
    id: string;
    title: string;
    description: string;
    userStories: string[];
    businessValue: string;
  };

  // Technical Context
  technicalConstraints: string[];      // Technical limitations or requirements
  architecturalDecisions: string[];    // Relevant architecture decisions
  integrationPoints: string[];         // Systems this task integrates with
  dataRequirements: string[];          // Data models or schemas involved

  // PRD Context Summary
  prdContextSummary: {
    relevantObjectives: string[];      // PRD objectives this task supports
    relevantRequirements: string[];    // Technical requirements this task addresses
    scopeConstraints: string[];        // Scope limitations from PRD
  };
}

/**
 * Enhanced Acceptance Criteria with verification details
 */
export interface EnhancedAcceptanceCriteria extends AcceptanceCriteria {
  category: 'functional' | 'technical' | 'quality' | 'integration' | 'performance';
  verificationMethod: 'unit_test' | 'integration_test' | 'manual_test' | 'code_review' | 'demo';
  verificationDetails: string;         // Specific steps to verify this criteria
  priority: 'must_have' | 'should_have' | 'nice_to_have';
}

/**
 * Contextual References for tasks
 */
export interface ContextualReferences {
  // Source Document References
  prdSections: Array<{
    section: string;
    content: string;                   // Relevant excerpt
    relevance: string;                 // Why this section is relevant
  }>;

  // Feature References
  relatedFeatures: Array<{
    id: string;
    title: string;
    relationship: 'implements' | 'extends' | 'integrates_with' | 'depends_on';
    context: string;
  }>;

  // Technical References
  technicalSpecs: Array<{
    type: 'api_spec' | 'data_model' | 'architecture_doc' | 'design_system';
    title: string;
    description: string;
    relevantSections: string[];
  }>;

  // Example References
  codeExamples: Array<{
    description: string;
    language: string;
    snippet: string;
    source: string;
  }>;
}

/**
 * Implementation Guidance for tasks
 */
export interface ImplementationGuidance {
  // Approach Recommendations
  recommendedApproach: string;         // High-level implementation strategy
  implementationSteps: string[];       // Step-by-step implementation guide

  // Technical Guidance
  technicalConsiderations: string[];   // Important technical points
  commonPitfalls: string[];            // Things to avoid
  testingStrategy: string;             // How to test this implementation

  // Resource Recommendations
  recommendedTools: string[];          // Suggested tools or libraries
  learningResources?: string[];        // Documentation or tutorials

  // Quality Guidelines
  codeQualityStandards: string[];      // Coding standards to follow
  performanceConsiderations: string[]; // Performance requirements
  securityConsiderations: string[];    // Security requirements
}

/**
 * Enhanced Task Dependency with context
 */
export interface EnhancedTaskDependency extends TaskDependency {
  // Dependency Context
  dependencyReason: string;            // Why this dependency exists
  dependencyOutcome: string;           // What the dependency provides
  integrationDetails: string;          // How to integrate with dependency

  // Dependency Management
  canStartInParallel: boolean;         // Can work start before dependency completes
  parallelWorkGuidance?: string;       // How to work in parallel if possible
  blockingReason?: string;             // Why this blocks if it does

  // Dependency Verification
  verificationCriteria: string[];      // How to verify dependency is ready
  integrationTests: string[];          // Tests to verify integration
}

/**
 * Enhanced AI Task with full requirements traceability and context
 */
export interface EnhancedAITask extends AITask {
  // Requirements traceability
  implementsRequirements?: string[];     // Requirement IDs this task implements
  implementsUseCases?: string[];         // Use case IDs this task implements
  implementsFeatures?: string[];         // Feature IDs this task implements
  parentPRDId?: string;                // PRD this task originates from

  // Detailed traceability
  requirementTraceability?: {
    businessRequirement: string;        // High-level business requirement
    functionalRequirement: string;      // Functional requirement
    useCase: string;                   // Specific use case
    acceptanceCriteria: string[];      // Acceptance criteria IDs
  };

  // Enhanced Context
  executionContext?: TaskExecutionContext;
  enhancedAcceptanceCriteria?: EnhancedAcceptanceCriteria[];
  contextualReferences?: ContextualReferences;
  implementationGuidance?: ImplementationGuidance;
  enhancedDependencies?: EnhancedTaskDependency[];

  // Verification and validation
  verificationTasks?: string[];          // Task IDs for verification (testing)
  verificationStatus?: 'not_started' | 'in_progress' | 'completed' | 'failed';
  testCases?: string[];                 // Test case IDs that verify this task

  // Impact tracking
  requirementChanges?: RequirementChange[];  // Changes that affected this task
  impactAnalysis?: {
    affectedRequirements: string[];
    affectedUseCases: string[];
    affectedFeatures: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };

  // Context quality assessment
  contextQualityMetrics?: {
    completeness: number; // 0-1
    relevance: number;    // 0-1
    clarity: number;      // 0-1
    overallScore: number; // 0-1
  };
}

/**
 * Requirement Change tracking
 */
export interface RequirementChange {
  id: string;
  requirementId: string;
  changeType: 'added' | 'modified' | 'deleted' | 'moved';
  oldValue?: string;
  newValue?: string;
  reason: string;
  impact: string;
  affectedTasks: string[];
  affectedUseCases: string[];
  changedBy: string;
  changedAt: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
}

/**
 * Requirements Traceability Matrix
 */
export interface TraceabilityMatrix {
  id: string;
  projectId: string;
  prdId: string;

  // Hierarchy mapping
  businessRequirements: Requirement[];
  features: EnhancedFeatureRequirement[];
  useCases: UseCase[];
  tasks: EnhancedAITask[];

  // Traceability links
  traceabilityLinks: TraceabilityLink[];

  // Coverage analysis
  coverage: {
    businessRequirementsCovered: number;
    featuresCovered: number;
    useCasesCovered: number;
    tasksWithTraceability: number;
    orphanedTasks: string[];           // Tasks without requirement links
    unimplementedRequirements: string[]; // Requirements without implementing tasks
  };

  // Metadata
  createdAt: string;
  updatedAt: string;
  version: string;
}

// ============================================================================
// Requirements Traceability Schemas
// ============================================================================

export const RequirementTypeSchema = z.nativeEnum(RequirementType);
export const RequirementStatusSchema = z.nativeEnum(RequirementStatus);
export const TraceabilityLinkTypeSchema = z.nativeEnum(TraceabilityLinkType);

export const TraceabilityLinkSchema = z.object({
  id: z.string(),
  fromRequirementId: z.string(),
  toRequirementId: z.string(),
  linkType: TraceabilityLinkTypeSchema,
  description: z.string(),
  createdAt: z.string(),
  createdBy: z.string()
});

export const RequirementSchema = z.object({
  id: z.string(),
  type: RequirementTypeSchema,
  title: z.string().min(1),
  description: z.string(),
  status: RequirementStatusSchema,
  priority: TaskPrioritySchema,
  parentRequirements: z.array(z.string()),
  childRequirements: z.array(z.string()),
  traceabilityLinks: z.array(TraceabilityLinkSchema),
  sourceDocument: z.string(),
  sourceSection: z.string(),
  verificationMethod: z.enum(['inspection', 'analysis', 'test', 'demonstration']),
  verificationStatus: z.enum(['not_verified', 'verified', 'failed']),
  testCases: z.array(z.string()),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.string(),
  rationale: z.string(),
  aiGenerated: z.boolean(),
  aiMetadata: AIGenerationMetadataSchema.optional()
});

export const UseCaseStepSchema = z.object({
  stepNumber: z.number(),
  actor: z.string(),
  action: z.string(),
  systemResponse: z.string().optional(),
  notes: z.string().optional()
});

export const AlternativeScenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  condition: z.string(),
  steps: z.array(UseCaseStepSchema)
});

export const ExceptionScenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  trigger: z.string(),
  steps: z.array(UseCaseStepSchema),
  recovery: z.string()
});

export const UseCaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  primaryActor: z.string(),
  goal: z.string(),
  preconditions: z.array(z.string()),
  postconditions: z.array(z.string()),
  mainScenario: z.array(UseCaseStepSchema),
  alternativeScenarios: z.array(AlternativeScenarioSchema),
  exceptionScenarios: z.array(ExceptionScenarioSchema),
  parentFeatureId: z.string(),
  parentRequirementIds: z.array(z.string()),
  implementingTaskIds: z.array(z.string()),
  acceptanceCriteria: z.array(AcceptanceCriteriaSchema),
  testCases: z.array(z.string()),
  priority: TaskPrioritySchema,
  complexity: TaskComplexitySchema,
  estimatedHours: z.number().min(0),
  status: RequirementStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  aiGenerated: z.boolean(),
  aiMetadata: AIGenerationMetadataSchema.optional()
});

export const RequirementChangeSchema = z.object({
  id: z.string(),
  requirementId: z.string(),
  changeType: z.enum(['added', 'modified', 'deleted', 'moved']),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
  reason: z.string(),
  impact: z.string(),
  affectedTasks: z.array(z.string()),
  affectedUseCases: z.array(z.string()),
  changedBy: z.string(),
  changedAt: z.string(),
  approved: z.boolean(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional()
});

export const TraceabilityMatrixSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  prdId: z.string(),
  businessRequirements: z.array(RequirementSchema),
  features: z.array(FeatureRequirementSchema), // Will be enhanced later
  useCases: z.array(UseCaseSchema),
  tasks: z.array(AITaskSchema), // Will be enhanced later
  traceabilityLinks: z.array(TraceabilityLinkSchema),
  coverage: z.object({
    businessRequirementsCovered: z.number(),
    featuresCovered: z.number(),
    useCasesCovered: z.number(),
    tasksWithTraceability: z.number(),
    orphanedTasks: z.array(z.string()),
    unimplementedRequirements: z.array(z.string())
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.string()
});
