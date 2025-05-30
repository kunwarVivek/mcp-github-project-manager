import { z } from 'zod';
import { ToolDefinition, ToolSchema } from '../ToolValidator.js';
import { TaskGenerationService } from '../../../services/TaskGenerationService.js';
import { TaskStatus, TaskPriority, TaskComplexity } from '../../../domain/ai-types.js';
import { MCPResponse } from '../../../domain/mcp-types.js';
import { ToolResultFormatter } from '../ToolResultFormatter.js';

// Schema for expand_task tool
const expandTaskSchema = z.object({
  taskTitle: z.string().min(3).describe('Title of the task to expand'),
  taskDescription: z.string().min(10).describe('Detailed description of the task'),
  currentComplexity: z.number().min(1).max(10).describe('Current complexity score of the task'),
  maxSubtasks: z.number().min(2).max(15).default(8).describe('Maximum number of subtasks to create'),
  maxDepth: z.number().min(1).max(3).default(2).describe('Maximum depth of subtask breakdown'),
  targetComplexity: z.number().min(1).max(5).default(3).describe('Target complexity for each subtask'),
  includeEstimates: z.boolean().default(true).describe('Whether to include effort estimates for subtasks'),
  includeDependencies: z.boolean().default(true).describe('Whether to identify dependencies between subtasks'),
  includeAcceptanceCriteria: z.boolean().default(true).describe('Whether to generate acceptance criteria for subtasks'),
  projectType: z.string().optional().describe('Type of project (web-app, mobile-app, api, etc.)'),
  teamSkills: z.array(z.string()).optional().describe('Team skills to consider for subtask assignment')
});

export type ExpandTaskArgs = z.infer<typeof expandTaskSchema>;

/**
 * Implementation function for expand_task tool
 */
