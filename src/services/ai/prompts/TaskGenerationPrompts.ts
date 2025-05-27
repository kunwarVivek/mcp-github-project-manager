/**
 * Prompts for AI Task Generation and Management
 */

export const TASK_GENERATION_SYSTEM_PROMPT = `You are an expert project manager and software development lead specializing in breaking down complex projects into manageable, actionable tasks. Your role is to analyze requirements and create comprehensive task lists that development teams can execute efficiently.

Key responsibilities:
- Break down features into specific, actionable tasks
- Estimate task complexity and effort accurately
- Identify dependencies between tasks
- Prioritize tasks based on business value and technical constraints
- Create clear acceptance criteria for each task
- Consider technical implementation details

Guidelines:
- Tasks should be specific and actionable
- Each task should be completable within 1-3 days
- Include both development and testing considerations
- Consider infrastructure and deployment needs
- Identify potential blockers and dependencies
- Ensure tasks are properly sized for the team's capacity`;

export const GENERATE_TASKS_FROM_PRD_PROMPT = `Based on the following PRD, generate a comprehensive list of development tasks that need to be completed to build this product.

PRD Content: {prdContent}
Maximum Tasks: {maxTasks}
Include Subtasks: {includeSubtasks}
Auto Estimate: {autoEstimate}

Please create tasks that cover:

1. **Setup and Infrastructure**
   - Project setup and configuration
   - Development environment setup
   - CI/CD pipeline setup
   - Database setup and migrations

2. **Core Features**
   - Break down each feature into specific implementation tasks
   - Include both frontend and backend work
   - Consider API design and implementation
   - Include data modeling tasks

3. **User Interface**
   - UI/UX design tasks
   - Component development
   - Responsive design implementation
   - Accessibility considerations

4. **Testing and Quality**
   - Unit test development
   - Integration testing
   - End-to-end testing
   - Performance testing

5. **Documentation and Deployment**
   - API documentation
   - User documentation
   - Deployment configuration
   - Monitoring and logging setup

For each task, provide:
- Clear, actionable title
- Detailed description
- Acceptance criteria
- Estimated complexity (1-10)
- Estimated hours
- Priority level
- Dependencies on other tasks
- Tags for categorization

Return as a structured JSON array of AITask objects.`;

export const EXPAND_TASK_INTO_SUBTASKS_PROMPT = `Break down the following task into smaller, more manageable subtasks.

Task: {taskTitle}
Description: {taskDescription}
Current Complexity: {currentComplexity}
Max Subtask Depth: {maxDepth}

Create subtasks that:

1. **Are independently completable** - Each subtask should be a complete unit of work
2. **Have clear deliverables** - Specific outcomes that can be verified
3. **Are properly sized** - Each subtask should take 2-8 hours to complete
4. **Follow logical sequence** - Consider the natural order of implementation
5. **Include testing** - Each subtask should include its own testing requirements

Consider breaking down by:
- Technical layers (frontend, backend, database)
- Functional components (authentication, validation, business logic)
- Implementation phases (setup, core logic, error handling, testing)
- User-facing vs. internal components

For each subtask, provide:
- Clear title and description
- Acceptance criteria
- Estimated complexity (1-5 for subtasks)
- Estimated hours
- Dependencies within the parent task

Return as a structured JSON array of SubTask objects.`;

export const ANALYZE_TASK_COMPLEXITY_PROMPT = `Analyze the complexity of the following task and provide a detailed assessment.

Task: {taskTitle}
Description: {taskDescription}
Current Estimate: {currentEstimate}

Please evaluate complexity based on:

1. **Technical Complexity**
   - Algorithm complexity
   - Integration requirements
   - New technology learning curve
   - Architecture considerations

2. **Scope and Size**
   - Amount of code to write
   - Number of components affected
   - Testing requirements
   - Documentation needs

3. **Dependencies and Risks**
   - External dependencies
   - Team dependencies
   - Technical risks
   - Unknown factors

4. **Implementation Factors**
   - Available expertise
   - Code reusability
   - Existing infrastructure
   - Tool availability

Provide:
- Complexity score (1-10) with justification
- Effort estimate in hours
- Risk factors and mitigation strategies
- Recommendations for task breakdown
- Suggested approach or implementation strategy

Return as a structured analysis with specific recommendations.`;

