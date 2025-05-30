import { z } from 'zod';
import { ToolDefinition, ToolSchema } from '../ToolValidator';
import { TaskGenerationService } from '../../../services/TaskGenerationService';
import { PRDGenerationService } from '../../../services/PRDGenerationService';
import { RequirementsTraceabilityService } from '../../../services/RequirementsTraceabilityService';
import { MCPResponse } from '../../../domain/mcp-types';
import { ToolResultFormatter } from '../ToolResultFormatter';

// Schema for parse_prd tool
const parsePRDSchema = z.object({
  prdContent: z.string().min(100).describe('The PRD content to parse (markdown, text, or JSON)'),
  maxTasks: z.number().min(1).max(100).default(30).describe('Maximum number of tasks to generate'),
  includeSubtasks: z.boolean().default(true).describe('Whether to break down complex tasks into subtasks'),
  autoEstimate: z.boolean().default(true).describe('Whether to automatically estimate effort and complexity'),
  autoPrioritize: z.boolean().default(true).describe('Whether to automatically prioritize tasks'),
  autoDetectDependencies: z.boolean().default(true).describe('Whether to automatically detect task dependencies'),
  targetComplexity: z.number().min(1).max(10).optional().describe('Target maximum complexity for individual tasks'),
  teamSkills: z.array(z.string()).optional().describe('Team skills to consider for task assignment'),
  projectType: z.string().optional().describe('Type of project (web-app, mobile-app, api, etc.)'),
  createLifecycle: z.boolean().default(true).describe('Whether to create lifecycle tracking for tasks'),
  createTraceabilityMatrix: z.boolean().default(true).describe('Whether to create comprehensive requirements traceability matrix'),
  includeUseCases: z.boolean().default(true).describe('Whether to generate use cases from features'),
  projectId: z.string().optional().describe('Project ID for traceability matrix'),
  enhancedGeneration: z.boolean().default(true).describe('Whether to use enhanced task generation with context'),
  contextLevel: z.enum(['minimal', 'standard', 'full']).default('standard').describe('Level of contextual information to include'),
  includeBusinessContext: z.boolean().default(false).describe('Whether to include AI-generated business context (requires AI)'),
  includeTechnicalContext: z.boolean().default(false).describe('Whether to include AI-generated technical context (requires AI)'),
  includeImplementationGuidance: z.boolean().default(false).describe('Whether to include AI-generated implementation guidance (requires AI)')
});

export type ParsePRDArgs = z.infer<typeof parsePRDSchema>;

/**
 * Implementation function for parse_prd tool (similar to claude-task-master)
 */
