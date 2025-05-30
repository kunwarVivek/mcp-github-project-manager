import { z } from 'zod';
import { ToolDefinition, ToolSchema } from '../ToolValidator.js';
import { TaskGenerationService } from '../../../services/TaskGenerationService.js';
import { TaskStatus, TaskPriority, TaskComplexity } from '../../../domain/ai-types.js';
import { MCPResponse } from '../../../domain/mcp-types.js';
import { ToolResultFormatter } from '../ToolResultFormatter.js';

// Schema for analyze_task_complexity tool
const analyzeTaskComplexitySchema = z.object({
  taskTitle: z.string().min(3).describe('Title of the task to analyze'),
  taskDescription: z.string().min(10).describe('Detailed description of the task'),
  currentEstimate: z.number().optional().describe('Current effort estimate in hours (if any)'),
  teamExperience: z.enum(['junior', 'mid', 'senior', 'mixed']).default('mixed')
    .describe('Team experience level'),
  projectContext: z.string().optional().describe('Additional project context'),
  includeBreakdown: z.boolean().default(true).describe('Whether to include effort breakdown'),
  includeRisks: z.boolean().default(true).describe('Whether to include risk analysis'),
  includeRecommendations: z.boolean().default(true).describe('Whether to include recommendations')
});

export type AnalyzeTaskComplexityArgs = z.infer<typeof analyzeTaskComplexitySchema>;

/**
 * Implementation function for analyze_task_complexity tool
 */
