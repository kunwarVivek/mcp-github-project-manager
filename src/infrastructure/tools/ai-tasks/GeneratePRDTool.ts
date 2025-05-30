import { z } from 'zod';
import { ToolDefinition, ToolSchema } from '../ToolValidator';
import { PRDGenerationService } from '../../../services/PRDGenerationService';
import { MCPResponse } from '../../../domain/mcp-types';
import { ToolResultFormatter } from '../ToolResultFormatter';

// Schema for generate_prd tool
const generatePRDSchema = z.object({
  projectIdea: z.string().min(20).describe('The project idea or concept to create a PRD for'),
  projectName: z.string().min(3).describe('Name of the project'),
  targetUsers: z.array(z.string()).optional().describe('Target user groups'),
  timeline: z.string().optional().describe('Expected project timeline (e.g., "3 months", "Q1 2024")'),
  complexity: z.enum(['low', 'medium', 'high']).default('medium').describe('Expected project complexity'),
  author: z.string().describe('Author of the PRD'),
  stakeholders: z.array(z.string()).optional().describe('Project stakeholders'),
  includeResearch: z.boolean().default(false).describe('Whether to include market research and competitive analysis'),
  industryContext: z.string().optional().describe('Industry or domain context for the project')
});

export type GeneratePRDArgs = z.infer<typeof generatePRDSchema>;

/**
 * Implementation function for generate_prd tool
 */
async function executeGeneratePRD(args: GeneratePRDArgs): Promise<MCPResponse> {
  const prdService = new PRDGenerationService();

  try {
    // Generate comprehensive PRD from project idea
    const prd = await prdService.generatePRDFromIdea({
      projectIdea: args.projectIdea,
      projectName: args.projectName,
      targetUsers: args.targetUsers,
      timeline: args.timeline,
      complexity: args.complexity,
      author: args.author,
      stakeholders: args.stakeholders
    });

    // Validate PRD completeness
    const validation = await prdService.validatePRDCompleteness(prd);

    // Format response
    const summary = formatPRDGenerationSummary(prd, validation);

    return ToolResultFormatter.formatSuccess('generate_prd', {
      summary,
      prd,
      validation,
      completenessScore: validation.score,
      isComplete: validation.isComplete
    });

  } catch (error) {
    process.stderr.write(`Error in generate_prd tool: ${error}\n`);

    // Check if this is an AI availability error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isAIUnavailable = errorMessage.includes('AI service is not available') ||
                           errorMessage.includes('API key') ||
                           errorMessage.includes('provider');

    if (isAIUnavailable) {
      const aiErrorSummary = formatAIUnavailableMessage('generate_prd', errorMessage);
      return ToolResultFormatter.formatSuccess('generate_prd', {
        content: [{ type: 'text', text: aiErrorSummary }],
        success: false,
        aiAvailable: false
      });
    }

    return ToolResultFormatter.formatSuccess('generate_prd', {
      content: [{
        type: 'text',
        text: `# Failed to generate PRD\n\n**Error:** ${errorMessage}\n\nPlease check your input parameters and try again.`
      }],
      success: false
    });
  }
}

/**
 * Helper function to format AI unavailable message
 */
function formatAIUnavailableMessage(toolName: string, errorMessage: string): string {
  return `# AI Service Unavailable

## ${toolName} Tool Status: ⚠️ Temporarily Unavailable

The AI-powered PRD generation feature is currently unavailable because no AI providers are configured.

### What happened?
${errorMessage}

### How to fix this:

1. **Configure at least one AI provider** by setting environment variables:
   \`\`\`bash
   # Anthropic Claude (Recommended)
   export ANTHROPIC_API_KEY="your_anthropic_api_key_here"

   # OpenAI GPT (Alternative)
   export OPENAI_API_KEY="your_openai_api_key_here"

   # Google Gemini (Alternative)
   export GOOGLE_API_KEY="your_google_api_key_here"

   # Perplexity (For research)
   export PERPLEXITY_API_KEY="your_perplexity_api_key_here"
   \`\`\`

2. **Restart the MCP server** after setting the environment variables

3. **Try the command again** once AI services are available

### Alternative Options:

While AI services are unavailable, you can still:
- Use non-AI GitHub project management features
- Create manual PRDs using templates
- Manage existing projects and tasks
- Use other MCP tools that don't require AI

### Need Help?

- Check the documentation for API key setup instructions
- Verify your API keys are valid and have sufficient credits
- Contact support if the issue persists

The MCP server will continue to work normally for all non-AI features.`;
}

/**
 * Helper function to format PRD generation summary
 */