async function executeParsePRD(args: ParsePRDArgs): Promise<MCPResponse> {
  const taskService = new TaskGenerationService();
  const prdService = new PRDGenerationService();
  const traceabilityService = new RequirementsTraceabilityService();

  try {
    // First, try to extract features from the PRD
    const features = await prdService.extractFeaturesFromPRD(args.prdContent);

    // Generate tasks from the PRD content using enhanced generation if enabled
    const tasks = args.enhancedGeneration
      ? await taskService.generateEnhancedTasksFromPRD({
          prd: args.prdContent,
          maxTasks: args.maxTasks,
          includeSubtasks: args.includeSubtasks,
          autoEstimate: args.autoEstimate,
          autoPrioritize: args.autoPrioritize,
          projectId: args.projectId,
          enhancedConfig: {
            enableEnhancedGeneration: args.enhancedGeneration,
            createTraceabilityMatrix: args.createTraceabilityMatrix,
            generateUseCases: args.includeUseCases,
            createLifecycleTracking: args.createLifecycle,
            contextLevel: args.contextLevel,
            includeBusinessContext: args.includeBusinessContext,
            includeTechnicalContext: args.includeTechnicalContext,
            includeImplementationGuidance: args.includeImplementationGuidance,
            enforceTraceability: args.createTraceabilityMatrix,
            requireBusinessJustification: args.includeBusinessContext,
            trackRequirementCoverage: args.createTraceabilityMatrix
          }
        })
      : await taskService.generateTasksFromPRD({
          prd: args.prdContent,
          maxTasks: args.maxTasks,
          includeSubtasks: args.includeSubtasks,
          autoEstimate: args.autoEstimate,
          autoPrioritize: args.autoPrioritize
        });

    // Filter tasks by target complexity if specified
    let filteredTasks = tasks;
    if (args.targetComplexity) {
      filteredTasks = tasks.filter(task => task.complexity <= args.targetComplexity!);
    }

    // Create traceability matrix if requested
    let traceabilityMatrix;
    if (args.createTraceabilityMatrix) {
      // Create mock PRD for traceability
      const mockPRD = {
        id: args.projectId || `prd-${Date.now()}`,
        title: 'Parsed PRD',
        overview: args.prdContent.substring(0, 500),
        objectives: ['Deliver high-quality software solution'],
        successMetrics: ['User satisfaction > 90%'],
        features,
        author: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        aiGenerated: true,
        aiMetadata: {
          generatedBy: 'parse-prd-tool',
          generatedAt: new Date().toISOString(),
          prompt: 'Parse PRD content',
          confidence: 0.8,
          version: '1.0.0'
        }
      };

      traceabilityMatrix = traceabilityService.createTraceabilityMatrix(
        args.projectId || 'parsed-project',
        mockPRD as any,
        features,
        filteredTasks
      );
    }

    // Calculate project metrics
    const metrics = calculateProjectMetrics(filteredTasks, features);

    // Generate task recommendations
    const recommendations = await generateTaskRecommendations(filteredTasks, args);

    // Format response with traceability
    const summary = formatPRDParsingResult(
      filteredTasks,
      features,
      metrics,
      recommendations,
      args,
      traceabilityMatrix
    );

    return ToolResultFormatter.formatSuccess('parse_prd', {
      summary,
      tasks: filteredTasks,
      features,
      metrics,
      recommendations,
      traceabilityMatrix,
      totalTasks: filteredTasks.length,
      totalFeatures: features.length,
      totalBusinessRequirements: traceabilityMatrix?.businessRequirements.length || 0,
      totalUseCases: traceabilityMatrix?.useCases.length || 0
    });

  } catch (error) {
    process.stderr.write(`Error in parse_prd tool: ${error}\n`);
    return ToolResultFormatter.formatSuccess('parse_prd', {
      error: `Failed to parse PRD: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false
    });
  }
}

/**
 * Calculate project metrics from tasks and features
 */
function calculateProjectMetrics(tasks: any[], features: any[]) {
  const totalEffort = tasks.reduce((sum, task) => sum + task.estimatedHours, 0);
  const avgComplexity = tasks.reduce((sum, task) => sum + task.complexity, 0) / tasks.length;

  const tasksByPriority = tasks.reduce((acc, task) => {
    acc[task.priority] = (acc[task.priority] || 0) + 1;
    return acc;
  }, {});

  const tasksByComplexity = tasks.reduce((acc, task) => {
    const level = task.complexity <= 3 ? 'low' : task.complexity <= 7 ? 'medium' : 'high';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});

  const featuresByPriority = features.reduce((acc, feature) => {
    acc[feature.priority] = (acc[feature.priority] || 0) + 1;
    return acc;
  }, {});

  return {
    totalEffort,
    avgComplexity: Math.round(avgComplexity * 10) / 10,
    estimatedDuration: Math.ceil(totalEffort / 40), // Assuming 40 hours per week
    tasksByPriority,
    tasksByComplexity,
    featuresByPriority,
    riskLevel: avgComplexity > 7 ? 'high' : avgComplexity > 5 ? 'medium' : 'low'
  };
}

/**
 * Generate task recommendations
 */
async function generateTaskRecommendations(tasks: any[], args: ParsePRDArgs) {
  // Get high-priority tasks
  const highPriorityTasks = tasks
    .filter(task => task.priority === 'critical' || task.priority === 'high')
    .slice(0, 5);

  // Get setup/infrastructure tasks
  const setupTasks = tasks
    .filter(task =>
      task.title.toLowerCase().includes('setup') ||
      task.title.toLowerCase().includes('infrastructure') ||
      task.title.toLowerCase().includes('configuration')
    )
    .slice(0, 3);

  // Get complex tasks that might need breakdown
  const complexTasks = tasks
    .filter(task => task.complexity >= 8)
    .slice(0, 3);

  return {
    startWithTasks: setupTasks.length > 0 ? setupTasks : highPriorityTasks.slice(0, 3),
    highPriorityTasks,
    complexTasksNeedingBreakdown: complexTasks,
    recommendedFirstSprint: tasks
      .filter(task => task.priority === 'critical' || task.priority === 'high')
      .filter(task => task.complexity <= 6)
      .slice(0, 8)
  };
}

/**
 * Format PRD parsing result summary
 */
function formatPRDParsingResult(
  tasks: any[],
  features: any[],
  metrics: any,
  recommendations: any,
  args: ParsePRDArgs,
  traceabilityMatrix?: any
): string {
  const sections = [
    '# PRD Parsing Complete',
    '',
    '## Summary',
    `**Total Tasks Generated:** ${tasks.length}`,
    `**Features Identified:** ${features.length}`,
    `**Total Estimated Effort:** ${metrics.totalEffort} hours`,
    `**Estimated Duration:** ${metrics.estimatedDuration} weeks`,
    `**Average Complexity:** ${metrics.avgComplexity}/10`,
    `**Risk Level:** ${metrics.riskLevel}`,
    ''
  ];

  // Add traceability information if available
  if (traceabilityMatrix) {
    sections.push(
      '## Requirements Traceability',
      `**Business Requirements:** ${traceabilityMatrix.businessRequirements.length}`,
      `**Use Cases Generated:** ${traceabilityMatrix.useCases.length}`,
      `**Traceability Links:** ${traceabilityMatrix.traceabilityLinks.length}`,
      `**Tasks with Traceability:** ${traceabilityMatrix.coverage.tasksWithTraceability}/${tasks.length} (${Math.round((traceabilityMatrix.coverage.tasksWithTraceability/tasks.length)*100)}%)`,
      ''
    );

    // Show coverage issues
    if (traceabilityMatrix.coverage.orphanedTasks.length > 0) {
      sections.push(
        `**⚠️ Orphaned Tasks:** ${traceabilityMatrix.coverage.orphanedTasks.length} tasks have no requirements traceability`,
        ''
      );
    }

    if (traceabilityMatrix.coverage.unimplementedRequirements.length > 0) {
      sections.push(
        `**⚠️ Unimplemented Requirements:** ${traceabilityMatrix.coverage.unimplementedRequirements.length} requirements have no implementing tasks`,
        ''
      );
    }
  }

  // Task breakdown
  sections.push(
    '## Task Breakdown',
    '',
    '**By Priority:**',
    ...Object.entries(metrics.tasksByPriority).map(([priority, count]) =>
      `- ${priority}: ${count} task${(count as number) > 1 ? 's' : ''}`
    ),
    '',
    '**By Complexity:**',
    ...Object.entries(metrics.tasksByComplexity).map(([level, count]) =>
      `- ${level}: ${count} task${(count as number) > 1 ? 's' : ''}`
    ),
    ''
  );

  // Feature breakdown
  if (features.length > 0) {
    sections.push(
      '## Features Identified',
      `**Total Features:** ${features.length}`,
      '',
      '**By Priority:**',
      ...Object.entries(metrics.featuresByPriority).map(([priority, count]) =>
        `- ${priority}: ${count} feature${(count as number) > 1 ? 's' : ''}`
      ),
      '',
      '**Top Features:**',
      ...features.slice(0, 5).map((feature: any) =>
        `- ${feature.title} (${feature.priority}, complexity: ${feature.estimatedComplexity}/10)`
      ),
      ''
    );
  }

  // Recommendations
  sections.push('## AI Recommendations');

  if (recommendations.startWithTasks.length > 0) {
    sections.push(
      '',
      '**Start With These Tasks:**',
      ...recommendations.startWithTasks.map((task: any) =>
        `- ${task.title} (${task.priority}, ${task.estimatedHours}h)`
      ),
      ''
    );
  }

  if (recommendations.complexTasksNeedingBreakdown.length > 0) {
    sections.push(
      '**Complex Tasks Needing Breakdown:**',
      ...recommendations.complexTasksNeedingBreakdown.map((task: any) =>
        `- ${task.title} (complexity: ${task.complexity}/10)`
      ),
      ''
    );
  }

  if (recommendations.recommendedFirstSprint.length > 0) {
    const sprintEffort = recommendations.recommendedFirstSprint.reduce((sum: number, task: any) => sum + task.estimatedHours, 0);
    sections.push(
      '**Recommended First Sprint:**',
      `- ${recommendations.recommendedFirstSprint.length} tasks`,
      `- ${sprintEffort} hours total effort`,
      `- Focus on high-priority, manageable complexity tasks`,
      ''
    );
  }

  // Project insights
  sections.push(
    '## Project Insights',
    ''
  );

  if (metrics.riskLevel === 'high') {
    sections.push(
      '⚠️ **High Risk Project**',
      '- Many complex tasks detected',
      '- Consider breaking down complex tasks further',
      '- Plan for additional time and resources',
      ''
    );
  } else if (metrics.riskLevel === 'medium') {
    sections.push(
      '⚡ **Medium Risk Project**',
      '- Balanced complexity distribution',
      '- Some complex tasks may need attention',
      '- Good candidate for agile development',
      ''
    );
  } else {
    sections.push(
      '✅ **Low Risk Project**',
      '- Most tasks are manageable complexity',
      '- Good for rapid development',
      '- Suitable for smaller teams',
      ''
    );
  }

  // Configuration used
  sections.push(
    '## Configuration Used',
    `- Max Tasks: ${args.maxTasks}`,
    `- Include Subtasks: ${args.includeSubtasks}`,
    `- Auto Estimate: ${args.autoEstimate}`,
    `- Auto Prioritize: ${args.autoPrioritize}`,
    `- Auto Dependencies: ${args.autoDetectDependencies}`,
    args.targetComplexity ? `- Target Complexity: ≤${args.targetComplexity}` : '',
    ''
  );

  // Next steps
  sections.push(
    '## Next Steps',
    '1. Review the generated tasks and adjust priorities if needed',
    '2. Use `expand_task` to break down complex tasks further',
    '3. Use `get_next_task` to get recommendations for what to work on first',
    '4. Create a GitHub project and add these tasks using `add_project_item`',
    '5. Use `update_task_lifecycle` to track progress as you work',
    ''
  );

  // Related commands
  sections.push(
    '## Related Commands',
    '- `expand_task` - Break down complex tasks into subtasks',
    '- `get_next_task` - Get AI recommendations for next task to work on',
    '- `analyze_task_complexity` - Get detailed complexity analysis',
    '- `add_feature` - Add new features to the project',
    '- `create_project` - Create GitHub project to track these tasks'
  );

  return sections.join('\n');
}

// Tool definition
export const parsePRDTool: ToolDefinition<ParsePRDArgs> = {
  name: "parse_prd",
  description: "Parse a Product Requirements Document (PRD) and generate a comprehensive list of actionable development tasks with AI-powered analysis, similar to claude-task-master functionality",
  schema: parsePRDSchema as unknown as ToolSchema<ParsePRDArgs>,
  examples: [
    {
      name: "Parse PRD for task generation",
      description: "Parse a PRD document and generate development tasks",
      args: {
        prdContent: `# Task Management App PRD\n\n## Overview\nBuild a modern task management application...\n\n## Features\n- User authentication\n- Task creation and management\n- Team collaboration\n- Real-time updates`,
        maxTasks: 25,
        includeSubtasks: true,
        autoEstimate: true,
        autoPrioritize: true,
        autoDetectDependencies: true,
        projectType: "web-app",
        createLifecycle: true,
        createTraceabilityMatrix: true,
        includeUseCases: true,
        projectId: "task-management-app",
        enhancedGeneration: true,
        contextLevel: "standard" as const,
        includeBusinessContext: false,
        includeTechnicalContext: false,
        includeImplementationGuidance: false
      }
    }
  ]
};

// Export the execution function for the tool registry
export { executeParsePRD };