export const SUGGEST_TASK_DEPENDENCIES_PROMPT = `Analyze the following list of tasks and suggest dependencies between them.

Tasks: {taskList}

For each task, identify:

1. **Blocking Dependencies** - Tasks that must be completed before this task can start
2. **Related Dependencies** - Tasks that should be coordinated or done together
3. **Soft Dependencies** - Tasks that would benefit from being done in sequence

Consider:
- Technical dependencies (infrastructure before features)
- Data dependencies (models before business logic)
- UI dependencies (design before implementation)
- Testing dependencies (code before tests)
- Deployment dependencies (features before deployment scripts)

For each dependency, provide:
- Type: "blocks", "depends_on", or "related_to"
- Reason for the dependency
- Impact if dependency is not respected
- Suggestions for parallel work where possible

Return as a structured JSON object mapping task IDs to their dependencies.`;

export const PRIORITIZE_TASKS_PROMPT = `Prioritize the following list of tasks based on business value, technical dependencies, and project goals.

Tasks: {taskList}
Project Goals: {projectGoals}
Timeline: {timeline}
Team Size: {teamSize}

Prioritization criteria:
1. **Business Value** - Impact on user experience and business objectives
2. **Technical Dependencies** - What needs to be done first for other work to proceed
3. **Risk Mitigation** - Address high-risk items early
4. **Team Efficiency** - Consider team skills and parallel work opportunities
5. **Milestone Alignment** - Ensure critical path items are prioritized

For each task, assign:
- Priority level: Critical, High, Medium, Low
- Justification for the priority
- Suggested sprint or milestone
- Recommended team member type (if applicable)

Consider:
- MVP requirements vs. nice-to-have features
- Infrastructure and setup tasks (usually high priority)
- User-facing features vs. internal tools
- Testing and quality assurance tasks
- Documentation and deployment tasks

Return as a structured JSON array with prioritized tasks and reasoning.`;

export const ESTIMATE_TASK_EFFORT_PROMPT = `Provide detailed effort estimates for the following task.

Task: {taskTitle}
Description: {taskDescription}
Complexity: {complexity}
Team Experience: {teamExperience}

Break down the effort estimate into:

1. **Analysis and Planning** (10-20% of total)
   - Requirements analysis
   - Technical design
   - Planning and coordination

2. **Implementation** (50-70% of total)
   - Core development work
   - Code writing and refactoring
   - Integration work

3. **Testing** (15-25% of total)
   - Unit testing
   - Integration testing
   - Manual testing and validation

4. **Documentation and Review** (5-15% of total)
   - Code documentation
   - User documentation
   - Code review and refinement

Consider factors:
- Team's familiarity with the technology
- Complexity of the requirements
- Quality standards and review processes
- Potential for reusing existing code
- Risk of scope creep or changes

Provide:
- Total estimated hours
- Breakdown by activity type
- Confidence level (High/Medium/Low)
- Risk factors that could affect the estimate
- Recommendations for reducing effort

Return as a structured estimate with detailed breakdown.`;

/**
 * Helper function to format task generation prompts
 */
export function formatTaskPrompt(template: string, variables: Record<string, any>): string {
  let formatted = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    formatted = formatted.replace(new RegExp(placeholder, 'g'), stringValue);
  }
  
  return formatted;
}

/**
 * Task generation prompt configurations
 */
export const TASK_PROMPT_CONFIGS = {
  generateFromPRD: {
    systemPrompt: TASK_GENERATION_SYSTEM_PROMPT,
    userPrompt: GENERATE_TASKS_FROM_PRD_PROMPT,
    maxTokens: 4000,
    temperature: 0.6
  },
  
  expandTask: {
    systemPrompt: TASK_GENERATION_SYSTEM_PROMPT,
    userPrompt: EXPAND_TASK_INTO_SUBTASKS_PROMPT,
    maxTokens: 2000,
    temperature: 0.5
  },
  
  analyzeComplexity: {
    systemPrompt: TASK_GENERATION_SYSTEM_PROMPT,
    userPrompt: ANALYZE_TASK_COMPLEXITY_PROMPT,
    maxTokens: 1500,
    temperature: 0.4
  },
  
  suggestDependencies: {
    systemPrompt: TASK_GENERATION_SYSTEM_PROMPT,
    userPrompt: SUGGEST_TASK_DEPENDENCIES_PROMPT,
    maxTokens: 2000,
    temperature: 0.5
  },
  
  prioritizeTasks: {
    systemPrompt: TASK_GENERATION_SYSTEM_PROMPT,
    userPrompt: PRIORITIZE_TASKS_PROMPT,
    maxTokens: 2500,
    temperature: 0.6
  },
  
  estimateEffort: {
    systemPrompt: TASK_GENERATION_SYSTEM_PROMPT,
    userPrompt: ESTIMATE_TASK_EFFORT_PROMPT,
    maxTokens: 1500,
    temperature: 0.4
  }
};
