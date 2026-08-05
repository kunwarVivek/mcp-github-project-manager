import { z } from "zod";
import type { PRDDocument } from './prd-types';

// ============================================================================
// Enhanced Task Generation Configuration
// ============================================================================

/**
 * Enhanced Task Generation Configuration
 */
export interface EnhancedTaskGenerationConfig {
  // Core Enhancement Settings
  enableEnhancedGeneration: boolean;
  createTraceabilityMatrix: boolean;
  generateUseCases: boolean;
  createLifecycleTracking: boolean;

  // Context Level Configuration
  contextLevel: 'minimal' | 'standard' | 'full';
  includeBusinessContext: boolean;
  includeTechnicalContext: boolean;
  includeImplementationGuidance: boolean;

  // Performance Settings
  maxContextTokens?: number;
  enableContextCaching?: boolean;
  parallelContextGeneration?: boolean;

  // Traceability Settings
  enforceTraceability: boolean;
  requireBusinessJustification: boolean;
  trackRequirementCoverage: boolean;
}

/**
 * Enhanced Task Generation Parameters
 */
export interface EnhancedTaskGenerationParams {
  // Basic Parameters
  prd: PRDDocument | string;
  maxTasks?: number;
  includeSubtasks?: boolean;
  autoEstimate?: boolean;
  autoPrioritize?: boolean;

  // Enhanced Parameters
  enhancedConfig?: Partial<EnhancedTaskGenerationConfig>;
  projectId?: string;
  targetComplexity?: number;

  // Context Parameters
  businessObjectives?: string[];
  technicalConstraints?: string[];
  teamSkills?: string[];
  projectTimeline?: string;
}

export const EnhancedTaskGenerationConfigSchema = z.object({
  enableEnhancedGeneration: z.boolean(),
  createTraceabilityMatrix: z.boolean(),
  generateUseCases: z.boolean(),
  createLifecycleTracking: z.boolean(),
  contextLevel: z.enum(['minimal', 'standard', 'full']),
  includeBusinessContext: z.boolean(),
  includeTechnicalContext: z.boolean(),
  includeImplementationGuidance: z.boolean(),
  maxContextTokens: z.number().optional(),
  enableContextCaching: z.boolean().optional(),
  parallelContextGeneration: z.boolean().optional(),
  enforceTraceability: z.boolean(),
  requireBusinessJustification: z.boolean(),
  trackRequirementCoverage: z.boolean()
});
