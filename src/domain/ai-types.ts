import { z } from "zod";

// ============================================================================
// AI Task Management Types
// ============================================================================

/**
 * Task Priority Levels
 */
export enum TaskPriority {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low"
}

/**
 * Task Status
 */
export enum TaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  BLOCKED = "blocked",
  DONE = "done",
  CANCELLED = "cancelled"
}

/**
 * Task Complexity (1-10 scale)
 */
export type TaskComplexity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * AI Generation Metadata
 */
export interface AIGenerationMetadata {
  generatedBy: string; // AI model used
  generatedAt: string; // ISO timestamp
  prompt: string; // Prompt used for generation
  confidence: number; // 0-1 confidence score
  version: string; // AI system version
}

/**
 * Task Dependency
 */
export interface TaskDependency {
  id: string;
  type: "blocks" | "depends_on" | "related_to";
  description?: string;
}

/**
 * Acceptance Criteria
 */
export interface AcceptanceCriteria {
  id: string;
  description: string;
  completed: boolean;
}

/**
 * AI Enhanced Task
 */
export interface AITask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  complexity: TaskComplexity;
  estimatedHours: number;
  actualHours?: number;

  // AI-specific metadata
  aiGenerated: boolean;
  aiMetadata?: AIGenerationMetadata;

  // Task relationships
  parentTaskId?: string;
  subtasks: string[]; // IDs of subtasks
  dependencies: TaskDependency[];

  // Acceptance criteria
  acceptanceCriteria: AcceptanceCriteria[];

  // GitHub integration
  githubProjectItemId?: string;
  githubIssueId?: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  dueDate?: string;

  // Additional metadata
  tags: string[];
  assignee?: string;
  sourcePRD?: string; // Reference to source PRD
}

/**
 * Subtask (simplified version of AITask)
 */
export interface SubTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  complexity: TaskComplexity;
  estimatedHours: number;
  parentTaskId: string;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// PRD (Product Requirements Document) Types
// ============================================================================

/**
 * User Persona
 */
export interface UserPersona {
  id: string;
  name: string;
  description: string;
  goals: string[];
  painPoints: string[];
  technicalLevel: "beginner" | "intermediate" | "advanced";
}

/**
 * Feature Requirement
 */
export interface FeatureRequirement {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  userStories: string[];
  acceptanceCriteria: string[];
  estimatedComplexity: TaskComplexity;
  dependencies: string[]; // IDs of other features
}

/**
 * Technical Requirement
 */
export interface TechnicalRequirement {
  id: string;
  category: "performance" | "security" | "scalability" | "integration" | "infrastructure";
  requirement: string;
  rationale: string;
  priority: TaskPriority;
}

/**
 * Project Scope
 */
export interface ProjectScope {
  inScope: string[];
  outOfScope: string[];
  assumptions: string[];
  constraints: string[];
}

/**
 * PRD Document
 */
export interface PRDDocument {
  id: string;
  title: string;
  version: string;

  // Core content
  overview: string;
  objectives: string[];
  scope: ProjectScope;

  // User-focused
  targetUsers: UserPersona[];
  userJourney: string;

  // Features and requirements
  features: FeatureRequirement[];
  technicalRequirements: TechnicalRequirement[];

  // Market research (optional)
  marketResearch?: {
    competitorAnalysis: string[];
    marketSize: string;
    trends: string[];
  };

  // Project details
  timeline: string;
  milestones: string[];
  successMetrics: string[];

  // AI metadata
  aiGenerated: boolean;
  aiMetadata?: AIGenerationMetadata;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Additional metadata
  author: string;
  stakeholders: string[];
  tags: string[];
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const TaskPrioritySchema = z.nativeEnum(TaskPriority);
export const TaskStatusSchema = z.nativeEnum(TaskStatus);
export const TaskComplexitySchema = z.number().min(1).max(10) as z.ZodType<TaskComplexity>;

export const AIGenerationMetadataSchema = z.object({
  generatedBy: z.string(),
  generatedAt: z.string(),
  prompt: z.string(),
  confidence: z.number().min(0).max(1),
  version: z.string()
});

export const TaskDependencySchema = z.object({
  id: z.string(),
  type: z.enum(["blocks", "depends_on", "related_to"]),
  description: z.string().optional()
});

export const AcceptanceCriteriaSchema = z.object({
  id: z.string(),
  description: z.string(),
  completed: z.boolean()
});

export const AITaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  complexity: TaskComplexitySchema,
  estimatedHours: z.number().min(0),
  actualHours: z.number().min(0).optional(),
  aiGenerated: z.boolean(),
  aiMetadata: AIGenerationMetadataSchema.optional(),
  parentTaskId: z.string().optional(),
  subtasks: z.array(z.string()),
  dependencies: z.array(TaskDependencySchema),
  acceptanceCriteria: z.array(AcceptanceCriteriaSchema),
  githubProjectItemId: z.string().optional(),
  githubIssueId: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dueDate: z.string().optional(),
  tags: z.array(z.string()),
  assignee: z.string().optional(),
  sourcePRD: z.string().optional()
});

