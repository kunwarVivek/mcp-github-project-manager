import { z } from 'zod';
import { ToolDefinition, ToolSchema } from '../ToolValidator.js';
import { RequirementsTraceabilityService } from '../../../services/RequirementsTraceabilityService.js';
import { MCPResponse } from '../../../domain/mcp-types.js';
import { ToolResultFormatter } from '../ToolResultFormatter.js';
import { TaskStatus, TaskPriority, TaskComplexity } from '../../../domain/ai-types.js';

// Schema for create_traceability_matrix tool
const createTraceabilityMatrixSchema = z.object({
  projectId: z.string().describe('ID of the project to create traceability matrix for'),
  prdContent: z.string().min(100).describe('PRD content to extract business requirements from'),
  features: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    userStories: z.array(z.string()),
    acceptanceCriteria: z.array(z.string()),
    estimatedComplexity: z.number().min(1).max(10)
  })).describe('List of features to include in traceability'),
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    complexity: z.number().min(1).max(10),
    estimatedHours: z.number(),
    priority: z.enum(['critical', 'high', 'medium', 'low'])
  })).describe('List of tasks to include in traceability'),
  includeUseCases: z.boolean().default(true).describe('Whether to generate use cases from features'),
  includeTraceabilityLinks: z.boolean().default(true).describe('Whether to generate traceability links'),
  includeCoverageAnalysis: z.boolean().default(true).describe('Whether to include coverage analysis'),
  validateCompleteness: z.boolean().default(true).describe('Whether to validate traceability completeness')
});

export type CreateTraceabilityMatrixArgs = z.infer<typeof createTraceabilityMatrixSchema>;

/**
 * Implementation function for create_traceability_matrix tool
 */