function formatPRDGenerationSummary(prd: any, validation: any): string {
  const sections = [
    '# PRD Generation Complete',
    '',
    `## ${prd.title}`,
    `**Version:** ${prd.version}`,
    `**Author:** ${prd.author}`,
    `**Created:** ${new Date(prd.createdAt).toLocaleString()}`,
    `**AI Generated:** ${prd.aiGenerated ? 'Yes' : 'No'}`,
    ''
  ];

  // Overview
  if (prd.overview) {
    sections.push(
      '## Project Overview',
      prd.overview.substring(0, 300) + (prd.overview.length > 300 ? '...' : ''),
      ''
    );
  }

  // Objectives
  if (prd.objectives && prd.objectives.length > 0) {
    sections.push(
      '## Key Objectives',
      ...prd.objectives.slice(0, 5).map((obj: string) => `- ${obj}`),
      prd.objectives.length > 5 ? `... and ${prd.objectives.length - 5} more` : '',
      ''
    );
  }

  // Target Users
  if (prd.targetUsers && prd.targetUsers.length > 0) {
    sections.push(
      '## Target Users',
      ...prd.targetUsers.slice(0, 3).map((user: any) => `- **${user.name}**: ${user.description}`),
      ''
    );
  }

  // Features
  if (prd.features && prd.features.length > 0) {
    sections.push(
      '## Key Features',
      `**Total Features:** ${prd.features.length}`,
      ''
    );

    // Feature breakdown by priority
    const featuresByPriority = prd.features.reduce((acc: any, feature: any) => {
      acc[feature.priority] = (acc[feature.priority] || 0) + 1;
      return acc;
    }, {});

    sections.push(
      '**Features by Priority:**',
      ...Object.entries(featuresByPriority).map(([priority, count]) =>
        `- ${priority}: ${count} feature${(count as number) > 1 ? 's' : ''}`
      ),
      ''
    );

    // Top priority features
    const highPriorityFeatures = prd.features
      .filter((f: any) => f.priority === 'critical' || f.priority === 'high')
      .slice(0, 5);

    if (highPriorityFeatures.length > 0) {
      sections.push(
        '**High-Priority Features:**',
        ...highPriorityFeatures.map((feature: any) =>
          `- ${feature.title} (complexity: ${feature.estimatedComplexity}/10)`
        ),
        ''
      );
    }
  }

  // Technical Requirements
  if (prd.technicalRequirements && prd.technicalRequirements.length > 0) {
    sections.push(
      '## Technical Requirements',
      `**Total Requirements:** ${prd.technicalRequirements.length}`,
      ''
    );

    // Requirements by category
    const reqsByCategory = prd.technicalRequirements.reduce((acc: any, req: any) => {
      acc[req.category] = (acc[req.category] || 0) + 1;
      return acc;
    }, {});

    sections.push(
      '**Requirements by Category:**',
      ...Object.entries(reqsByCategory).map(([category, count]) =>
        `- ${category}: ${count} requirement${(count as number) > 1 ? 's' : ''}`
      ),
      ''
    );
  }

  // Quality Assessment
  sections.push(
    '## Quality Assessment',
    `**Completeness Score:** ${validation.score}/100`,
    `**Status:** ${validation.isComplete ? '✅ Complete' : '⚠️ Needs Improvement'}`,
    ''
  );

  if (validation.missingElements.length > 0) {
    sections.push(
      '**Missing Elements:**',
      ...validation.missingElements.map((element: string) => `- ${element}`),
      ''
    );
  }

  if (validation.recommendations.length > 0) {
    sections.push(
      '**Recommendations:**',
      ...validation.recommendations.slice(0, 3).map((rec: string) => `- ${rec}`),
      ''
    );
  }

  // Project Scope
  if (prd.scope) {
    sections.push(
      '## Project Scope',
      `**In Scope:** ${prd.scope.inScope?.length || 0} items`,
      `**Out of Scope:** ${prd.scope.outOfScope?.length || 0} items`,
      `**Assumptions:** ${prd.scope.assumptions?.length || 0} items`,
      `**Constraints:** ${prd.scope.constraints?.length || 0} items`,
      ''
    );
  }

  // Timeline and Milestones
  if (prd.timeline || (prd.milestones && prd.milestones.length > 0)) {
    sections.push('## Timeline');

    if (prd.timeline) {
      sections.push(`**Timeline:** ${prd.timeline}`);
    }

    if (prd.milestones && prd.milestones.length > 0) {
      sections.push(
        `**Milestones:** ${prd.milestones.length} defined`,
        ...prd.milestones.slice(0, 3).map((milestone: string) => `- ${milestone}`)
      );
    }
    sections.push('');
  }

  // Success Metrics
  if (prd.successMetrics && prd.successMetrics.length > 0) {
    sections.push(
      '## Success Metrics',
      ...prd.successMetrics.slice(0, 5).map((metric: string) => `- ${metric}`),
      ''
    );
  }

  // Next Steps
  sections.push(
    '## Next Steps',
    '1. Review the generated PRD and refine as needed',
    '2. Share with stakeholders for feedback and approval',
    '3. Use `add_feature` to add new features to this PRD',
    '4. Use `parse_prd` to generate tasks from this PRD',
    '5. Create a GitHub project to track implementation',
    ''
  );

  // Related Commands
  sections.push(
    '## Related Commands',
    '- `enhance_prd` - Improve and expand this PRD',
    '- `validate_prd` - Check PRD quality and completeness',
    '- `add_feature` - Add new features to this PRD',
    '- `parse_prd` - Generate tasks from this PRD',
    '- `extract_features` - Extract feature list for analysis'
  );

  return sections.join('\n');
}

// Tool definition
export const generatePRDTool: ToolDefinition<GeneratePRDArgs> = {
  name: "generate_prd",
  description: "Generate a comprehensive Product Requirements Document (PRD) from a project idea using AI analysis and industry best practices",
  schema: generatePRDSchema as unknown as ToolSchema<GeneratePRDArgs>,
  examples: [
    {
      name: "Generate PRD for task management app",
      description: "Create a comprehensive PRD for a new task management application",
      args: {
        projectIdea: "A modern task management application with AI-powered prioritization, team collaboration features, and integration with popular development tools like GitHub and Slack",
        projectName: "TaskFlow AI",
        targetUsers: ["software developers", "project managers", "small teams"],
        timeline: "6 months",
        complexity: "medium",
        author: "product-team",
        stakeholders: ["engineering", "design", "marketing"],
        includeResearch: true,
        industryContext: "productivity software"
      }
    }
  ]
};

// Export the execution function for the tool registry
export { executeGeneratePRD };
