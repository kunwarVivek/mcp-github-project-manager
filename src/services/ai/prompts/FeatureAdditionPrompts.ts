/**
 * Prompts for Feature Addition and Lifecycle Management
 */

export const FEATURE_ADDITION_SYSTEM_PROMPT = `You are an expert product manager and feature analyst specializing in evaluating, designing, and integrating new features into existing products. Your role is to analyze feature requests, assess their impact, and create comprehensive implementation plans.

Key responsibilities:
- Evaluate feature requests for business value and technical feasibility
- Design features that integrate seamlessly with existing functionality
- Break down features into actionable development tasks
- Assess risks and dependencies
- Create realistic implementation timelines
- Ensure features align with product strategy and user needs

Guidelines:
- Consider existing product architecture and constraints
- Evaluate impact on current users and workflows
- Assess technical complexity and resource requirements
- Identify potential conflicts with existing features
- Design for scalability and maintainability
- Focus on user value and business objectives`;

export const ANALYZE_FEATURE_REQUEST_PROMPT = `Analyze the following feature request and provide a comprehensive assessment.

Feature Request: {featureIdea}
Description: {description}
Existing PRD: {existingPRD}
Current Project State: {projectState}
Business Justification: {businessJustification}
Target Users: {targetUsers}

Please provide a detailed analysis including:

1. **Feature Assessment**
   - Business value and impact
   - Alignment with existing product strategy
   - User value proposition
   - Competitive advantage

2. **Technical Feasibility**
   - Integration complexity with existing features
   - Required technical changes
   - Potential architectural impacts
   - Resource requirements

3. **Risk Analysis**
   - Technical risks and challenges
   - Business risks and market considerations
   - User experience risks
   - Timeline and resource risks

4. **Implementation Strategy**
   - Recommended approach
   - Phased implementation plan
   - Dependencies on existing features
   - Required team expertise

5. **Recommendation**
   - Approve/Reject/Modify recommendation
   - Priority level (Critical/High/Medium/Low)
   - Estimated complexity (1-10)
   - Suggested timeline

Return as a structured analysis with specific recommendations.`;

export const EXPAND_FEATURE_TO_TASKS_PROMPT = `Break down the following approved feature into a comprehensive set of development tasks.

Feature: {featureTitle}
Description: {featureDescription}
User Stories: {userStories}
Acceptance Criteria: {acceptanceCriteria}
Existing System Context: {systemContext}
Integration Points: {integrationPoints}

Create tasks that cover:

1. **Analysis and Design**
   - Requirements analysis
   - Technical design
   - UI/UX design
   - Integration planning

2. **Development Tasks**
   - Backend implementation
   - Frontend implementation
   - API development
   - Database changes

3. **Integration Tasks**
   - Integration with existing features
   - Data migration (if needed)
   - Configuration updates
   - Third-party integrations

4. **Quality Assurance**
   - Unit testing
   - Integration testing
   - User acceptance testing
   - Performance testing

5. **Deployment and Documentation**
   - Deployment scripts
   - Documentation updates
   - User training materials
   - Monitoring setup

For each task, provide:
- Clear, actionable title
- Detailed description
- Acceptance criteria
- Dependencies on other tasks
- Estimated complexity (1-10)
- Estimated hours
- Priority level
- Required skills/expertise
- Risk factors

Return as a structured JSON array of AITask objects with complete lifecycle information.`;

export const ASSESS_FEATURE_IMPACT_PROMPT = `Assess the impact of adding this feature to the existing product.

New Feature: {newFeature}
Existing Features: {existingFeatures}
Current User Base: {userBase}
System Architecture: {architecture}

Analyze the impact on:

1. **Existing Features**
   - Which features will be affected?
   - What changes are required?
   - Are there any conflicts?
   - Performance implications?

2. **User Experience**
   - How will current users be affected?
   - Changes to existing workflows?
   - Learning curve for new functionality?
   - Accessibility considerations?

3. **Technical Architecture**
   - Database schema changes
   - API modifications
   - Infrastructure requirements
   - Security implications

4. **Business Impact**
   - Resource allocation requirements
   - Timeline impact on other features
   - Support and maintenance overhead
   - Revenue/cost implications

5. **Risk Mitigation**
   - Potential rollback strategies
   - Feature flags and gradual rollout
   - Testing strategies
   - User communication plan

Provide specific recommendations for managing the integration and minimizing risks.`;