export const UserPersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  goals: z.array(z.string()),
  painPoints: z.array(z.string()),
  technicalLevel: z.enum(["beginner", "intermediate", "advanced"])
});

export const FeatureRequirementSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: TaskPrioritySchema,
  userStories: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  estimatedComplexity: TaskComplexitySchema,
  dependencies: z.array(z.string())
});

export const PRDDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string(),
  overview: z.string(),
  objectives: z.array(z.string()),
  scope: z.object({
    inScope: z.array(z.string()),
    outOfScope: z.array(z.string()),
    assumptions: z.array(z.string()),
    constraints: z.array(z.string())
  }),
  targetUsers: z.array(UserPersonaSchema),
  userJourney: z.string(),
  features: z.array(FeatureRequirementSchema),
  technicalRequirements: z.array(z.object({
    id: z.string(),
    category: z.enum(["performance", "security", "scalability", "integration", "infrastructure"]),
    requirement: z.string(),
    rationale: z.string(),
    priority: TaskPrioritySchema
  })),
  marketResearch: z.object({
    competitorAnalysis: z.array(z.string()),
    marketSize: z.string(),
    trends: z.array(z.string())
  }).optional(),
  timeline: z.string(),
  milestones: z.array(z.string()),
  successMetrics: z.array(z.string()),
  aiGenerated: z.boolean(),
  aiMetadata: AIGenerationMetadataSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: z.string(),
  stakeholders: z.array(z.string()),
  tags: z.array(z.string())
});

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
// Feature Addition and Lifecycle Types
// ============================================================================

/**
 * Feature Addition Request
 */
export interface FeatureAdditionRequest {
  id: string;
  featureIdea: string;
  description: string;
  targetPRD?: string; // PRD ID to add feature to
  targetProject?: string; // GitHub project ID
  requestedBy: string;
  businessJustification?: string;
  targetUsers?: string[];
  priority?: TaskPriority;
  estimatedComplexity?: TaskComplexity;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
}

/**
 * Feature Expansion Result
 */
export interface FeatureExpansionResult {
  feature: FeatureRequirement;
  tasks: AITask[];
  dependencies: TaskDependency[];
  estimatedEffort: number;
  suggestedMilestone?: string;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    mitigations: string[];
  };
}

/**
 * Task Lifecycle State
 */
export interface TaskLifecycleState {
  taskId: string;
  currentPhase: 'planning' | 'development' | 'testing' | 'review' | 'deployment' | 'completed';
  phases: {
    planning: TaskPhaseInfo;
    development: TaskPhaseInfo;
    testing: TaskPhaseInfo;
    review: TaskPhaseInfo;
    deployment: TaskPhaseInfo;
  };
  blockers: TaskBlocker[];
  progressPercentage: number;
  estimatedCompletion: string;
  actualCompletion?: string;
}

/**
 * Task Phase Information
 */
export interface TaskPhaseInfo {
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  startedAt?: string;
  completedAt?: string;
  assignee?: string;
  notes?: string;
  artifacts?: string[]; // URLs to deliverables, PRs, etc.
}

/**
 * Task Blocker
 */
export interface TaskBlocker {
  id: string;
  type: 'dependency' | 'resource' | 'technical' | 'external';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reportedAt: string;
  resolvedAt?: string;
  resolution?: string;
}

/**
 * Project Feature Roadmap
 */
export interface ProjectFeatureRoadmap {
  projectId: string;
  features: {
    current: FeatureRequirement[];
    planned: FeatureRequirement[];
    backlog: FeatureRequirement[];
  };
  timeline: {
    quarters: {
      [key: string]: {
        features: string[]; // feature IDs
        themes: string[];
        goals: string[];
      };
    };
  };
  dependencies: {
    [featureId: string]: string[]; // dependent feature IDs
  };
}

// ============================================================================
// Enhanced Zod Schemas
// ============================================================================

