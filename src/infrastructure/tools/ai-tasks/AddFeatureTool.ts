import { z } from 'zod';
import { ToolDefinition, ToolSchema } from '../ToolValidator.js';
import { FeatureManagementService } from '../../../services/FeatureManagementService.js';
import { ResourceManager } from '../../resource/ResourceManager.js';
import { ResourceType } from '../../../domain/resource-types.js';
import { MCPResponse } from '../../../domain/mcp-types.js';
import { ToolResultFormatter } from '../ToolResultFormatter.js';

// Schema for add_feature tool
const addFeatureSchema = z.object({
  featureIdea: z.string().min(10).describe('The feature idea or title'),
  description: z.string().min(20).describe('Detailed description of the feature'),
  targetPRD: z.string().optional().describe('ID of the PRD to add the feature to'),
  targetProject: z.string().optional().describe('GitHub project ID to add tasks to'),
  businessJustification: z.string().optional().describe('Business justification for the feature'),
  targetUsers: z.array(z.string()).optional().describe('Target user groups for this feature'),
  requestedBy: z.string().describe('Person requesting the feature'),
  autoApprove: z.boolean().default(false).describe('Whether to auto-approve the feature without manual review'),
  expandToTasks: z.boolean().default(true).describe('Whether to immediately expand the feature into tasks'),
  createLifecycle: z.boolean().default(true).describe('Whether to create complete task lifecycle management')
});

export type AddFeatureArgs = z.infer<typeof addFeatureSchema>;

/**
 * Implementation function for add_feature tool
 */
async function executeAddFeature(args: AddFeatureArgs): Promise<MCPResponse> {
  const featureService = new FeatureManagementService();

  try {
    // For now, we'll create a simplified implementation
    // In a full implementation, you'd integrate with ResourceManager

    // Create complete feature lifecycle
    const result = await featureService.createCompleteFeatureLifecycle({
      featureIdea: args.featureIdea,
      description: args.description,
      targetPRD: undefined, // Would get from ResourceManager
      targetProject: args.targetProject,
      requestedBy: args.requestedBy,
      businessJustification: args.businessJustification,
      autoApprove: args.autoApprove
    });

    // Format response
    const summary = formatFeatureAdditionSummary(result);

    return ToolResultFormatter.formatSuccess('add_feature', {
      summary,
      featureRequest: result.featureRequest,
      tasksCreated: result.expansionResult?.tasks.length || 0,
      estimatedEffort: result.expansionResult?.estimatedEffort || 0
    });

  } catch (error) {
    process.stderr.write(`Error in add_feature tool: ${error}\n`);
    return ToolResultFormatter.formatSuccess('add_feature', {
      error: `Failed to add feature: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false
    });
  }
}

/**
 * Helper function to format feature addition summary
 */
function formatFeatureAdditionSummary(result: any): string {
    const sections = [
      '# Feature Addition Complete',
      '',
      `## Feature: ${result.featureRequest.featureIdea}`,
      `**Status:** ${result.featureRequest.status}`,
      `**Requested by:** ${result.featureRequest.requestedBy}`,
      `**Created:** ${new Date(result.featureRequest.createdAt).toLocaleString()}`,
      ''
    ];

    // Analysis summary
    if (result.analysis) {
      sections.push(
        '## Analysis Summary',
        `**Recommendation:** ${result.analysis.recommendation}`,
        `**Priority:** ${result.analysis.priority}`,
        `**Complexity:** ${result.analysis.complexity}/10`,
        `**Estimated Effort:** ${result.analysis.estimatedEffort} hours`,
        ''
      );

      if (result.analysis.risks.length > 0) {
        sections.push(
          '**Key Risks:**',
          ...result.analysis.risks.map((risk: string) => `- ${risk}`),
          ''
        );
      }
    }

    // PRD update
    if (result.updatedPRD) {
      sections.push(
        '## PRD Updated',
        `**PRD:** ${result.updatedPRD.title}`,
        `**Version:** ${result.updatedPRD.version}`,
        `**Total Features:** ${result.updatedPRD.features.length}`,
        ''
      );
    }

    // Task breakdown
    if (result.expansionResult) {
      sections.push(
        '## Task Breakdown',
        `**Total Tasks:** ${result.expansionResult.tasks.length}`,
        `**Estimated Effort:** ${result.expansionResult.estimatedEffort} hours`,
        `**Risk Level:** ${result.expansionResult.riskAssessment.level}`,
        `**Suggested Milestone:** ${result.expansionResult.suggestedMilestone}`,
        ''
      );

      // Task summary by priority
      const tasksByPriority = result.expansionResult.tasks.reduce((acc: any, task: any) => {
        acc[task.priority] = (acc[task.priority] || 0) + 1;
        return acc;
      }, {});

      sections.push(
        '**Tasks by Priority:**',
        ...Object.entries(tasksByPriority).map(([priority, count]) =>
          `- ${priority}: ${count} tasks`
        ),
        ''
      );

      // High-priority tasks
      const highPriorityTasks = result.expansionResult.tasks
        .filter((task: any) => task.priority === 'critical' || task.priority === 'high')
        .slice(0, 5);

      if (highPriorityTasks.length > 0) {
        sections.push(
          '**High-Priority Tasks:**',
          ...highPriorityTasks.map((task: any) =>
            `- ${task.title} (${task.complexity}/10, ${task.estimatedHours}h)`
          ),
          ''
        );
      }
    }

    // Lifecycle management
    if (result.lifecycleStates) {
      sections.push(
        '## Lifecycle Management',
        `**Tasks with Lifecycle Tracking:** ${result.lifecycleStates.length}`,
        `**Current Phase:** Planning (all tasks start in planning phase)`,
        ''
      );
    }

    // Roadmap update
    if (result.roadmapUpdate) {
      sections.push(
        '## Roadmap Impact',
        `**Project:** ${result.roadmapUpdate.projectId}`,
        `**Planned Features:** ${result.roadmapUpdate.features.planned.length}`,
        ''
      );
    }

    // Next steps
    sections.push(
      '## Next Steps',
      '1. Review the generated tasks and adjust priorities if needed',
      '2. Assign tasks to team members',
      '3. Start with planning phase for high-priority tasks',
      '4. Use `get_next_task` to get recommendations for what to work on first',
      '5. Use `update_task_lifecycle` to track progress through phases',
      ''
    );

    // Related commands
    sections.push(
      '## Related Commands',
      '- `get_next_task` - Get next recommended task to work on',
      '- `update_task_lifecycle` - Update task progress and phase',
      '- `expand_task` - Further break down complex tasks',
      '- `analyze_task_complexity` - Get detailed complexity analysis',
      '- `list_ai_tasks` - View all tasks for this feature'
    );

    return sections.join('\n');
}

// Tool definition
export const addFeatureTool: ToolDefinition<AddFeatureArgs> = {
  name: "add_feature",
  description: "Add a new feature to an existing PRD or project, analyze its impact, and expand it into actionable tasks with complete lifecycle management",
  schema: addFeatureSchema as unknown as ToolSchema<AddFeatureArgs>,
  examples: [
    {
      name: "Add user authentication feature",
      description: "Add a new user authentication feature to an existing project",
      args: {
        featureIdea: "User Authentication System",
        description: "Implement a comprehensive user authentication system with login, registration, password reset, and multi-factor authentication",
        requestedBy: "product-manager",
        businessJustification: "Required for user security and personalization features",
        targetUsers: ["end-users", "administrators"],
        autoApprove: true,
        expandToTasks: true,
        createLifecycle: true
      }
    }
  ]
};

// Export the execution function for the tool registry
export { executeAddFeature };