export const GENERATE_FEATURE_ROADMAP_PROMPT = `Create an updated feature roadmap that includes the new feature.

Current Roadmap: {currentRoadmap}
New Feature: {newFeature}
Project Timeline: {timeline}
Team Capacity: {teamCapacity}
Business Priorities: {businessPriorities}

Generate an updated roadmap that:

1. **Integrates the new feature** appropriately into the timeline
2. **Considers dependencies** between features
3. **Balances priorities** and resource constraints
4. **Maintains realistic timelines** based on team capacity
5. **Aligns with business objectives** and user needs

For each quarter/milestone, provide:
- Features to be delivered
- Key themes and objectives
- Resource allocation
- Risk factors and mitigation
- Success metrics

Structure the roadmap by quarters with clear deliverables and dependencies.`;

export const TRACK_TASK_LIFECYCLE_PROMPT = `Analyze the current state of this task and provide lifecycle management recommendations.

Task: {taskTitle}
Current Phase: {currentPhase}
Progress: {progressData}
Blockers: {blockers}
Team Context: {teamContext}

Provide analysis and recommendations for:

1. **Current State Assessment**
   - Phase completion status
   - Progress against estimates
   - Quality of deliverables
   - Team performance

2. **Blocker Analysis**
   - Severity and impact of current blockers
   - Root cause analysis
   - Recommended resolution strategies
   - Timeline impact

3. **Next Steps**
   - Immediate actions required
   - Phase transition criteria
   - Resource needs
   - Risk mitigation

4. **Timeline Adjustment**
   - Updated completion estimates
   - Impact on dependent tasks
   - Resource reallocation needs
   - Stakeholder communication requirements

5. **Quality Gates**
   - Completion criteria for current phase
   - Quality checkpoints
   - Review requirements
   - Approval processes

Return actionable recommendations with specific next steps and updated timelines.`;

/**
 * Helper function to format feature addition prompts
 */
export function formatFeaturePrompt(template: string, variables: Record<string, any>): string {
  let formatted = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    const stringValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    formatted = formatted.replace(new RegExp(placeholder, 'g'), stringValue);
  }
  
  return formatted;
}

/**
 * Feature addition prompt configurations
 */
export const FEATURE_PROMPT_CONFIGS = {
  analyzeRequest: {
    systemPrompt: FEATURE_ADDITION_SYSTEM_PROMPT,
    userPrompt: ANALYZE_FEATURE_REQUEST_PROMPT,
    maxTokens: 3000,
    temperature: 0.6
  },
  
  expandToTasks: {
    systemPrompt: FEATURE_ADDITION_SYSTEM_PROMPT,
    userPrompt: EXPAND_FEATURE_TO_TASKS_PROMPT,
    maxTokens: 4000,
    temperature: 0.5
  },
  
  assessImpact: {
    systemPrompt: FEATURE_ADDITION_SYSTEM_PROMPT,
    userPrompt: ASSESS_FEATURE_IMPACT_PROMPT,
    maxTokens: 2500,
    temperature: 0.6
  },
  
  generateRoadmap: {
    systemPrompt: FEATURE_ADDITION_SYSTEM_PROMPT,
    userPrompt: GENERATE_FEATURE_ROADMAP_PROMPT,
    maxTokens: 3000,
    temperature: 0.7
  },
  
  trackLifecycle: {
    systemPrompt: FEATURE_ADDITION_SYSTEM_PROMPT,
    userPrompt: TRACK_TASK_LIFECYCLE_PROMPT,
    maxTokens: 2000,
    temperature: 0.4
  }
};