async function executeCreateTraceabilityMatrix(args: CreateTraceabilityMatrixArgs): Promise<MCPResponse> {
  const traceabilityService = new RequirementsTraceabilityService();

  try {
    // Create mock PRD from content
    const mockPRD = {
      id: `prd-${args.projectId}`,
      title: `PRD for ${args.projectId}`,
      overview: args.prdContent.substring(0, 500),
      objectives: extractObjectivesFromContent(args.prdContent),
      successMetrics: extractSuccessMetricsFromContent(args.prdContent),
      features: args.features,
      author: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiGenerated: true,
      aiMetadata: {
        generatedBy: 'create-traceability-matrix',
        generatedAt: new Date().toISOString(),
        prompt: 'Extract PRD elements for traceability matrix',
        confidence: 0.8,
        version: '1.0.0'
      }
    };

    // Convert input tasks to AITask format
    const aiTasks = args.tasks.map(task => ({
      ...task,
      priority: task.priority as TaskPriority,
      complexity: task.complexity as TaskComplexity,
      status: TaskStatus.PENDING,
      dependencies: [],
      acceptanceCriteria: [],
      tags: [],
      aiGenerated: true,
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    // Create comprehensive traceability matrix
    const traceabilityMatrix = traceabilityService.createTraceabilityMatrix(
      args.projectId,
      mockPRD as any,
      args.features as any,
      aiTasks
    );

    // Validate completeness if requested
    let validation;
    if (args.validateCompleteness) {
      validation = validateTraceabilityCompleteness(traceabilityMatrix);
    }

    // Format response
    const summary = formatTraceabilityMatrixSummary(traceabilityMatrix, validation, args);

    return ToolResultFormatter.formatSuccess('create_traceability_matrix', {
      summary,
      traceabilityMatrix,
      validation,
      coverage: traceabilityMatrix.coverage,
      totalRequirements: traceabilityMatrix.businessRequirements.length,
      totalFeatures: traceabilityMatrix.features.length,
      totalUseCases: traceabilityMatrix.useCases.length,
      totalTasks: traceabilityMatrix.tasks.length
    });

  } catch (error) {
    process.stderr.write(`Error in create_traceability_matrix tool: ${error}\n`);
    return ToolResultFormatter.formatSuccess('create_traceability_matrix', {
      error: `Failed to create traceability matrix: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false
    });
  }
}

/**
 * Extract objectives from PRD content
 */
function extractObjectivesFromContent(content: string): string[] {
  const objectives = [];

  // Look for objectives section
  const objectivesMatch = content.match(/(?:objectives?|goals?)[:\s]*\n(.*?)(?:\n\n|\n#|$)/is);
  if (objectivesMatch) {
    const objectivesText = objectivesMatch[1];
    const bulletPoints = objectivesText.match(/[-*•]\s*(.+)/g);
    if (bulletPoints) {
      objectives.push(...bulletPoints.map(point => point.replace(/[-*•]\s*/, '').trim()));
    }
  }

  // Fallback: extract from overview
  if (objectives.length === 0) {
    objectives.push('Deliver high-quality software solution');
    objectives.push('Meet user needs and expectations');
    objectives.push('Achieve business goals and objectives');
  }

  return objectives;
}

/**
 * Extract success metrics from PRD content
 */
function extractSuccessMetricsFromContent(content: string): string[] {
  const metrics = [];

  // Look for metrics/KPI section
  const metricsMatch = content.match(/(?:metrics?|kpis?|success)[:\s]*\n(.*?)(?:\n\n|\n#|$)/is);
  if (metricsMatch) {
    const metricsText = metricsMatch[1];
    const bulletPoints = metricsText.match(/[-*•]\s*(.+)/g);
    if (bulletPoints) {
      metrics.push(...bulletPoints.map(point => point.replace(/[-*•]\s*/, '').trim()));
    }
  }

  // Fallback metrics
  if (metrics.length === 0) {
    metrics.push('User satisfaction > 90%');
    metrics.push('System uptime > 99.9%');
    metrics.push('Feature adoption > 80%');
  }

  return metrics;
}

/**
 * Validate traceability matrix completeness
 */
function validateTraceabilityCompleteness(matrix: any): {
  isComplete: boolean;
  score: number;
  issues: string[];
  recommendations: string[];
} {
  const issues = [];
  const recommendations = [];
  let score = 100;

  // Check coverage
  const coverage = matrix.coverage;

  if (coverage.orphanedTasks.length > 0) {
    issues.push(`${coverage.orphanedTasks.length} tasks have no requirements traceability`);
    score -= coverage.orphanedTasks.length * 5;
    recommendations.push('Link orphaned tasks to requirements or use cases');
  }

  if (coverage.unimplementedRequirements.length > 0) {
    issues.push(`${coverage.unimplementedRequirements.length} requirements have no implementing tasks`);
    score -= coverage.unimplementedRequirements.length * 10;
    recommendations.push('Create tasks to implement all requirements');
  }

  // Check use case coverage
  const useCaseCoverage = (coverage.useCasesCovered / matrix.useCases.length) * 100;
  if (useCaseCoverage < 90) {
    issues.push(`Only ${useCaseCoverage.toFixed(1)}% of use cases have implementing tasks`);
    score -= (90 - useCaseCoverage) / 2;
    recommendations.push('Ensure all use cases have implementing tasks');
  }

  // Check feature coverage
  const featureCoverage = (coverage.featuresCovered / matrix.features.length) * 100;
  if (featureCoverage < 95) {
    issues.push(`Only ${featureCoverage.toFixed(1)}% of features have use cases`);
    score -= (95 - featureCoverage) / 2;
    recommendations.push('Create use cases for all features');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    isComplete: score >= 90 && issues.length === 0,
    score: Math.round(score),
    issues,
    recommendations
  };
}

/**
 * Format traceability matrix summary
 */
function formatTraceabilityMatrixSummary(
  matrix: any,
  validation: any,
  args: CreateTraceabilityMatrixArgs
): string {
  const sections = [
    '# Requirements Traceability Matrix Created',
    '',
    `## Project: ${args.projectId}`,
    `**Matrix ID:** ${matrix.id}`,
    `**Created:** ${new Date(matrix.createdAt).toLocaleString()}`,
    `**Version:** ${matrix.version}`,
    ''
  ];

  // Hierarchy overview
  sections.push(
    '## Requirements Hierarchy',
    `**Business Requirements:** ${matrix.businessRequirements.length}`,
    `**Features:** ${matrix.features.length}`,
    `**Use Cases:** ${matrix.useCases.length}`,
    `**Tasks:** ${matrix.tasks.length}`,
    `**Traceability Links:** ${matrix.traceabilityLinks.length}`,
    ''
  );

  // Coverage analysis
  const coverage = matrix.coverage;
  sections.push(
    '## Traceability Coverage',
    `**Business Requirements Covered:** ${coverage.businessRequirementsCovered}/${matrix.businessRequirements.length} (${Math.round((coverage.businessRequirementsCovered/matrix.businessRequirements.length)*100)}%)`,
    `**Features with Use Cases:** ${coverage.featuresCovered}/${matrix.features.length} (${Math.round((coverage.featuresCovered/matrix.features.length)*100)}%)`,
    `**Use Cases with Tasks:** ${coverage.useCasesCovered}/${matrix.useCases.length} (${Math.round((coverage.useCasesCovered/matrix.useCases.length)*100)}%)`,
    `**Tasks with Traceability:** ${coverage.tasksWithTraceability}/${matrix.tasks.length} (${Math.round((coverage.tasksWithTraceability/matrix.tasks.length)*100)}%)`,
    ''
  );

  // Issues and gaps
  if (coverage.orphanedTasks.length > 0) {
    sections.push(
      '### ⚠️ Orphaned Tasks (No Requirements Link)',
      ...coverage.orphanedTasks.slice(0, 5).map((taskId: string) => {
        const task = matrix.tasks.find((t: any) => t.id === taskId);
        return `- ${task?.title || taskId}`;
      }),
      coverage.orphanedTasks.length > 5 ? `... and ${coverage.orphanedTasks.length - 5} more` : '',
      ''
    );
  }

  if (coverage.unimplementedRequirements.length > 0) {
    sections.push(
      '### ⚠️ Unimplemented Requirements',
      ...coverage.unimplementedRequirements.slice(0, 5).map((reqId: string) => {
        const req = matrix.businessRequirements.find((r: any) => r.id === reqId);
        return `- ${req?.title || reqId}`;
      }),
      coverage.unimplementedRequirements.length > 5 ? `... and ${coverage.unimplementedRequirements.length - 5} more` : '',
      ''
    );
  }

  // Validation results
  if (validation) {
    sections.push(
      '## Validation Results',
      `**Completeness Score:** ${validation.score}/100`,
      `**Status:** ${validation.isComplete ? '✅ Complete' : '⚠️ Needs Attention'}`,
      ''
    );

    if (validation.issues.length > 0) {
      sections.push(
        '**Issues Found:**',
        ...validation.issues.map((issue: string) => `- ${issue}`),
        ''
      );
    }

    if (validation.recommendations.length > 0) {
      sections.push(
        '**Recommendations:**',
        ...validation.recommendations.map((rec: string) => `- ${rec}`),
        ''
      );
    }
  }

  // Sample traceability paths
  sections.push(
    '## Sample Traceability Paths',
    ''
  );

  // Show a few complete traceability paths
  matrix.businessRequirements.slice(0, 3).forEach((req: any, index: number) => {
    const relatedFeatures = matrix.features.filter((f: any) =>
      matrix.traceabilityLinks.some((link: any) =>
        link.fromRequirementId === req.id && link.toRequirementId === f.id
      )
    );

    if (relatedFeatures.length > 0) {
      const feature = relatedFeatures[0];
      const relatedUseCases = matrix.useCases.filter((uc: any) => uc.parentFeatureId === feature.id);
      const relatedTasks = matrix.tasks.filter((task: any) => task.implementsFeatures.includes(feature.id));

      sections.push(
        `### Path ${index + 1}: ${req.title}`,
        `**Business Requirement** → **Feature:** ${feature.title}`,
        relatedUseCases.length > 0 ? `**Feature** → **Use Case:** ${relatedUseCases[0].title}` : '',
        relatedTasks.length > 0 ? `**Use Case** → **Task:** ${relatedTasks[0].title}` : '',
        ''
      );
    }
  });

  // Next steps
  sections.push(
    '## Next Steps',
    '1. Review and address any orphaned tasks or unimplemented requirements',
    '2. Use the traceability matrix to track requirement changes',
    '3. Update task progress and verify requirement implementation',
    '4. Use traceability for impact analysis when requirements change',
    '5. Generate test cases based on use cases and acceptance criteria',
    ''
  );

  // Related commands
  sections.push(
    '## Related Commands',
    '- `validate_requirements` - Validate requirement completeness',
    '- `track_requirement_changes` - Track changes to requirements',
    '- `generate_test_cases` - Generate test cases from use cases',
    '- `analyze_impact` - Analyze impact of requirement changes'
  );

  return sections.join('\n');
}

// Tool definition
export const createTraceabilityMatrixTool: ToolDefinition<CreateTraceabilityMatrixArgs> = {
  name: "create_traceability_matrix",
  description: "Create a comprehensive requirements traceability matrix linking PRD business requirements → features → use cases → tasks with full bidirectional traceability",
  schema: createTraceabilityMatrixSchema as unknown as ToolSchema<CreateTraceabilityMatrixArgs>,
  examples: [
    {
      name: "Create traceability matrix for project",
      description: "Create a comprehensive traceability matrix for a project",
      args: {
        projectId: "task-management-app",
        prdContent: "# Task Management App PRD\n\n## Objectives\n- Improve team productivity\n- Streamline task tracking\n\n## Success Metrics\n- User adoption > 80%\n- Task completion rate increase by 25%",
        features: [
          {
            id: "feature-1",
            title: "Task Creation",
            description: "Allow users to create and manage tasks",
            priority: "high",
            userStories: ["As a user, I want to create tasks so that I can track my work"],
            acceptanceCriteria: ["User can create task with title and description", "Task is saved to database"],
            estimatedComplexity: 5
          }
        ],
        tasks: [
          {
            id: "task-1",
            title: "Implement task creation API",
            description: "Create REST API endpoint for task creation",
            complexity: 4,
            estimatedHours: 8,
            priority: "high"
          }
        ],
        includeUseCases: true,
        includeTraceabilityLinks: true,
        includeCoverageAnalysis: true,
        validateCompleteness: true
      }
    }
  ]
};

// Export the execution function
export { executeCreateTraceabilityMatrix };
