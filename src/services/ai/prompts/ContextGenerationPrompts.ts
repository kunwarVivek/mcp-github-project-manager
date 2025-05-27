import { z } from 'zod';

/**
 * AI Prompts for Task Context Generation
 */

// ============================================================================
// Business Context Generation
// ============================================================================

export const BUSINESS_CONTEXT_PROMPT = {
  systemPrompt: `You are an expert business analyst specializing in extracting business context for software development tasks.

Your role is to analyze PRD content and individual tasks to extract comprehensive business context that helps developers understand:
- WHY this task matters to the business
- WHO will be impacted by this task
- HOW success will be measured
- WHAT business value it provides

Focus on creating actionable business context that connects technical implementation to business outcomes.`,

  userPrompt: `Given the following PRD content and specific task, extract comprehensive business context:

**PRD Content:**
{prdContent}

**Task Details:**
- Title: {taskTitle}
- Description: {taskDescription}
- Priority: {taskPriority}

**Extract the following business context:**

1. **Business Objective**: Which specific PRD objective(s) does this task support?
2. **User Impact**: How will this task affect end users? Be specific about benefits.
3. **Success Metrics**: What measurable outcomes indicate this task's success?
4. **Business Value**: What business value does this task provide?
5. **Stakeholder Impact**: Which stakeholders care about this task and why?
6. **Risk Mitigation**: What business risks does this task help mitigate?

Provide specific, actionable context that helps developers understand the business importance of their work.`,

  maxTokens: 1500,
  temperature: 0.3
};

export const BusinessContextSchema = z.object({
  businessObjective: z.string().describe('Primary business objective this task supports'),
  userImpact: z.string().describe('Specific impact on end users'),
  successMetrics: z.array(z.string()).describe('Measurable success indicators'),
  businessValue: z.string().describe('Business value provided by this task'),
  stakeholderImpact: z.array(z.object({
    stakeholder: z.string(),
    impact: z.string(),
    importance: z.enum(['high', 'medium', 'low'])
  })).describe('Impact on different stakeholders'),
  riskMitigation: z.array(z.string()).describe('Business risks this task helps mitigate'),
  priorityJustification: z.string().describe('Why this task has its assigned priority')
});

// ============================================================================
// Technical Context Generation
// ============================================================================

export const TECHNICAL_CONTEXT_PROMPT = {
  systemPrompt: `You are a senior software architect specializing in extracting technical context for development tasks.

Your role is to analyze PRD content and tasks to identify:
- Technical constraints and requirements
- Architectural decisions that affect implementation
- Integration points and system dependencies
- Data requirements and API specifications
- Performance and security considerations

Focus on providing technical context that helps developers make informed implementation decisions.`,

  userPrompt: `Given the following PRD content and task, extract comprehensive technical context:

**PRD Content:**
{prdContent}

**Task Details:**
- Title: {taskTitle}
- Description: {taskDescription}
- Complexity: {taskComplexity}

**Extract the following technical context:**

1. **Technical Constraints**: What technical limitations or requirements must be considered?
2. **Architectural Decisions**: What architectural patterns or decisions affect this task?
3. **Integration Points**: What systems, APIs, or services does this task integrate with?
4. **Data Requirements**: What data models, schemas, or databases are involved?
5. **Performance Requirements**: What performance considerations are relevant?
6. **Security Requirements**: What security constraints or requirements apply?
7. **Technology Stack**: What specific technologies, frameworks, or tools are recommended?

Provide specific technical guidance that helps developers understand implementation constraints and requirements.`,

  maxTokens: 1500,
  temperature: 0.3
};

export const TechnicalContextSchema = z.object({
  technicalConstraints: z.array(z.string()).describe('Technical limitations and requirements'),
  architecturalDecisions: z.array(z.object({
    decision: z.string(),
    rationale: z.string(),
    impact: z.string()
  })).describe('Relevant architectural decisions'),
  integrationPoints: z.array(z.object({
    system: z.string(),
    type: z.enum(['api', 'database', 'service', 'library', 'external']),
    description: z.string(),
    requirements: z.array(z.string())
  })).describe('System integration requirements'),
  dataRequirements: z.array(z.object({
    type: z.enum(['model', 'schema', 'migration', 'query']),
    name: z.string(),
    description: z.string(),
    requirements: z.array(z.string())
  })).describe('Data-related requirements'),
  performanceRequirements: z.array(z.string()).describe('Performance constraints and goals'),
  securityRequirements: z.array(z.string()).describe('Security constraints and requirements'),
  technologyStack: z.array(z.object({
    category: z.enum(['framework', 'library', 'tool', 'service']),
    name: z.string(),
    purpose: z.string(),
    required: z.boolean()
  })).describe('Recommended technology stack')
});

// ============================================================================
// Implementation Guidance Generation
// ============================================================================

