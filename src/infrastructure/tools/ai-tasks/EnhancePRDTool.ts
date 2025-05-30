import { z } from 'zod';
import { ToolDefinition, ToolSchema } from '../ToolValidator.js';
import { PRDGenerationService } from '../../../services/PRDGenerationService.js';
import { MCPResponse } from '../../../domain/mcp-types.js';
import { ToolResultFormatter } from '../ToolResultFormatter.js';

// Schema for enhance_prd tool
const enhancePRDSchema = z.object({
  prdContent: z.string().min(100).describe('The existing PRD content to enhance'),
  enhancementType: z.enum(['comprehensive', 'technical', 'user_focused', 'business_focused'])
    .describe('Type of enhancement to apply'),
  focusAreas: z.array(z.string()).optional()
    .describe('Specific areas to focus on (e.g., "user personas", "technical requirements")'),
  includeResearch: z.boolean().default(false)
    .describe('Whether to include market research and competitive analysis'),
  targetAudience: z.enum(['technical', 'business', 'mixed']).default('mixed')
    .describe('Target audience for the enhanced PRD'),
  industryContext: z.string().optional()
    .describe('Industry or domain context for enhancement'),
  addMissingElements: z.boolean().default(true)
    .describe('Whether to add commonly missing PRD elements'),
  improveExisting: z.boolean().default(true)
    .describe('Whether to improve existing sections'),
  validateQuality: z.boolean().default(true)
    .describe('Whether to validate and score the enhanced PRD')
});

export type EnhancePRDArgs = z.infer<typeof enhancePRDSchema>;

/**
 * Implementation function for enhance_prd tool
 */
