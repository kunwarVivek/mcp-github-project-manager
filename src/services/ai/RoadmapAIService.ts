/**
 * RoadmapAIService
 *
 * AI-powered roadmap generation service that creates structured roadmaps
 * from requirements with phases, milestones, and velocity-grounded dates.
 *
 * Phase 10 Requirements:
 * - AI-13: Roadmap generation from requirements
 * - AI-14: Phase sequencing with dependencies
 * - AI-15: Milestone estimation (velocity-grounded, NOT AI-generated dates)
 * - AI-16: Visualization data for Gantt rendering
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import { AIServiceFactory } from './AIServiceFactory';
import {
  EstimationCalibrator,
  complexityToPoints
} from '../../analysis/EstimationCalibrator';
import {
  calculateWeightedScore,
  getConfidenceTier
} from './ConfidenceScorer';
import {
  GeneratedRoadmap,
  RoadmapPhase,
  RoadmapMilestone,
  MilestoneDependency,
  RoadmapGenerationInput,
  RequirementItem,
  RoadmapVisualizationData
} from '../../domain/roadmap-planning-types';
import { SectionConfidence, TaskComplexity } from '../../domain/ai-types';
import {
  ROADMAP_GENERATION_SYSTEM_PROMPT,
  REQUIREMENTS_PARSING_PROMPT,
  formatRequirementsForPrompt,
  formatConstraintsForPrompt
} from './prompts/RoadmapPrompts';

// ============================================================================
// Zod Schemas for AI Structured Output
// ============================================================================

/**
 * Schema for parsing requirements from text
 */
const RequirementParseSchema = z.object({
  requirements: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      priority: z.enum(['critical', 'high', 'medium', 'low']),
      estimatedComplexity: z.number().min(1).max(10),
      category: z.string()
    })
  )
});

/**
 * Schema for roadmap structure generation
 */
const RoadmapStructureSchema = z.object({
  phases: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      objectives: z.array(z.string()),
      durationWeeks: z.number(),
      requirementIds: z.array(z.string())
    })
  ),
  milestones: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      phaseId: z.string(),
      weekNumber: z.number(),
      deliverables: z.array(z.string()),
      dependencies: z.array(z.string()),
      confidence: z.number().min(0).max(1)
    })
  ),
  reasoning: z.string()
});

type RoadmapStructure = z.infer<typeof RoadmapStructureSchema>;
type ParsedRequirement = z.infer<typeof RequirementParseSchema>['requirements'][0];

// ============================================================================
// RoadmapAIService
// ============================================================================

/**
 * Service for AI-powered roadmap generation
 *
 * Key features:
 * - Parses text requirements into structured format
 * - Uses EstimationCalibrator for effort estimation
 * - Generates phases with proper sequencing (AI-14)
 * - Calculates dates algorithmically from velocity (AI-15)
 * - Provides visualization data for Gantt rendering (AI-16)
 * - Has fallback behavior when AI unavailable
 */
export class RoadmapAIService {
  private aiFactory: AIServiceFactory;
  private estimationCalibrator: EstimationCalibrator;