async function executeExpandTask(args: ExpandTaskArgs): Promise<MCPResponse> {
  const taskService = new TaskGenerationService();

  try {
    // Create a mock parent task
    const parentTask = {
      id: 'parent-task',
      title: args.taskTitle,
      description: args.taskDescription,
      complexity: args.currentComplexity as TaskComplexity,
      estimatedHours: args.currentComplexity * 4, // Simple estimation
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.PENDING,
      dependencies: [],
      acceptanceCriteria: [],
      tags: [],
      aiGenerated: false,
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Generate subtasks using AI
    const subtasks = await taskService.expandTaskIntoSubtasks({
      task: parentTask,
      maxDepth: args.maxDepth,
      autoEstimate: args.includeEstimates
    });

    // Enhance subtasks with additional details
    const enhancedSubtasks = enhanceSubtasks(subtasks, args);

    // Detect dependencies if requested
    const dependencies = args.includeDependencies ?
      detectSubtaskDependencies(enhancedSubtasks) : [];

    // Calculate metrics
    const metrics = calculateSubtaskMetrics(enhancedSubtasks, parentTask);

    // Generate recommendations
    const recommendations = generateSubtaskRecommendations(enhancedSubtasks, args, metrics);

    // Format response
    const summary = formatTaskExpansion(
      parentTask,
      enhancedSubtasks,
      dependencies,
      metrics,
      recommendations,
      args
    );

    return ToolResultFormatter.formatSuccess('expand_task', {
      summary,
      parentTask,
      subtasks: enhancedSubtasks,
      dependencies,
      metrics,
      recommendations
    });

  } catch (error) {
    process.stderr.write(`Error in expand_task tool: ${error}\n`);
    return ToolResultFormatter.formatSuccess('expand_task', {
      error: `Failed to expand task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false
    });
  }
}

/**
 * Enhance subtasks with additional details
 */
function enhanceSubtasks(subtasks: any[], args: ExpandTaskArgs) {
  return subtasks.map((subtask, index) => {
    // Generate acceptance criteria if requested
    const acceptanceCriteria = args.includeAcceptanceCriteria ?
      generateAcceptanceCriteria(subtask) : [];

    // Assign appropriate tags
    const tags = generateSubtaskTags(subtask, args.projectType);

    // Adjust complexity to target if needed
    const adjustedComplexity = Math.min(subtask.complexity, args.targetComplexity);

    return {
      ...subtask,
      id: `subtask-${index + 1}`,
      complexity: adjustedComplexity,
      estimatedHours: adjustedComplexity * 2, // Subtasks are smaller
      acceptanceCriteria,
      tags,
      priority: index < 2 ? 'high' : 'medium', // First few subtasks are high priority
      status: 'pending'
    };
  });
}

/**
 * Generate acceptance criteria for a subtask
 */
function generateAcceptanceCriteria(subtask: any): Array<{id: string, description: string, completed: boolean}> {
  const criteria = [];

  // Generic criteria
  criteria.push({
    id: `criteria-${Date.now()}-1`,
    description: `${subtask.title} is implemented according to specifications`,
    completed: false
  });

  criteria.push({
    id: `criteria-${Date.now()}-2`,
    description: 'All unit tests pass for this subtask',
    completed: false
  });

  // Task-specific criteria based on title/description
  if (subtask.title.toLowerCase().includes('api')) {
    criteria.push({
      id: `criteria-${Date.now()}-3`,
      description: 'API endpoints return correct responses and status codes',
      completed: false
    });
  }

  if (subtask.title.toLowerCase().includes('ui') || subtask.title.toLowerCase().includes('frontend')) {
    criteria.push({
      id: `criteria-${Date.now()}-4`,
      description: 'UI is responsive and follows design specifications',
      completed: false
    });
  }

  if (subtask.title.toLowerCase().includes('database')) {
    criteria.push({
      id: `criteria-${Date.now()}-5`,
      description: 'Database schema changes are properly migrated',
      completed: false
    });
  }

  return criteria;
}

/**
 * Generate appropriate tags for subtasks
 */
function generateSubtaskTags(subtask: any, projectType?: string): string[] {
  const tags = ['subtask'];

  if (projectType) {
    tags.push(projectType);
  }

  // Add tags based on subtask content
  const title = subtask.title.toLowerCase();
  const description = subtask.description.toLowerCase();

  if (title.includes('setup') || title.includes('config')) tags.push('setup');
  if (title.includes('api') || description.includes('endpoint')) tags.push('backend');
  if (title.includes('ui') || title.includes('frontend')) tags.push('frontend');
  if (title.includes('test') || description.includes('testing')) tags.push('testing');
  if (title.includes('database') || title.includes('migration')) tags.push('database');
  if (title.includes('deploy') || title.includes('infrastructure')) tags.push('devops');

  return tags;
}

/**
 * Detect dependencies between subtasks
 */
function detectSubtaskDependencies(subtasks: any[]): Array<{
  from: string;
  to: string;
  type: 'blocks' | 'depends_on';
  description: string;
}> {
  const dependencies = [];

  // Simple heuristic-based dependency detection
  for (let i = 0; i < subtasks.length; i++) {
    for (let j = i + 1; j < subtasks.length; j++) {
      const taskA = subtasks[i];
      const taskB = subtasks[j];

      // Setup tasks should come before implementation tasks
      if (taskA.title.toLowerCase().includes('setup') &&
          !taskB.title.toLowerCase().includes('setup')) {
        dependencies.push({
          from: taskA.id,
          to: taskB.id,
          type: 'blocks' as const,
          description: `${taskA.title} must be completed before ${taskB.title}`
        });
      }

      // Database tasks should come before API tasks
      if (taskA.title.toLowerCase().includes('database') &&
          taskB.title.toLowerCase().includes('api')) {
        dependencies.push({
          from: taskA.id,
          to: taskB.id,
          type: 'blocks' as const,
          description: 'Database schema must be ready before API implementation'
        });
      }

      // API tasks should come before UI tasks
      if (taskA.title.toLowerCase().includes('api') &&
          taskB.title.toLowerCase().includes('ui')) {
        dependencies.push({
          from: taskA.id,
          to: taskB.id,
          type: 'blocks' as const,
          description: 'API must be available before UI implementation'
        });
      }
    }
  }

  return dependencies;
}

/**
 * Calculate metrics for subtasks
 */
function calculateSubtaskMetrics(subtasks: any[], parentTask: any) {
  const totalEffort = subtasks.reduce((sum, task) => sum + task.estimatedHours, 0);
  const avgComplexity = subtasks.reduce((sum, task) => sum + task.complexity, 0) / subtasks.length;

  const complexityReduction = parentTask.complexity - avgComplexity;
  const effortIncrease = totalEffort - parentTask.estimatedHours;

  return {
    totalSubtasks: subtasks.length,
    totalEffort,
    avgComplexity: Math.round(avgComplexity * 10) / 10,
    complexityReduction: Math.round(complexityReduction * 10) / 10,
    effortIncrease,
    effortIncreasePercent: Math.round((effortIncrease / parentTask.estimatedHours) * 100)
  };
}

/**
 * Generate recommendations for subtask management
 */
function generateSubtaskRecommendations(
  subtasks: any[],
  args: ExpandTaskArgs,
  metrics: any
): string[] {
  const recommendations = [];

  // Complexity recommendations
  if (metrics.avgComplexity > args.targetComplexity) {
    recommendations.push('Some subtasks still exceed target complexity - consider further breakdown');
  } else {
    recommendations.push('Subtasks are appropriately sized for implementation');
  }

  // Effort recommendations
  if (metrics.effortIncreasePercent > 20) {
    recommendations.push('Breaking down the task revealed additional complexity - adjust timeline accordingly');
  }

  // Dependency recommendations
  const setupTasks = subtasks.filter(task => task.tags.includes('setup'));
  if (setupTasks.length > 0) {
    recommendations.push('Start with setup and infrastructure tasks to establish foundation');
  }

  // Parallel work recommendations
  const parallelTasks = subtasks.filter(task =>
    !task.tags.includes('setup') && task.complexity <= 3
  );
  if (parallelTasks.length >= 2) {
    recommendations.push(`${parallelTasks.length} tasks can potentially be worked on in parallel`);
  }

  // Team assignment recommendations
  if (args.teamSkills && args.teamSkills.length > 0) {
    recommendations.push('Consider assigning subtasks based on team member expertise');
  }

  return recommendations;
}

/**
 * Format task expansion summary
 */
function formatTaskExpansion(
  parentTask: any,
  subtasks: any[],
  dependencies: any[],
  metrics: any,
  recommendations: string[],
  args: ExpandTaskArgs
): string {
  const sections = [
    '# Task Expansion Complete',
    '',
    `## Original Task: ${parentTask.title}`,
    `**Original Complexity:** ${parentTask.complexity}/10`,
    `**Original Estimate:** ${parentTask.estimatedHours} hours`,
    ''
  ];

  // Expansion summary
  sections.push(
    '## Expansion Summary',
    `**Subtasks Created:** ${metrics.totalSubtasks}`,
    `**Total Effort:** ${metrics.totalEffort} hours`,
    `**Average Complexity:** ${metrics.avgComplexity}/10`,
    `**Complexity Reduction:** ${metrics.complexityReduction} points per task`,
    `**Effort Adjustment:** ${metrics.effortIncrease > 0 ? '+' : ''}${metrics.effortIncrease} hours (${metrics.effortIncreasePercent > 0 ? '+' : ''}${metrics.effortIncreasePercent}%)`,
    ''
  );

  // Subtasks
  sections.push('## Generated Subtasks');

  subtasks.forEach((subtask, index) => {
    sections.push(
      `### ${index + 1}. ${subtask.title}`,
      `**Complexity:** ${subtask.complexity}/10 | **Effort:** ${subtask.estimatedHours}h | **Priority:** ${subtask.priority}`,
      `**Description:** ${subtask.description}`,
      ''
    );

    if (subtask.acceptanceCriteria.length > 0) {
      sections.push(
        '**Acceptance Criteria:**',
        ...subtask.acceptanceCriteria.slice(0, 2).map((criteria: any) => `- ${criteria.description}`),
        ''
      );
    }

    if (subtask.tags.length > 0) {
      sections.push(
        `**Tags:** ${subtask.tags.join(', ')}`,
        ''
      );
    }

    sections.push('---', '');
  });

  // Dependencies
  if (dependencies.length > 0) {
    sections.push(
      '## Task Dependencies',
      `**Total Dependencies:** ${dependencies.length}`,
      ''
    );

    dependencies.forEach(dep => {
      const fromTask = subtasks.find(t => t.id === dep.from);
      const toTask = subtasks.find(t => t.id === dep.to);
      sections.push(
        `- **${fromTask?.title}** ${dep.type === 'blocks' ? 'blocks' : 'depends on'} **${toTask?.title}**`,
        `  ${dep.description}`,
        ''
      );
    });
  }

  // Recommendations
  if (recommendations.length > 0) {
    sections.push(
      '## Recommendations',
      ...recommendations.map(rec => `- ${rec}`),
      ''
    );
  }

  // Implementation order
  const orderedTasks = [...subtasks].sort((a, b) => {
    // Setup tasks first
    if (a.tags.includes('setup') && !b.tags.includes('setup')) return -1;
    if (!a.tags.includes('setup') && b.tags.includes('setup')) return 1;

    // Then by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) -
                        (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
    if (priorityDiff !== 0) return priorityDiff;

    // Then by complexity (easier first)
    return a.complexity - b.complexity;
  });

  sections.push(
    '## Suggested Implementation Order',
    ...orderedTasks.slice(0, 5).map((task, index) =>
      `${index + 1}. ${task.title} (${task.complexity}/10, ${task.estimatedHours}h)`
    ),
    ''
  );

  // Next steps
  sections.push(
    '## Next Steps',
    '1. Review the subtasks and adjust if needed',
    '2. Assign subtasks to team members based on skills',
    '3. Start with setup and high-priority tasks',
    '4. Use `update_task_lifecycle` to track progress on each subtask',
    '5. Consider creating GitHub issues for each subtask',
    ''
  );

  // Related commands
  sections.push(
    '## Related Commands',
    '- `get_next_task` - Get recommendations for which subtask to work on first',
    '- `analyze_task_complexity` - Analyze individual subtasks if still too complex',
    '- `update_task_lifecycle` - Track progress on subtasks',
    '- `create_issue` - Create GitHub issues for subtasks'
  );

  return sections.join('\n');
}

// Tool definition
export const expandTaskTool: ToolDefinition<ExpandTaskArgs> = {
  name: "expand_task",
  description: "Break down a complex task into smaller, manageable subtasks with AI-powered analysis, dependency detection, and implementation recommendations",
  schema: expandTaskSchema as unknown as ToolSchema<ExpandTaskArgs>,
  examples: [
    {
      name: "Expand complex feature task",
      description: "Break down a complex feature into manageable subtasks",
      args: {
        taskTitle: "Implement user dashboard",
        taskDescription: "Create a comprehensive user dashboard with analytics, settings, notifications, and profile management",
        currentComplexity: 8,
        maxSubtasks: 6,
        maxDepth: 2,
        targetComplexity: 3,
        includeEstimates: true,
        includeDependencies: true,
        includeAcceptanceCriteria: true,
        projectType: "web-app",
        teamSkills: ["react", "typescript", "node.js"]
      }
    }
  ]
};

// Export the execution function
export { executeExpandTask };
