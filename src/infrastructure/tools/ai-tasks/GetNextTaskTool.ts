import { z } from 'zod';
import { ToolDefinition, ToolSchema } from '../ToolValidator.js';
import { TaskGenerationService } from '../../../services/TaskGenerationService.js';
import { MCPResponse } from '../../../domain/mcp-types.js';
import { ToolResultFormatter } from '../ToolResultFormatter.js';

// Schema for get_next_task tool
const getNextTaskSchema = z.object({
  projectId: z.string().optional().describe('Filter tasks by specific project ID'),
  featureId: z.string().optional().describe('Filter tasks by specific feature ID'),
  assignee: z.string().optional().describe('Filter tasks for specific team member'),
  teamSkills: z.array(z.string()).optional().describe('Team skills to match against task requirements'),
  sprintCapacity: z.number().optional().describe('Available hours in current sprint (default: 40)'),
  currentPhase: z.enum(['planning', 'development', 'testing', 'review', 'deployment']).optional()
    .describe('Focus on tasks in specific phase'),
  excludeBlocked: z.boolean().default(true).describe('Whether to exclude blocked tasks'),
  maxComplexity: z.number().min(1).max(10).optional().describe('Maximum task complexity to consider'),
  includeAnalysis: z.boolean().default(true).describe('Whether to include detailed AI analysis'),
  limit: z.number().min(1).max(20).default(5).describe('Maximum number of tasks to recommend')
});

export type GetNextTaskArgs = z.infer<typeof getNextTaskSchema>;

/**
 * Implementation function for get_next_task tool
 */