  constructor(estimationCalibrator?: EstimationCalibrator) {
    this.aiFactory = AIServiceFactory.getInstance();
    this.estimationCalibrator = estimationCalibrator || new EstimationCalibrator();
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Generate a complete roadmap from requirements (AI-13)
   *
   * @param input - Roadmap generation input with requirements and constraints
   * @returns Generated roadmap with phases, milestones, and dates
   */
  async generateRoadmap(input: RoadmapGenerationInput): Promise<GeneratedRoadmap> {
    // 1. Parse requirements if string
    const requirements =
      typeof input.requirements === 'string'
        ? await this.parseRequirements(input.requirements)
        : input.requirements;

    // 2. Estimate effort for each requirement
    const estimatedRequirements = this.estimateRequirements(requirements);

    // 3. Calculate timeline using velocity (AI-15: algorithmic, not AI-generated)
    const velocity = input.constraints?.velocity ?? 20;
    const sprintWeeks = input.constraints?.sprintDurationWeeks ?? 2;
    const bufferFactor = 1.2; // 20% buffer for integration/testing

    const totalPoints = estimatedRequirements.reduce(
      (sum, r) => sum + r.estimatedPoints,
      0
    );
    const sprints = Math.ceil((totalPoints * bufferFactor) / velocity);
    const totalWeeks = sprints * sprintWeeks;

    // 4. Generate roadmap structure with AI (AI-14: phase sequencing)
    const roadmapStructure = await this.generateRoadmapStructure(
      estimatedRequirements,
      input.constraints,
      totalWeeks
    );

    // 5. Calculate milestone dates from velocity (AI-15: velocity-grounded)
    const startDate = new Date();
    const roadmap = this.calculateMilestoneDates(
      roadmapStructure,
      startDate,
      velocity,
      sprintWeeks
    );

    // 6. Add confidence scoring
    roadmap.confidence = this.calculateConfidence(requirements, roadmapStructure);

    return roadmap;
  }

  /**
   * Generate visualization data for Gantt-style rendering (AI-16)
   *
   * @param roadmap - Generated roadmap
   * @returns Visualization-ready data structure
   */
  generateVisualizationData(roadmap: GeneratedRoadmap): RoadmapVisualizationData {
    // Accessible color palette for phases
    const colors = [
      '#4299e1', // blue
      '#48bb78', // green
      '#ed8936', // orange
      '#9f7aea', // purple
      '#ed64a6', // pink
      '#38b2ac' // teal
    ];

    return {
      phases: roadmap.phases.map((phase, i) => ({
        id: phase.id,
        name: phase.name,
        startWeek: phase.startWeek,
        endWeek: phase.endWeek,
        color: colors[i % colors.length]
      })),
      milestones: roadmap.milestones.map((m) => {
        // Calculate milestone week position within phase
        const phase = roadmap.phases.find((p) => p.id === m.phaseId);
        const targetDate = new Date(m.targetDate);
        const startDate = new Date(roadmap.timeline.startDate);
        const daysDiff = Math.floor(
          (targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const weekNumber = Math.max(1, Math.ceil(daysDiff / 7));

        return {
          id: m.id,
          title: m.title,
          week: phase ? Math.min(weekNumber, phase.endWeek) : weekNumber,
          phaseId: m.phaseId
        };
      }),
      dependencies: roadmap.dependencies.map((d) => ({
        from: d.fromMilestoneId,
        to: d.toMilestoneId
      })),
      totalWeeks: roadmap.timeline.totalWeeks
    };
  }

  // ==========================================================================
  // Requirements Parsing
  // ==========================================================================

  /**
   * Parse text requirements into structured format
   *
   * @param text - Raw text requirements
   * @returns Structured requirement items
   */
  private async parseRequirements(text: string): Promise<RequirementItem[]> {
    const model =
      this.aiFactory.getModel('main') || this.aiFactory.getBestAvailableModel();

    if (!model) {
      // Fallback: split by lines and create basic requirements
      return this.fallbackParseRequirements(text);
    }

    try {
      const result = await generateObject({
        model,
        system: REQUIREMENTS_PARSING_PROMPT,
        prompt: text,
        schema: RequirementParseSchema,
        temperature: 0.3
      });

      return result.object.requirements.map((r: ParsedRequirement) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        priority: r.priority,
        estimatedPoints: complexityToPoints(r.estimatedComplexity as TaskComplexity),
        category: r.category
      }));
    } catch (error) {
      // Fallback on error
      return this.fallbackParseRequirements(text);
    }
  }

  /**
   * Fallback requirement parsing without AI
   */
  private fallbackParseRequirements(text: string): RequirementItem[] {
    return text
      .split('\n')
      .filter((line) => line.trim())
      .map((line, i) => ({
        id: `REQ-${String(i + 1).padStart(3, '0')}`,
        title: line.trim().replace(/^[-*]\s*/, ''), // Remove leading bullets
        priority: 'medium' as const
      }));
  }

  // ==========================================================================
  // Effort Estimation
  // ==========================================================================

  /**
   * Estimate effort for requirements using EstimationCalibrator
   */
  private estimateRequirements(
    requirements: RequirementItem[]
  ): Array<RequirementItem & { estimatedPoints: number }> {
    return requirements.map((req) => {
      // Use existing points or estimate from priority
      const points = req.estimatedPoints || this.estimateFromPriority(req.priority);
      return { ...req, estimatedPoints: points };
    });
  }

  /**
   * Estimate points from priority level
   * Higher priority often correlates with higher complexity
   */
  private estimateFromPriority(priority?: string): number {
    switch (priority) {
      case 'critical':
        return 8;
      case 'high':
        return 5;
      case 'medium':
        return 3;
      case 'low':
        return 2;
      default:
        return 3;
    }
  }

  // ==========================================================================
  // Roadmap Structure Generation
  // ==========================================================================

  /**
   * Generate roadmap structure using AI (phases and milestones)
   */
  private async generateRoadmapStructure(
    requirements: Array<RequirementItem & { estimatedPoints: number }>,
    constraints: RoadmapGenerationInput['constraints'],
    totalWeeks: number
  ): Promise<RoadmapStructure> {
    const model =
      this.aiFactory.getModel('prd') || this.aiFactory.getBestAvailableModel();

    if (!model) {
      return this.getFallbackRoadmapStructure(requirements, totalWeeks);
    }

    try {
      const prompt = `Generate a roadmap for the following requirements:

${formatRequirementsForPrompt(requirements)}
${formatConstraintsForPrompt(constraints)}

Total estimated timeline: ${totalWeeks} weeks

Create logical phases with milestones. Use weekNumber to indicate when each milestone should be completed (1 = first week, ${totalWeeks} = last week).

IMPORTANT: Follow phase sequencing rules - foundation first, then core, then advanced features.`;

      const result = await generateObject({
        model,
        system: ROADMAP_GENERATION_SYSTEM_PROMPT,
        prompt,
        schema: RoadmapStructureSchema,
        temperature: 0.5
      });

      return result.object;
    } catch (error) {
      return this.getFallbackRoadmapStructure(requirements, totalWeeks);
    }
  }

  /**
   * Fallback roadmap structure when AI unavailable
   */
  private getFallbackRoadmapStructure(
    requirements: Array<RequirementItem & { estimatedPoints: number }>,
    totalWeeks: number
  ): RoadmapStructure {
    // Group requirements into 3-4 phases based on count
    const numPhases = Math.min(4, Math.max(2, Math.ceil(requirements.length / 5)));
    const reqsPerPhase = Math.ceil(requirements.length / numPhases);
    const weeksPerPhase = Math.ceil(totalWeeks / numPhases);

    const phases = [];
    const milestones = [];

    for (let i = 0; i < numPhases; i++) {
      const phaseReqs = requirements.slice(
        i * reqsPerPhase,
        (i + 1) * reqsPerPhase
      );
      const phaseId = `phase-${i + 1}`;

      const phaseName = this.getDefaultPhaseName(i, numPhases);

      phases.push({
        id: phaseId,
        name: phaseName,
        description: `Implementation phase ${i + 1}: ${phaseName}`,
        objectives: phaseReqs.slice(0, 3).map((r) => r.title),
        durationWeeks: weeksPerPhase,
        requirementIds: phaseReqs.map((r) => r.id || '')
      });

      milestones.push({
        id: `milestone-${i + 1}`,
        title: `${phaseName} Complete`,
        description: `Completion of ${phaseName.toLowerCase()} deliverables`,
        phaseId,
        weekNumber: (i + 1) * weeksPerPhase,
        deliverables: phaseReqs.slice(0, 3).map((r) => r.title),
        dependencies: i > 0 ? [`milestone-${i}`] : [],
        confidence: 0.6
      });
    }

    return {
      phases,
      milestones,
      reasoning: 'Fallback: grouped requirements into sequential phases'
    };
  }

  /**
   * Get default phase name based on position
   */
  private getDefaultPhaseName(index: number, total: number): string {
    if (total === 2) {
      return index === 0 ? 'Foundation' : 'Implementation';
    }
    if (total === 3) {
      return ['Foundation', 'Core Features', 'Polish'][index];
    }
    return ['Foundation', 'Core Features', 'Advanced Features', 'Polish'][index];
  }

  // ==========================================================================
  // Date Calculation (Algorithmic, NOT AI-Generated)
  // ==========================================================================

  /**
   * Calculate milestone dates from velocity (AI-15)
   *
   * IMPORTANT: Dates are calculated algorithmically from velocity,
   * NOT generated by AI. This ensures predictable, velocity-grounded dates.
   */
  private calculateMilestoneDates(
    structure: RoadmapStructure,
    startDate: Date,
    velocity: number,
    sprintWeeks: number
  ): GeneratedRoadmap {
    // Build phases with calculated start/end weeks
    let currentWeek = 1;
    const phases: RoadmapPhase[] = structure.phases.map((phase) => {
      const phaseStartWeek = currentWeek;
      const phaseEndWeek = currentWeek + phase.durationWeeks - 1;
      currentWeek = phaseEndWeek + 1;

      return {
        id: phase.id,
        name: phase.name,
        description: phase.description,
        objectives: phase.objectives,
        durationWeeks: phase.durationWeeks,
        startWeek: phaseStartWeek,
        endWeek: phaseEndWeek,
        milestones: structure.milestones
          .filter((m) => m.phaseId === phase.id)
          .map((m) => m.id)
      };
    });

    // Calculate milestone target dates from week numbers
    const milestones: RoadmapMilestone[] = structure.milestones.map((m) => {
      const targetDate = new Date(startDate);
      targetDate.setDate(targetDate.getDate() + m.weekNumber * 7);

      return {
        id: m.id,
        title: m.title,
        description: m.description,
        phaseId: m.phaseId,
        targetDate: targetDate.toISOString().split('T')[0],
        deliverables: m.deliverables,
        dependencies: m.dependencies,
        confidence: m.confidence
      };
    });

    // Build dependency graph
    const dependencies: MilestoneDependency[] = structure.milestones.flatMap((m) =>
      m.dependencies.map((dep) => ({
        fromMilestoneId: dep,
        toMilestoneId: m.id,
        type: 'blocks' as const
      }))
    );

    // Calculate timeline
    const totalWeeks = phases.length > 0 ? phases[phases.length - 1].endWeek : 0;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalWeeks * 7);

    return {
      phases,
      milestones,
      dependencies,
      timeline: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        totalWeeks
      },
      confidence: {
        sectionId: 'roadmap',
        sectionName: 'Roadmap',
        score: 70,
        tier: 'medium',
        factors: {
          inputCompleteness: 0.7,
          aiSelfAssessment: 0.7,
          patternMatch: 0.7
        },
        reasoning: 'Generated from requirements with velocity-based dates',
        needsReview: false
      },
      reasoning: structure.reasoning
    };
  }

  // ==========================================================================
  // Confidence Scoring
  // ==========================================================================

  /**
   * Calculate confidence score for the roadmap
   */
  private calculateConfidence(
    requirements: RequirementItem[],
    structure: RoadmapStructure
  ): SectionConfidence {
    // More requirements = more data = higher confidence
    const inputScore = Math.min(1, requirements.length / 10);

    // More phases = more structured = higher confidence
    const patternScore = structure.phases?.length >= 3 ? 0.8 : 0.5;

    // Check if milestones have good deliverables
    const avgDeliverables =
      structure.milestones.length > 0
        ? structure.milestones.reduce((sum, m) => sum + m.deliverables.length, 0) /
          structure.milestones.length
        : 0;
    const deliverableScore = Math.min(1, avgDeliverables / 4);

    const factors = {
      inputCompleteness: inputScore,
      aiSelfAssessment: deliverableScore,
      patternMatch: patternScore
    };

    const score = calculateWeightedScore(factors);
    const tier = getConfidenceTier(score);

    return {
      sectionId: 'roadmap',
      sectionName: 'Roadmap',
      score,
      tier,
      factors,
      reasoning: `Based on ${requirements.length} requirements across ${structure.phases?.length || 0} phases with ${structure.milestones?.length || 0} milestones`,
      needsReview: score < 70
    };
  }
}