export const FeatureAdditionRequestSchema = z.object({
  id: z.string(),
  featureIdea: z.string().min(10),
  description: z.string().min(20),
  targetPRD: z.string().optional(),
  targetProject: z.string().optional(),
  requestedBy: z.string(),
  businessJustification: z.string().optional(),
  targetUsers: z.array(z.string()).optional(),
  priority: TaskPrioritySchema.optional(),
  estimatedComplexity: TaskComplexitySchema.optional(),
  createdAt: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'implemented'])
});

export const TaskLifecycleStateSchema = z.object({
  taskId: z.string(),
  currentPhase: z.enum(['planning', 'development', 'testing', 'review', 'deployment', 'completed']),
  phases: z.object({
    planning: z.object({
      status: z.enum(['not_started', 'in_progress', 'completed', 'blocked']),
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      assignee: z.string().optional(),
      notes: z.string().optional(),
      artifacts: z.array(z.string()).optional()
    }),
    development: z.object({
      status: z.enum(['not_started', 'in_progress', 'completed', 'blocked']),
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      assignee: z.string().optional(),
      notes: z.string().optional(),
      artifacts: z.array(z.string()).optional()
    }),
    testing: z.object({
      status: z.enum(['not_started', 'in_progress', 'completed', 'blocked']),
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      assignee: z.string().optional(),
      notes: z.string().optional(),
      artifacts: z.array(z.string()).optional()
    }),
    review: z.object({
      status: z.enum(['not_started', 'in_progress', 'completed', 'blocked']),
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      assignee: z.string().optional(),
      notes: z.string().optional(),
      artifacts: z.array(z.string()).optional()
    }),
    deployment: z.object({
      status: z.enum(['not_started', 'in_progress', 'completed', 'blocked']),
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      assignee: z.string().optional(),
      notes: z.string().optional(),
      artifacts: z.array(z.string()).optional()
    })
  }),
  blockers: z.array(z.object({
    id: z.string(),
    type: z.enum(['dependency', 'resource', 'technical', 'external']),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    reportedAt: z.string(),
    resolvedAt: z.string().optional(),
    resolution: z.string().optional()
  })),
  progressPercentage: z.number().min(0).max(100),
  estimatedCompletion: z.string(),
  actualCompletion: z.string().optional()
});

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

// ============================================================================
// Enhanced Task Generation Configuration
// ============================================================================

/**
 * Enhanced Task Generation Configuration
 */
export interface EnhancedTaskGenerationConfig {
  // Core Enhancement Settings
  enableEnhancedGeneration: boolean;
  createTraceabilityMatrix: boolean;
  generateUseCases: boolean;
  createLifecycleTracking: boolean;

  // Context Level Configuration
  contextLevel: 'minimal' | 'standard' | 'full';
  includeBusinessContext: boolean;
  includeTechnicalContext: boolean;
  includeImplementationGuidance: boolean;

  // Performance Settings
  maxContextTokens?: number;
  enableContextCaching?: boolean;
  parallelContextGeneration?: boolean;

  // Traceability Settings
  enforceTraceability: boolean;
  requireBusinessJustification: boolean;
  trackRequirementCoverage: boolean;
}

/**
 * Enhanced Task Generation Parameters
 */
export interface EnhancedTaskGenerationParams {
  // Basic Parameters
  prd: PRDDocument | string;
  maxTasks?: number;
  includeSubtasks?: boolean;
  autoEstimate?: boolean;
  autoPrioritize?: boolean;

  // Enhanced Parameters
  enhancedConfig?: Partial<EnhancedTaskGenerationConfig>;
  projectId?: string;
  targetComplexity?: number;

  // Context Parameters
  businessObjectives?: string[];
  technicalConstraints?: string[];
  teamSkills?: string[];
  projectTimeline?: string;
}

export const EnhancedTaskGenerationConfigSchema = z.object({
  enableEnhancedGeneration: z.boolean(),
  createTraceabilityMatrix: z.boolean(),
  generateUseCases: z.boolean(),
  createLifecycleTracking: z.boolean(),
  contextLevel: z.enum(['minimal', 'standard', 'full']),
  includeBusinessContext: z.boolean(),
  includeTechnicalContext: z.boolean(),
  includeImplementationGuidance: z.boolean(),
  maxContextTokens: z.number().optional(),
  enableContextCaching: z.boolean().optional(),
  parallelContextGeneration: z.boolean().optional(),
  enforceTraceability: z.boolean(),
  requireBusinessJustification: z.boolean(),
  trackRequirementCoverage: z.boolean()
});
