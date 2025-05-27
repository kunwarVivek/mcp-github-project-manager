import { z } from 'zod';
import { ToolDefinition, ToolSchema } from '../ToolValidator.js';
import { PRDGenerationService } from '../../../services/PRDGenerationService.js';
import { MCPResponse } from '../../../domain/mcp-types.js';
import { ToolResultFormatter } from '../ToolResultFormatter.js';

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
    console.error('Error in generate_prd tool:', error);
    return ToolResultFormatter.formatSuccess('generate_prd', {
      error: `Failed to generate PRD: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false
    });
  }
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