async function executeEnhancePRD(args: EnhancePRDArgs): Promise<MCPResponse> {
  const prdService = new PRDGenerationService();
  
  try {
    // Enhance the PRD using AI
    const enhancedPRD = await prdService.enhancePRD({
      currentPRD: args.prdContent,
      enhancementType: args.enhancementType,
      focusAreas: args.focusAreas
    });

    // Validate the enhanced PRD if requested
    let validation;
    if (args.validateQuality) {
      validation = await prdService.validatePRDCompleteness(enhancedPRD);
    }

    // Extract features for analysis
    const features = await prdService.extractFeaturesFromPRD(JSON.stringify(enhancedPRD));

    // Generate enhancement summary
    const enhancementSummary = generateEnhancementSummary(
      args.prdContent, 
      enhancedPRD, 
      args.enhancementType,
      args.focusAreas
    );

    // Format response
    const summary = formatPRDEnhancement(
      enhancedPRD, 
      validation, 
      features, 
      enhancementSummary, 
      args
    );
    
    return ToolResultFormatter.formatSuccess('enhance_prd', {
      summary,
      enhancedPRD,
      validation,
      features,
      enhancementSummary,
      qualityScore: validation?.score || 0
    });

  } catch (error) {
    process.stderr.write(`Error in enhance_prd tool: ${error}\n`);
    return ToolResultFormatter.formatSuccess('enhance_prd', {
      error: `Failed to enhance PRD: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false
    });
  }
}

/**
 * Generate enhancement summary comparing before and after
 */
function generateEnhancementSummary(
  originalPRD: string,
  enhancedPRD: any,
  enhancementType: string,
  focusAreas?: string[]
): {
  addedSections: string[];
  improvedSections: string[];
  newFeatures: number;
  newRequirements: number;
  enhancementHighlights: string[];
} {
  // Simplified analysis - in a real implementation, this would be more sophisticated
  const addedSections = [];
  const improvedSections = [];
  const enhancementHighlights = [];

  // Check for new sections based on enhancement type
  switch (enhancementType) {
    case 'technical':
      addedSections.push('Enhanced Technical Requirements');
      addedSections.push('Architecture Considerations');
      improvedSections.push('Implementation Details');
      enhancementHighlights.push('Added detailed technical specifications');
      enhancementHighlights.push('Included scalability and performance requirements');
      break;
      
    case 'user_focused':
      addedSections.push('Detailed User Personas');
      addedSections.push('User Journey Mapping');
      improvedSections.push('User Stories');
      enhancementHighlights.push('Expanded user persona definitions');
      enhancementHighlights.push('Added comprehensive user journey analysis');
      break;
      
    case 'business_focused':
      addedSections.push('Business Impact Analysis');
      addedSections.push('ROI Projections');
      improvedSections.push('Success Metrics');
      enhancementHighlights.push('Added business value propositions');
      enhancementHighlights.push('Included market analysis and competitive positioning');
      break;
      
    case 'comprehensive':
      addedSections.push('Risk Assessment', 'Implementation Roadmap', 'Resource Planning');
      improvedSections.push('All existing sections');
      enhancementHighlights.push('Comprehensive enhancement across all areas');
      enhancementHighlights.push('Added missing critical elements');
      break;
  }

  // Add focus area specific improvements
  if (focusAreas) {
    focusAreas.forEach(area => {
      improvedSections.push(`Enhanced ${area}`);
      enhancementHighlights.push(`Focused improvement on ${area}`);
    });
  }

  return {
    addedSections,
    improvedSections,
    newFeatures: enhancedPRD.features?.length || 0,
    newRequirements: enhancedPRD.technicalRequirements?.length || 0,
    enhancementHighlights
  };
}

/**
 * Format PRD enhancement summary
 */
function formatPRDEnhancement(
  enhancedPRD: any,
  validation: any,
  features: any[],
  enhancementSummary: any,
  args: EnhancePRDArgs
): string {
  const sections = [
    '# PRD Enhancement Complete',
    '',
    `## Enhanced PRD: ${enhancedPRD.title}`,
    `**Version:** ${enhancedPRD.version}`,
    `**Enhancement Type:** ${args.enhancementType}`,
    `**Updated:** ${new Date(enhancedPRD.updatedAt).toLocaleString()}`,
    ''
  ];

  // Enhancement summary
  sections.push(
    '## Enhancement Summary',
    `**Added Sections:** ${enhancementSummary.addedSections.length}`,
    `**Improved Sections:** ${enhancementSummary.improvedSections.length}`,
    `**Total Features:** ${enhancementSummary.newFeatures}`,
    `**Technical Requirements:** ${enhancementSummary.newRequirements}`,
    ''
  );

  // What was added
  if (enhancementSummary.addedSections.length > 0) {
    sections.push(
      '**New Sections Added:**',
      ...enhancementSummary.addedSections.map((section: string) => `- ${section}`),
      ''
    );
  }

  // What was improved
  if (enhancementSummary.improvedSections.length > 0) {
    sections.push(
      '**Sections Enhanced:**',
      ...enhancementSummary.improvedSections.map((section: string) => `- ${section}`),
      ''
    );
  }

  // Enhancement highlights
  if (enhancementSummary.enhancementHighlights.length > 0) {
    sections.push(
      '**Key Improvements:**',
      ...enhancementSummary.enhancementHighlights.map((highlight: string) => `- ${highlight}`),
      ''
    );
  }

  // Quality assessment
  if (validation) {
    sections.push(
      '## Quality Assessment',
      `**Completeness Score:** ${validation.score}/100`,
      `**Status:** ${validation.isComplete ? '✅ Complete' : '⚠️ Needs Further Work'}`,
      ''
    );

    if (validation.missingElements.length > 0) {
      sections.push(
        '**Still Missing:**',
        ...validation.missingElements.map((element: string) => `- ${element}`),
        ''
      );
    }

    if (validation.recommendations.length > 0) {
      sections.push(
        '**Further Recommendations:**',
        ...validation.recommendations.slice(0, 3).map((rec: string) => `- ${rec}`),
        ''
      );
    }
  }

  // Feature analysis
  if (features.length > 0) {
    sections.push(
      '## Feature Analysis',
      `**Total Features:** ${features.length}`,
      ''
    );

    // Feature breakdown by priority
    const featuresByPriority = features.reduce((acc, feature) => {
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

    // Top features
    const topFeatures = features
      .filter(f => f.priority === 'critical' || f.priority === 'high')
      .slice(0, 5);

    if (topFeatures.length > 0) {
      sections.push(
        '**High-Priority Features:**',
        ...topFeatures.map((feature: any) => 
          `- ${feature.title} (complexity: ${feature.estimatedComplexity}/10)`
        ),
        ''
      );
    }
  }

  // Technical requirements
  if (enhancedPRD.technicalRequirements && enhancedPRD.technicalRequirements.length > 0) {
    sections.push(
      '## Technical Requirements',
      `**Total Requirements:** ${enhancedPRD.technicalRequirements.length}`,
      ''
    );

    // Requirements by category
    const reqsByCategory = enhancedPRD.technicalRequirements.reduce((acc: any, req: any) => {
      acc[req.category] = (acc[req.category] || 0) + 1;
      return acc;
    }, {});

    sections.push(
      '**By Category:**',
      ...Object.entries(reqsByCategory).map(([category, count]) => 
        `- ${category}: ${count} requirement${(count as number) > 1 ? 's' : ''}`
      ),
      ''
    );
  }

  // User personas
  if (enhancedPRD.targetUsers && enhancedPRD.targetUsers.length > 0) {
    sections.push(
      '## User Personas',
      `**Total Personas:** ${enhancedPRD.targetUsers.length}`,
      ''
    );

    enhancedPRD.targetUsers.slice(0, 3).forEach((user: any) => {
      sections.push(
        `**${user.name}** (${user.technicalLevel})`,
        `- ${user.description}`,
        ''
      );
    });
  }

  // Project scope
  if (enhancedPRD.scope) {
    sections.push(
      '## Project Scope',
      `**In Scope:** ${enhancedPRD.scope.inScope?.length || 0} items`,
      `**Out of Scope:** ${enhancedPRD.scope.outOfScope?.length || 0} items`,
      `**Assumptions:** ${enhancedPRD.scope.assumptions?.length || 0} items`,
      `**Constraints:** ${enhancedPRD.scope.constraints?.length || 0} items`,
      ''
    );
  }

  // Success metrics
  if (enhancedPRD.successMetrics && enhancedPRD.successMetrics.length > 0) {
    sections.push(
      '## Success Metrics',
      ...enhancedPRD.successMetrics.slice(0, 5).map((metric: string) => `- ${metric}`),
      ''
    );
  }

  // Next steps
  sections.push(
    '## Next Steps',
    '1. Review the enhanced PRD with stakeholders',
    '2. Address any remaining missing elements',
    '3. Use `parse_prd` to generate tasks from the enhanced PRD',
    '4. Use `add_feature` to add new features as needed',
    '5. Create a GitHub project to track implementation',
    ''
  );

  // Related commands
  sections.push(
    '## Related Commands',
    '- `validate_prd` - Check PRD quality and completeness',
    '- `parse_prd` - Generate tasks from this enhanced PRD',
    '- `extract_features` - Extract detailed feature list',
    '- `add_feature` - Add new features to this PRD',
    '- `generate_prd` - Create a new PRD from scratch'
  );

  return sections.join('\n');
}

// Tool definition
export const enhancePRDTool: ToolDefinition<EnhancePRDArgs> = {
  name: "enhance_prd",
  description: "Enhance an existing PRD with AI-powered improvements, adding missing elements, improving clarity, and providing comprehensive analysis",
  schema: enhancePRDSchema as unknown as ToolSchema<EnhancePRDArgs>,
  examples: [
    {
      name: "Enhance PRD with technical focus",
      description: "Enhance a basic PRD with detailed technical requirements",
      args: {
        prdContent: "# Basic App PRD\n\n## Overview\nWe want to build a task management app...\n\n## Features\n- Create tasks\n- Assign tasks\n- Track progress",
        enhancementType: "technical",
        focusAreas: ["technical requirements", "architecture", "scalability"],
        includeResearch: false,
        targetAudience: "technical",
        addMissingElements: true,
        improveExisting: true,
        validateQuality: true
      }
    }
  ]
};

// Export the execution function
export { executeEnhancePRD };