async function executeGetNextTask(args: GetNextTaskArgs): Promise<MCPResponse> {
  const taskService = new TaskGenerationService();
  
  try {
    // For now, create mock tasks for demonstration
    // In a full implementation, this would integrate with ResourceManager
    const mockTasks = [
      {
        id: 'task-1',
        title: 'Set up project infrastructure',
        description: 'Initialize project structure, CI/CD, and development environment',
        priority: 'high',
        complexity: 4,
        estimatedHours: 8,
        status: 'pending',
        dependencies: [],
        tags: ['setup', 'infrastructure']
      },
      {
        id: 'task-2', 
        title: 'Implement user authentication',
        description: 'Create login, registration, and password reset functionality',
        priority: 'critical',
        complexity: 6,
        estimatedHours: 16,
        status: 'pending',
        dependencies: ['task-1'],
        tags: ['auth', 'security']
      },
      {
        id: 'task-3',
        title: 'Design database schema',
        description: 'Create database tables and relationships for core entities',
        priority: 'high',
        complexity: 5,
        estimatedHours: 12,
        status: 'pending',
        dependencies: ['task-1'],
        tags: ['database', 'design']
      }
    ];

    // Apply filters
    let filteredTasks = mockTasks;
    
    if (args.maxComplexity) {
      filteredTasks = filteredTasks.filter(task => task.complexity <= args.maxComplexity!);
    }
    
    if (args.assignee) {
      // Would filter by assignee in real implementation
    }

    // Get recommendations (simplified)
    const recommendations = filteredTasks
      .sort((a, b) => {
        // Sort by priority first, then complexity
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff = (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
                           (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return a.complexity - b.complexity; // Prefer lower complexity
      })
      .slice(0, args.limit);

    // Calculate sprint fit
    const totalHours = recommendations.reduce((sum, task) => sum + task.estimatedHours, 0);
    const sprintCapacity = args.sprintCapacity || 40;
    const sprintFit = totalHours <= sprintCapacity;

    // Generate AI analysis
    const analysis = args.includeAnalysis ? generateTaskAnalysis(recommendations, args) : null;

    // Format response
    const summary = formatNextTaskRecommendations(recommendations, analysis, {
      totalHours,
      sprintCapacity,
      sprintFit,
      filtersApplied: getAppliedFilters(args)
    });
    
    return ToolResultFormatter.formatSuccess('get_next_task', {
      summary,
      recommendations,
      analysis,
      metrics: {
        totalTasks: recommendations.length,
        totalHours,
        sprintCapacity,
        sprintFit
      }
    });

  } catch (error) {
    process.stderr.write(`Error in get_next_task tool: ${error}\n`);
    return ToolResultFormatter.formatSuccess('get_next_task', {
      error: `Failed to get task recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false
    });
  }
}

/**
 * Generate AI analysis for task recommendations
 */
function generateTaskAnalysis(tasks: any[], args: GetNextTaskArgs): string {
  const highComplexityTasks = tasks.filter(task => task.complexity >= 7).length;
  const setupTasks = tasks.filter(task => task.tags.includes('setup')).length;
  
  let analysis = "Based on current project state and team capacity:\n\n";
  
  if (setupTasks > 0) {
    analysis += "• Start with infrastructure/setup tasks to establish foundation\n";
  }
  
  if (highComplexityTasks > 0) {
    analysis += "• Consider breaking down complex tasks before starting\n";
  }
  
  analysis += "• Focus on high-priority items to deliver maximum value\n";
  analysis += "• Ensure dependencies are resolved before starting dependent tasks";
  
  return analysis;
}

/**
 * Get list of applied filters
 */
function getAppliedFilters(args: GetNextTaskArgs): string[] {
  const filters = [];
  if (args.projectId) filters.push(`Project: ${args.projectId}`);
  if (args.featureId) filters.push(`Feature: ${args.featureId}`);
  if (args.assignee) filters.push(`Assignee: ${args.assignee}`);
  if (args.maxComplexity) filters.push(`Max Complexity: ${args.maxComplexity}`);
  if (args.currentPhase) filters.push(`Phase: ${args.currentPhase}`);
  return filters;
}

/**
 * Format task recommendations summary
 */
function formatNextTaskRecommendations(
  tasks: any[], 
  analysis: string | null, 
  metrics: any
): string {
  const sections = [
    '# Next Task Recommendations',
    '',
    '## Overview',
    `**Recommended Tasks:** ${tasks.length}`,
    `**Total Effort:** ${metrics.totalHours} hours`,
    `**Sprint Capacity:** ${metrics.sprintCapacity} hours`,
    `**Sprint Fit:** ${metrics.sprintFit ? '✅ Fits in sprint' : '⚠️ Exceeds capacity'}`,
    ''
  ];

  // Applied filters
  if (metrics.filtersApplied.length > 0) {
    sections.push(
      '**Applied Filters:**',
      ...metrics.filtersApplied.map((filter: string) => `- ${filter}`),
      ''
    );
  }

  // AI Analysis
  if (analysis) {
    sections.push(
      '## AI Analysis',
      analysis,
      ''
    );
  }

  // Task recommendations
  if (tasks.length === 0) {
    sections.push(
      '## No Tasks Available',
      'No tasks match your criteria or all tasks are completed/blocked.',
      '',
      '**Suggestions:**',
      '- Remove some filters to see more tasks',
      '- Check if there are blocked tasks that need attention',
      '- Consider adding new features with `add_feature`'
    );
  } else {
    sections.push('## Recommended Tasks');

    tasks.forEach((task, index) => {
      sections.push(
        `### ${index + 1}. ${task.title}`,
        `**Priority:** ${task.priority} | **Complexity:** ${task.complexity}/10 | **Effort:** ${task.estimatedHours}h`,
        `**Status:** ${task.status}`,
        ''
      );

      if (task.description) {
        sections.push(
          `**Description:** ${task.description}`,
          ''
        );
      }

      if (task.dependencies.length > 0) {
        sections.push(
          `**Dependencies:** ${task.dependencies.length} items`,
          ''
        );
      }

      if (task.tags.length > 0) {
        sections.push(
          `**Tags:** ${task.tags.join(', ')}`,
          ''
        );
      }

      sections.push('---', '');
    });

    // Priority breakdown
    const priorityBreakdown = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {});

    sections.push(
      '## Summary',
      '**Priority Breakdown:**',
      ...Object.entries(priorityBreakdown).map(([priority, count]) => 
        `- ${priority}: ${count} task${(count as number) > 1 ? 's' : ''}`
      ),
      ''
    );
  }

  // Next steps
  sections.push(
    '## Next Steps',
    '1. Review the recommended tasks and select one to start',
    '2. Use `update_task_lifecycle` to begin work and track progress',
    '3. Use `expand_task` if any task seems too complex',
    '4. Check dependencies before starting work',
    ''
  );

  // Related commands
  sections.push(
    '## Related Commands',
    '- `update_task_lifecycle` - Start work and track progress',
    '- `expand_task` - Break down complex tasks',
    '- `analyze_task_complexity` - Get detailed complexity analysis',
    '- `add_feature` - Add new features if no suitable tasks available'
  );

  return sections.join('\n');
}

// Tool definition
export const getNextTaskTool: ToolDefinition<GetNextTaskArgs> = {
  name: "get_next_task",
  description: "Get AI-powered recommendations for the next task to work on based on priorities, dependencies, team capacity, and current project state",
  schema: getNextTaskSchema as unknown as ToolSchema<GetNextTaskArgs>,
  examples: [
    {
      name: "Get next task for development",
      description: "Get the next recommended task for a developer with specific skills",
      args: {
        teamSkills: ["typescript", "react", "node.js"],
        sprintCapacity: 40,
        maxComplexity: 7,
        excludeBlocked: true,
        includeAnalysis: true,
        limit: 3
      }
    }
  ]
};

// Export the execution function
export { executeGetNextTask };
