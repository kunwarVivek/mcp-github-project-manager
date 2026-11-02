import { z } from "zod";
import type { PromptRegistry } from "./PromptRegistry";

/**
 * Schema for AI self-assessment response embedded in generated content
 */
export const AIConfidenceAssessmentSchema = z.object({
  score: z.number().min(0).max(100).describe("Overall confidence score 0-100"),
  reasoning: z.string().describe("Brief explanation of confidence level"),
  uncertainAreas: z.array(z.string()).describe("Specific areas of uncertainty"),
  clarifyingQuestions: z
    .array(z.string())
    .optional()
    .describe("Questions that would increase confidence"),
});

export type AIConfidenceAssessment = z.infer<typeof AIConfidenceAssessmentSchema>;

/**
 * Registry ids and generation settings for confidence-aware generation
 */
export interface ConfidencePromptConfig {
  systemPromptId: string;
  userPromptId: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Self-assessment prompt suffix to append to any generation request
 */
const SELF_ASSESSMENT_SUFFIX = `

After generating the content, also provide a confidence assessment:
1. Rate your confidence (0-100) in the generated content
2. Explain your confidence level briefly
3. List any areas where you're uncertain
4. Suggest questions that would help improve the output

Be honest about uncertainty. High confidence should only be claimed when:
- The input provides sufficient detail
- The request is clear and unambiguous
- The output follows established patterns
- No significant assumptions were required`;

/** PRD section confidence assessment */
const PRD_SECTION_SYSTEM_PROMPT = `You are an expert PRD reviewer. Your task is to assess the quality and completeness of PRD sections.

Evaluate each section based on:
1. Completeness - Does it cover all necessary information?
2. Clarity - Is the content clear and unambiguous?
3. Actionability - Can someone execute on this content?
4. Consistency - Does it align with other PRD sections?

Be calibrated in your confidence. Common issues that should lower confidence:
- Vague or generic descriptions
- Missing acceptance criteria
- Unclear user personas
- Ambiguous technical requirements
- Missing success metrics`;

const PRD_SECTION_USER_PROMPT = `Assess the following PRD section:

Section: {{sectionName}}
Content:
{{content}}

Context from other sections:
{{context}}

Provide your assessment as JSON matching this schema:
- score: 0-100 confidence in the section quality
- reasoning: Brief explanation
- uncertainAreas: List of unclear/incomplete areas
- clarifyingQuestions: Questions to improve the section`;

/** Task confidence assessment */
const TASK_SYSTEM_PROMPT = `You are an expert at evaluating task definitions and estimates.

Evaluate tasks based on:
1. Clarity of requirements
2. Completeness of acceptance criteria
3. Accuracy of complexity/effort estimates
4. Correctness of dependency identification
5. Feasibility given the context

Be honest about uncertainty in estimates. Task estimation inherently has variance.`;

const TASK_USER_PROMPT = `Assess the following task:

Title: {{title}}
Description: {{description}}
Estimated Complexity: {{complexity}}
Estimated Effort: {{effort}}
Dependencies: {{dependencies}}
Acceptance Criteria: {{acceptanceCriteria}}

PRD Context:
{{prdContext}}

Provide your assessment as JSON:
- score: 0-100 confidence in task definition quality
- reasoning: Brief explanation
- uncertainAreas: Areas needing clarification
- clarifyingQuestions: Questions that would improve the task`;

/** Dependency detection confidence */
const DEPENDENCY_SYSTEM_PROMPT = `You are an expert at analyzing task dependencies in software projects.

Look for:
1. Technical dependencies (API needs DB, UI needs API)
2. Data dependencies (Task B needs output from Task A)
3. Logical dependencies (Testing after implementation)
4. Resource dependencies (Shared infrastructure)

Be conservative - only flag dependencies you're confident about.
Mark uncertain dependencies for human review.`;

const DEPENDENCY_USER_PROMPT = `Analyze dependencies for these tasks:

Tasks:
{{taskList}}

For each detected dependency, rate your confidence (0-100) and explain why.

Format as JSON array with:
- fromTaskId: Task that depends on another
- toTaskId: Task being depended upon
- type: 'blocks' | 'depends_on' | 'related_to'
- confidence: 0-100
- reasoning: Why this dependency exists`;

/** Effort estimation confidence */
const EFFORT_SYSTEM_PROMPT = `You are an expert at estimating software development effort.

Consider:
1. Task complexity (logic, algorithms, edge cases)
2. Integration points (APIs, databases, services)
3. Testing requirements
4. Documentation needs
5. Similar tasks from experience

Express uncertainty through confidence scores. Simple CRUD = high confidence.
Novel algorithms or complex integrations = lower confidence.

Use story points (Fibonacci: 1, 2, 3, 5, 8, 13) by default.`;

const EFFORT_USER_PROMPT = `Estimate effort for:

Task: {{title}}
Description: {{description}}
Technical Context: {{technicalContext}}
Similar Completed Tasks: {{historicalData}}

Provide:
- estimate: number (story points)
- confidence: 0-100
- reasoning: Brief explanation
- range: {low: number, high: number} representing uncertainty
- risks: Factors that could affect the estimate`;

export const CONFIDENCE_PROMPT_IDS = {
  selfAssessmentSuffix: "confidence.self-assessment-suffix",
  prdSectionSystem: "confidence.prd-section.system",
  prdSectionUser: "confidence.prd-section.user",
  taskSystem: "confidence.task.system",
  taskUser: "confidence.task.user",
  dependencySystem: "confidence.dependency.system",
  dependencyUser: "confidence.dependency.user",
  effortSystem: "confidence.effort.system",
  effortUser: "confidence.effort.user",
} as const;

/** Register every confidence prompt (version 1.0.0). */
export function registerConfidencePrompts(registry: PromptRegistry): void {
  registry.register(CONFIDENCE_PROMPT_IDS.selfAssessmentSuffix, "1.0.0", SELF_ASSESSMENT_SUFFIX);
  registry.register(CONFIDENCE_PROMPT_IDS.prdSectionSystem, "1.0.0", PRD_SECTION_SYSTEM_PROMPT);
  registry.register(CONFIDENCE_PROMPT_IDS.prdSectionUser, "1.0.0", PRD_SECTION_USER_PROMPT);
  registry.register(CONFIDENCE_PROMPT_IDS.taskSystem, "1.0.0", TASK_SYSTEM_PROMPT);
  registry.register(CONFIDENCE_PROMPT_IDS.taskUser, "1.0.0", TASK_USER_PROMPT);
  registry.register(CONFIDENCE_PROMPT_IDS.dependencySystem, "1.0.0", DEPENDENCY_SYSTEM_PROMPT);
  registry.register(CONFIDENCE_PROMPT_IDS.dependencyUser, "1.0.0", DEPENDENCY_USER_PROMPT);
  registry.register(CONFIDENCE_PROMPT_IDS.effortSystem, "1.0.0", EFFORT_SYSTEM_PROMPT);
  registry.register(CONFIDENCE_PROMPT_IDS.effortUser, "1.0.0", EFFORT_USER_PROMPT);
}

/**
 * Confidence prompt configurations for different content types
 */
export const CONFIDENCE_PROMPT_CONFIGS = {
  prdSectionAssessment: {
    systemPromptId: CONFIDENCE_PROMPT_IDS.prdSectionSystem,
    userPromptId: CONFIDENCE_PROMPT_IDS.prdSectionUser,
    temperature: 0.3,
    maxTokens: 500,
  } satisfies ConfidencePromptConfig,

  taskAssessment: {
    systemPromptId: CONFIDENCE_PROMPT_IDS.taskSystem,
    userPromptId: CONFIDENCE_PROMPT_IDS.taskUser,
    temperature: 0.3,
    maxTokens: 500,
  } satisfies ConfidencePromptConfig,

  dependencyAssessment: {
    systemPromptId: CONFIDENCE_PROMPT_IDS.dependencySystem,
    userPromptId: CONFIDENCE_PROMPT_IDS.dependencyUser,
    temperature: 0.2,
    maxTokens: 1000,
  } satisfies ConfidencePromptConfig,

  effortAssessment: {
    systemPromptId: CONFIDENCE_PROMPT_IDS.effortSystem,
    userPromptId: CONFIDENCE_PROMPT_IDS.effortUser,
    temperature: 0.3,
    maxTokens: 400,
  } satisfies ConfidencePromptConfig,
};

/**
 * Create a schema that includes confidence assessment
 */
export function withConfidenceAssessment<T extends z.ZodRawShape>(
  contentSchema: z.ZodObject<T>
): z.ZodObject<T & { confidenceAssessment: typeof AIConfidenceAssessmentSchema }> {
  return contentSchema.extend({
    confidenceAssessment: AIConfidenceAssessmentSchema,
  }) as z.ZodObject<T & { confidenceAssessment: typeof AIConfidenceAssessmentSchema }>;
}
