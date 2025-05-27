/**
 * Prompts for PRD (Product Requirements Document) Generation
 */

export const PRD_GENERATION_SYSTEM_PROMPT = `You are an expert product manager and technical writer specializing in creating comprehensive Product Requirements Documents (PRDs). Your role is to transform project ideas and descriptions into detailed, actionable PRDs that development teams can use to build successful products.

Key responsibilities:
- Analyze project ideas and extract core requirements
- Define clear user personas and use cases
- Break down features into detailed requirements
- Identify technical constraints and dependencies
- Create realistic timelines and milestones
- Ensure all requirements are testable and measurable

Guidelines:
- Write in clear, professional language
- Be specific and avoid ambiguous terms
- Include both functional and non-functional requirements
- Consider scalability, security, and performance from the start
- Structure information logically and comprehensively
- Focus on user value and business objectives`;

export const GENERATE_PRD_FROM_IDEA_PROMPT = `Based on the following project idea, generate a comprehensive Product Requirements Document (PRD).

Project Idea: {projectIdea}
Target Users: {targetUsers}
Timeline: {timeline}
Complexity Level: {complexity}

Please create a detailed PRD that includes:

1. **Project Overview**
   - Clear project description and vision
   - Primary objectives and goals
   - Success metrics and KPIs

2. **User Analysis**
   - Detailed user personas (at least 2-3)
   - User journey mapping
   - Pain points and motivations

3. **Scope Definition**
   - What's in scope for this project
   - What's explicitly out of scope
   - Key assumptions and constraints

4. **Feature Requirements**
   - Core features with detailed descriptions
   - User stories for each feature
   - Acceptance criteria
   - Priority levels (Critical/High/Medium/Low)
   - Estimated complexity (1-10 scale)

5. **Technical Requirements**
   - Performance requirements
   - Security considerations
   - Scalability needs
   - Integration requirements
   - Infrastructure considerations

6. **Project Timeline**
   - Key milestones
   - Dependencies between features
   - Risk assessment

Return the response as a structured JSON object matching the PRDDocument schema.`;

export const ENHANCE_EXISTING_PRD_PROMPT = `Review and enhance the following PRD to make it more comprehensive and actionable.

Current PRD: {currentPRD}
Enhancement Type: {enhancementType}
Focus Areas: {focusAreas}

Please enhance the PRD by:

1. **Filling gaps** in the current documentation
2. **Adding missing details** to existing sections
3. **Improving clarity** and specificity
4. **Adding user stories** where missing
5. **Enhancing acceptance criteria**
6. **Identifying potential risks** and mitigation strategies
7. **Suggesting additional features** that would add value

Focus particularly on:
- Making requirements more specific and measurable
- Adding technical considerations that may have been missed
- Improving user persona definitions
- Enhancing the feature breakdown
- Adding realistic effort estimates

Return the enhanced PRD as a structured JSON object.`;

export const EXTRACT_FEATURES_FROM_PRD_PROMPT = `Analyze the following PRD and extract a comprehensive list of features that need to be implemented.

PRD Content: {prdContent}

For each feature, provide:

1. **Feature Title** - Clear, concise name
2. **Description** - Detailed explanation of what the feature does
3. **User Stories** - At least 2-3 user stories per feature
4. **Acceptance Criteria** - Specific, testable criteria
5. **Priority Level** - Critical/High/Medium/Low
6. **Complexity Estimate** - 1-10 scale
7. **Dependencies** - Other features this depends on
8. **Technical Considerations** - Any specific technical requirements

Group related features together and ensure comprehensive coverage of the PRD requirements.

Return as a structured JSON array of FeatureRequirement objects.`;

export const VALIDATE_PRD_COMPLETENESS_PROMPT = `Evaluate the following PRD for completeness and quality. Identify any gaps, inconsistencies, or areas that need improvement.

PRD to Validate: {prdContent}

Please assess:

1. **Completeness Check**
   - Are all essential sections present?
   - Are user personas well-defined?
   - Are features clearly described?
   - Are technical requirements specified?

2. **Quality Assessment**
   - Are requirements specific and measurable?
   - Are acceptance criteria testable?
   - Are priorities clearly defined?
   - Is the scope well-bounded?

3. **Consistency Review**
   - Do features align with objectives?
   - Are timelines realistic?
   - Are dependencies properly identified?

4. **Gap Analysis**
   - What's missing from the PRD?
   - What needs more detail?
   - What could be clearer?

5. **Improvement Suggestions**
   - Specific recommendations for enhancement
   - Additional considerations to include
   - Risk factors to address

Return a detailed assessment with specific recommendations for improvement.`;

export const GENERATE_USER_STORIES_PROMPT = `Based on the following feature description, generate comprehensive user stories that cover all aspects of the feature.

Feature: {featureTitle}
Description: {featureDescription}
Target Users: {targetUsers}

Generate user stories that:

1. **Cover different user types** and scenarios
2. **Include edge cases** and error conditions
3. **Address accessibility** requirements
4. **Consider mobile and desktop** experiences
5. **Include admin/management** perspectives where relevant

For each user story, provide:
- User story in "As a [user], I want [goal] so that [benefit]" format
- Detailed acceptance criteria
- Priority level
- Estimated complexity

Ensure stories are:
- Independent and testable
- Valuable to users
- Estimable in terms of effort
- Small enough to complete in a sprint
- Testable with clear success criteria

Return as a structured JSON array of user stories.`;

/**
 * Helper function to format prompts with variables
 */
export function formatPrompt(template: string, variables: Record<string, string>): string {
  let formatted = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    formatted = formatted.replace(new RegExp(placeholder, 'g'), value);
  }
  
  return formatted;
}

/**
 * PRD Generation prompt configurations
 */
export const PRD_PROMPT_CONFIGS = {
  generateFromIdea: {
    systemPrompt: PRD_GENERATION_SYSTEM_PROMPT,
    userPrompt: GENERATE_PRD_FROM_IDEA_PROMPT,
    maxTokens: 4000,
    temperature: 0.7
  },
  
  enhanceExisting: {
    systemPrompt: PRD_GENERATION_SYSTEM_PROMPT,
    userPrompt: ENHANCE_EXISTING_PRD_PROMPT,
    maxTokens: 3000,
    temperature: 0.6
  },
  
  extractFeatures: {
    systemPrompt: PRD_GENERATION_SYSTEM_PROMPT,
    userPrompt: EXTRACT_FEATURES_FROM_PRD_PROMPT,
    maxTokens: 2500,
    temperature: 0.5
  },
  
  validateCompleteness: {
    systemPrompt: PRD_GENERATION_SYSTEM_PROMPT,
    userPrompt: VALIDATE_PRD_COMPLETENESS_PROMPT,
    maxTokens: 2000,
    temperature: 0.4
  },
  
  generateUserStories: {
    systemPrompt: PRD_GENERATION_SYSTEM_PROMPT,
    userPrompt: GENERATE_USER_STORIES_PROMPT,
    maxTokens: 2000,
    temperature: 0.6
  }
};