async function executeAnalyzeTaskComplexity(args: AnalyzeTaskComplexityArgs): Promise<MCPResponse> {
  const taskService = new TaskGenerationService();

  try {
    // Create a mock task for analysis
    const mockTask = {
      id: 'analysis-task',
      title: args.taskTitle,
      description: args.taskDescription,
      complexity: 5 as TaskComplexity, // Will be updated by analysis
      estimatedHours: args.currentEstimate || 0,
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

    // Perform complexity analysis
    const analysis = await taskService.analyzeTaskComplexity(mockTask);

    // Generate detailed breakdown
    const breakdown = generateEffortBreakdown(analysis.estimatedHours, args.teamExperience);

    // Assess risks
    const risks = args.includeRisks ? assessTaskRisks(args, analysis) : [];

    // Generate recommendations
    const recommendations = args.includeRecommendations ?
      generateTaskRecommendations(args, analysis, risks) : [];

    // Calculate confidence level
    const confidence = calculateConfidenceLevel(args, analysis);

    // Format response
    const summary = formatComplexityAnalysis(args, analysis, breakdown, risks, recommendations, confidence);

    return ToolResultFormatter.formatSuccess('analyze_task_complexity', {
      summary,
      analysis: {
        originalComplexity: mockTask.complexity,
        newComplexity: analysis.newComplexity,
        estimatedHours: analysis.estimatedHours,
        confidence,
        breakdown,
        risks,
        recommendations
      }
    });

  } catch (error) {
    process.stderr.write(`Error in analyze_task_complexity tool: ${error}\n`);
    return ToolResultFormatter.formatSuccess('analyze_task_complexity', {
      error: `Failed to analyze task complexity: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false
    });
  }
}

/**
 * Generate effort breakdown by activity type
 */
function generateEffortBreakdown(totalHours: number, teamExperience: string) {
  // Adjust percentages based on team experience
  let analysisPercent = 0.15;
  let implementationPercent = 0.60;
  let testingPercent = 0.20;
  let documentationPercent = 0.05;

  switch (teamExperience) {
    case 'junior':
      analysisPercent = 0.20;
      implementationPercent = 0.55;
      testingPercent = 0.20;
      documentationPercent = 0.05;
      break;
    case 'senior':
      analysisPercent = 0.10;
      implementationPercent = 0.65;
      testingPercent = 0.20;
      documentationPercent = 0.05;
      break;
  }

  return {
    analysis: Math.round(totalHours * analysisPercent),
    implementation: Math.round(totalHours * implementationPercent),
    testing: Math.round(totalHours * testingPercent),
    documentation: Math.round(totalHours * documentationPercent),
    total: totalHours
  };
}

/**
 * Assess task risks
 */
function assessTaskRisks(args: AnalyzeTaskComplexityArgs, analysis: any): Array<{
  type: string;
  level: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}> {
  const risks = [];

  // Complexity risk
  if (analysis.newComplexity >= 8) {
    risks.push({
      type: 'High Complexity',
      level: 'high' as const,
      description: 'Task has very high complexity and may be difficult to estimate accurately',
      mitigation: 'Break down into smaller subtasks and consider pair programming'
    });
  } else if (analysis.newComplexity >= 6) {
    risks.push({
      type: 'Medium Complexity',
      level: 'medium' as const,
      description: 'Task has moderate complexity with some challenging aspects',
      mitigation: 'Plan for additional review time and consider technical spike'
    });
  }

  // Team experience risk
  if (args.teamExperience === 'junior' && analysis.newComplexity >= 6) {
    risks.push({
      type: 'Experience Mismatch',
      level: 'medium' as const,
      description: 'Complex task assigned to junior team may take longer than estimated',
      mitigation: 'Provide mentoring support and consider pairing with senior developer'
    });
  }

  // Estimation risk
  if (args.currentEstimate && Math.abs(args.currentEstimate - analysis.estimatedHours) > args.currentEstimate * 0.5) {
    risks.push({
      type: 'Estimation Variance',
      level: 'medium' as const,
      description: 'Significant difference between current and AI-generated estimates',
      mitigation: 'Review requirements and consider additional analysis phase'
    });
  }

  // Scope risk
  if (args.taskDescription.length < 50) {
    risks.push({
      type: 'Unclear Requirements',
      level: 'medium' as const,
      description: 'Task description may be too brief, leading to scope creep',
      mitigation: 'Gather more detailed requirements before starting implementation'
    });
  }

  return risks;
}

/**
 * Generate task recommendations
 */
function generateTaskRecommendations(
  args: AnalyzeTaskComplexityArgs,
  analysis: any,
  risks: any[]
): string[] {
  const recommendations = [];

  // Complexity-based recommendations
  if (analysis.newComplexity >= 8) {
    recommendations.push('Consider breaking this task into 2-3 smaller subtasks');
    recommendations.push('Plan for additional code review and testing time');
  }

  if (analysis.newComplexity >= 6) {
    recommendations.push('Create a technical design document before implementation');
    recommendations.push('Consider doing a technical spike to reduce uncertainty');
  }

  // Team-based recommendations
  if (args.teamExperience === 'junior') {
    recommendations.push('Assign a senior developer as mentor for this task');
    recommendations.push('Plan for additional learning and ramp-up time');
  }

  if (args.teamExperience === 'senior') {
    recommendations.push('This task is suitable for independent execution');
    recommendations.push('Consider using this as a mentoring opportunity for junior developers');
  }

  // Risk-based recommendations
  const highRisks = risks.filter(risk => risk.level === 'high');
  if (highRisks.length > 0) {
    recommendations.push('Address high-risk factors before starting implementation');
  }

  // Effort-based recommendations
  if (analysis.estimatedHours > 16) {
    recommendations.push('Consider splitting into multiple sprint-sized tasks');
    recommendations.push('Plan for regular check-ins and progress reviews');
  }

  // Default recommendations
  if (recommendations.length === 0) {
    recommendations.push('Task appears well-scoped for implementation');
    recommendations.push('Follow standard development and testing practices');
  }

  return recommendations;
}

/**
 * Calculate confidence level for the analysis
 */
function calculateConfidenceLevel(args: AnalyzeTaskComplexityArgs, analysis: any): {
  level: 'high' | 'medium' | 'low';
  percentage: number;
  factors: string[];
} {
  let confidence = 70; // Base confidence
  const factors = [];

  // Adjust based on description quality
  if (args.taskDescription.length > 100) {
    confidence += 10;
    factors.push('Detailed task description provided');
  } else if (args.taskDescription.length < 50) {
    confidence -= 15;
    factors.push('Limited task description');
  }

  // Adjust based on context
  if (args.projectContext) {
    confidence += 5;
    factors.push('Project context provided');
  }

  // Adjust based on current estimate
  if (args.currentEstimate) {
    confidence += 5;
    factors.push('Existing estimate available for comparison');
  }

  // Adjust based on complexity
  if (analysis.newComplexity <= 5) {
    confidence += 10;
    factors.push('Task has manageable complexity');
  } else if (analysis.newComplexity >= 8) {
    confidence -= 10;
    factors.push('High complexity increases uncertainty');
  }

  // Determine level
  let level: 'high' | 'medium' | 'low';
  if (confidence >= 80) level = 'high';
  else if (confidence >= 60) level = 'medium';
  else level = 'low';

  return {
    level,
    percentage: Math.min(Math.max(confidence, 0), 100),
    factors
  };
}

/**
 * Format complexity analysis summary
 */
function formatComplexityAnalysis(
  args: AnalyzeTaskComplexityArgs,
  analysis: any,
  breakdown: any,
  risks: any[],
  recommendations: string[],
  confidence: any
): string {
  const sections = [
    '# Task Complexity Analysis',
    '',
    `## Task: ${args.taskTitle}`,
    `**Description:** ${args.taskDescription}`,
    ''
  ];

  // Analysis results
  sections.push(
    '## Analysis Results',
    `**Complexity Score:** ${analysis.newComplexity}/10`,
    `**Estimated Effort:** ${analysis.estimatedHours} hours`,
    `**Confidence Level:** ${confidence.level} (${confidence.percentage}%)`,
    `**Team Experience:** ${args.teamExperience}`,
    ''
  );

  // Comparison with current estimate
  if (args.currentEstimate) {
    const difference = analysis.estimatedHours - args.currentEstimate;
    const percentDiff = Math.round((difference / args.currentEstimate) * 100);
    sections.push(
      '## Estimate Comparison',
      `**Current Estimate:** ${args.currentEstimate} hours`,
      `**AI Estimate:** ${analysis.estimatedHours} hours`,
      `**Difference:** ${difference > 0 ? '+' : ''}${difference} hours (${percentDiff > 0 ? '+' : ''}${percentDiff}%)`,
      ''
    );
  }

  // Effort breakdown
  if (args.includeBreakdown) {
    sections.push(
      '## Effort Breakdown',
      `**Analysis & Planning:** ${breakdown.analysis} hours (${Math.round((breakdown.analysis/breakdown.total)*100)}%)`,
      `**Implementation:** ${breakdown.implementation} hours (${Math.round((breakdown.implementation/breakdown.total)*100)}%)`,
      `**Testing:** ${breakdown.testing} hours (${Math.round((breakdown.testing/breakdown.total)*100)}%)`,
      `**Documentation:** ${breakdown.documentation} hours (${Math.round((breakdown.documentation/breakdown.total)*100)}%)`,
      ''
    );
  }

  // Risk analysis
  if (args.includeRisks && risks.length > 0) {
    sections.push('## Risk Analysis');

    risks.forEach(risk => {
      const riskIcon = risk.level === 'high' ? '🔴' : risk.level === 'medium' ? '🟡' : '🟢';
      sections.push(
        `### ${riskIcon} ${risk.type} (${risk.level})`,
        `**Risk:** ${risk.description}`,
        `**Mitigation:** ${risk.mitigation}`,
        ''
      );
    });
  }

  // Recommendations
  if (args.includeRecommendations && recommendations.length > 0) {
    sections.push(
      '## Recommendations',
      ...recommendations.map(rec => `- ${rec}`),
      ''
    );
  }

  // Confidence factors
  sections.push(
    '## Confidence Factors',
    ...confidence.factors.map((factor: string) => `- ${factor}`),
    ''
  );

  // Next steps
  sections.push(
    '## Next Steps',
    '1. Review the analysis and adjust estimates if needed',
    '2. Address any high-risk factors before starting',
    '3. Use `expand_task` if complexity is too high',
    '4. Use `update_task_lifecycle` to track actual vs estimated effort',
    ''
  );

  // Related commands
  sections.push(
    '## Related Commands',
    '- `expand_task` - Break down complex tasks into subtasks',
    '- `get_next_task` - Get recommendations for task prioritization',
    '- `update_task_lifecycle` - Track actual effort and progress'
  );

  return sections.join('\n');
}

// Tool definition
export const analyzeTaskComplexityTool: ToolDefinition<AnalyzeTaskComplexityArgs> = {
  name: "analyze_task_complexity",
  description: "Perform detailed AI-powered analysis of task complexity, effort estimation, risk assessment, and provide actionable recommendations",
  schema: analyzeTaskComplexitySchema as unknown as ToolSchema<AnalyzeTaskComplexityArgs>,
  examples: [
    {
      name: "Analyze complex feature task",
      description: "Analyze the complexity of implementing a new feature",
      args: {
        taskTitle: "Implement real-time chat system",
        taskDescription: "Build a WebSocket-based real-time chat system with message history, file sharing, user presence indicators, and message encryption",
        currentEstimate: 20,
        teamExperience: "mixed",
        projectContext: "Adding to existing React/Node.js application",
        includeBreakdown: true,
        includeRisks: true,
        includeRecommendations: true
      }
    }
  ]
};

// Export the execution function
export { executeAnalyzeTaskComplexity };