export const IMPLEMENTATION_GUIDANCE_PROMPT = {
  systemPrompt: `You are a senior software engineer and technical mentor specializing in providing implementation guidance.

Your role is to analyze tasks and provide practical, step-by-step implementation guidance including:
- Recommended implementation approach
- Specific implementation steps
- Best practices and coding standards
- Common pitfalls and how to avoid them
- Testing strategies and quality assurance

Focus on actionable guidance that helps developers implement tasks efficiently and correctly.`,

  userPrompt: `Given the following task details, provide comprehensive implementation guidance:

**Task Details:**
- Title: {taskTitle}
- Description: {taskDescription}
- Complexity: {taskComplexity}
- Priority: {taskPriority}

**Business Context:**
{businessContext}

**Technical Context:**
{technicalContext}

**Provide the following implementation guidance:**

1. **Recommended Approach**: What's the best overall strategy for implementing this task?
2. **Implementation Steps**: Break down the implementation into specific, actionable steps
3. **Technical Considerations**: What technical aspects need special attention?
4. **Best Practices**: What coding standards and best practices should be followed?
5. **Common Pitfalls**: What mistakes should be avoided and how?
6. **Testing Strategy**: How should this implementation be tested?
7. **Quality Assurance**: What quality checks should be performed?
8. **Performance Optimization**: What performance considerations are important?

Provide practical, actionable guidance that a developer can follow step-by-step.`,

  maxTokens: 2000,
  temperature: 0.4
};

export const ImplementationGuidanceSchema = z.object({
  recommendedApproach: z.string().describe('Overall implementation strategy'),
  implementationSteps: z.array(z.object({
    step: z.number(),
    title: z.string(),
    description: z.string(),
    estimatedTime: z.string(),
    dependencies: z.array(z.string())
  })).describe('Step-by-step implementation guide'),
  technicalConsiderations: z.array(z.string()).describe('Important technical points'),
  bestPractices: z.array(z.object({
    category: z.enum(['coding', 'architecture', 'security', 'performance', 'testing']),
    practice: z.string(),
    rationale: z.string()
  })).describe('Recommended best practices'),
  commonPitfalls: z.array(z.object({
    pitfall: z.string(),
    consequence: z.string(),
    mitigation: z.string()
  })).describe('Common mistakes and how to avoid them'),
  testingStrategy: z.object({
    approach: z.string(),
    testTypes: z.array(z.string()),
    coverage: z.string(),
    tools: z.array(z.string())
  }).describe('Testing approach and strategy'),
  qualityAssurance: z.array(z.string()).describe('Quality checks and validations'),
  performanceOptimization: z.array(z.string()).describe('Performance considerations')
});

// ============================================================================
// Contextual References Generation
// ============================================================================

export const CONTEXTUAL_REFERENCES_PROMPT = {
  systemPrompt: `You are a technical documentation specialist who excels at creating contextual references for development tasks.

Your role is to analyze PRD content and tasks to create comprehensive reference materials including:
- Relevant PRD sections with explanations
- Related features and user stories
- Technical specifications and API references
- Code examples and implementation patterns

Focus on creating references that provide immediate value and reduce context-switching for developers.`,

  userPrompt: `Given the following PRD content and task, create comprehensive contextual references:

**PRD Content:**
{prdContent}

**Task Details:**
- Title: {taskTitle}
- Description: {taskDescription}

**Create the following contextual references:**

1. **PRD Sections**: Extract relevant PRD sections and explain their relevance to this task
2. **Related Features**: Identify related features and explain the relationships
3. **Technical Specifications**: Reference relevant technical specs, APIs, or documentation
4. **Code Examples**: Provide relevant code examples or implementation patterns
5. **External References**: Suggest relevant external documentation or resources

Ensure all references are directly relevant to the task and include clear explanations of why they matter.`,

  maxTokens: 1500,
  temperature: 0.3
};

export const ContextualReferencesSchema = z.object({
  prdSections: z.array(z.object({
    section: z.string(),
    content: z.string(),
    relevance: z.string(),
    importance: z.enum(['critical', 'high', 'medium', 'low'])
  })).describe('Relevant PRD sections with context'),
  relatedFeatures: z.array(z.object({
    featureId: z.string(),
    title: z.string(),
    relationship: z.enum(['implements', 'extends', 'integrates_with', 'depends_on', 'enables']),
    context: z.string()
  })).describe('Related features and their relationships'),
  technicalSpecs: z.array(z.object({
    type: z.enum(['api_spec', 'data_model', 'architecture_doc', 'design_system', 'protocol']),
    title: z.string(),
    description: z.string(),
    relevantSections: z.array(z.string()),
    url: z.string().optional()
  })).describe('Technical specification references'),
  codeExamples: z.array(z.object({
    title: z.string(),
    description: z.string(),
    language: z.string(),
    snippet: z.string(),
    explanation: z.string(),
    source: z.string()
  })).describe('Relevant code examples'),
  externalReferences: z.array(z.object({
    type: z.enum(['documentation', 'tutorial', 'best_practice', 'tool', 'library']),
    title: z.string(),
    description: z.string(),
    url: z.string(),
    relevance: z.string()
  })).describe('External documentation and resources')
});

// ============================================================================
// Enhanced Acceptance Criteria Generation
// ============================================================================

export const ENHANCED_ACCEPTANCE_CRITERIA_PROMPT = {
  systemPrompt: `You are a quality assurance expert specializing in creating comprehensive, testable acceptance criteria.

Your role is to analyze tasks and create detailed acceptance criteria that:
- Are specific, measurable, and testable
- Cover functional, technical, and quality requirements
- Include clear verification methods
- Support different testing approaches

Focus on creating criteria that ensure complete and correct task implementation.`,

  userPrompt: `Given the following task details and context, create enhanced acceptance criteria:

**Task Details:**
- Title: {taskTitle}
- Description: {taskDescription}
- Priority: {taskPriority}

**Business Context:**
{businessContext}

**Technical Context:**
{technicalContext}

**Create enhanced acceptance criteria covering:**

1. **Functional Criteria**: What functional requirements must be met?
2. **Technical Criteria**: What technical requirements must be satisfied?
3. **Quality Criteria**: What quality standards must be achieved?
4. **Integration Criteria**: What integration requirements must be met?
5. **Performance Criteria**: What performance standards must be achieved?
6. **Security Criteria**: What security requirements must be satisfied?

For each criterion, specify:
- Clear, testable description
- Verification method (unit test, integration test, manual test, etc.)
- Priority level (must_have, should_have, nice_to_have)
- Acceptance threshold or success condition`,

  maxTokens: 1500,
  temperature: 0.3
};

export const EnhancedAcceptanceCriteriaSchema = z.object({
  criteria: z.array(z.object({
    id: z.string(),
    category: z.enum(['functional', 'technical', 'quality', 'integration', 'performance', 'security']),
    description: z.string(),
    verificationMethod: z.enum(['unit_test', 'integration_test', 'manual_test', 'code_review', 'demo', 'automated_test']),
    verificationDetails: z.string(),
    priority: z.enum(['must_have', 'should_have', 'nice_to_have']),
    acceptanceThreshold: z.string(),
    testingNotes: z.string().optional()
  })).describe('Enhanced acceptance criteria with verification details')
});

// ============================================================================
// Prompt Configuration
// ============================================================================

export const CONTEXT_GENERATION_CONFIGS = {
  businessContext: {
    systemPrompt: BUSINESS_CONTEXT_PROMPT.systemPrompt,
    userPrompt: BUSINESS_CONTEXT_PROMPT.userPrompt,
    maxTokens: BUSINESS_CONTEXT_PROMPT.maxTokens,
    temperature: BUSINESS_CONTEXT_PROMPT.temperature,
    schema: BusinessContextSchema
  },
  technicalContext: {
    systemPrompt: TECHNICAL_CONTEXT_PROMPT.systemPrompt,
    userPrompt: TECHNICAL_CONTEXT_PROMPT.userPrompt,
    maxTokens: TECHNICAL_CONTEXT_PROMPT.maxTokens,
    temperature: TECHNICAL_CONTEXT_PROMPT.temperature,
    schema: TechnicalContextSchema
  },
  implementationGuidance: {
    systemPrompt: IMPLEMENTATION_GUIDANCE_PROMPT.systemPrompt,
    userPrompt: IMPLEMENTATION_GUIDANCE_PROMPT.userPrompt,
    maxTokens: IMPLEMENTATION_GUIDANCE_PROMPT.maxTokens,
    temperature: IMPLEMENTATION_GUIDANCE_PROMPT.temperature,
    schema: ImplementationGuidanceSchema
  },
  contextualReferences: {
    systemPrompt: CONTEXTUAL_REFERENCES_PROMPT.systemPrompt,
    userPrompt: CONTEXTUAL_REFERENCES_PROMPT.userPrompt,
    maxTokens: CONTEXTUAL_REFERENCES_PROMPT.maxTokens,
    temperature: CONTEXTUAL_REFERENCES_PROMPT.temperature,
    schema: ContextualReferencesSchema
  },
  enhancedAcceptanceCriteria: {
    systemPrompt: ENHANCED_ACCEPTANCE_CRITERIA_PROMPT.systemPrompt,
    userPrompt: ENHANCED_ACCEPTANCE_CRITERIA_PROMPT.userPrompt,
    maxTokens: ENHANCED_ACCEPTANCE_CRITERIA_PROMPT.maxTokens,
    temperature: ENHANCED_ACCEPTANCE_CRITERIA_PROMPT.temperature,
    schema: EnhancedAcceptanceCriteriaSchema
  }
};

/**
 * Helper function to format prompts with variables
 */
export function formatContextPrompt(template: string, variables: Record<string, any>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match;
  });
}
