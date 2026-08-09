import { generateObject } from 'ai';
import { z } from 'zod';
import { AIServiceFactory } from '../ai/AIServiceFactory.js';
import { type ILogger, Logger } from '../../infrastructure/logger';
import {
  TaskPriority,
  type TaskComplexity,
  type PRDDocument
} from '../../domain/ai-types.js';
import {
  FEATURE_PROMPT_CONFIGS,
  formatFeaturePrompt
} from '../ai/prompts/FeatureAdditionPrompts.js';
import { safeCall } from '../utils/safeCall';

/**
 * AI-powered analysis of feature requests.
 *
 * Extracted from FeatureManagementService (SRP decomposition).
 * Responsibility: analyze incoming feature ideas, produce recommendation,
 * priority, complexity, risks, and dependencies.
 */
export class FeatureAnalysisService {
  private readonly aiFactory: AIServiceFactory;
  private readonly logger: ILogger;

  /**
   * @param aiFactory - AI service factory for model access. When omitted (DI mode),
   *   defaults to the global singleton via `AIServiceFactory.getInstance()`.
   * @param logger - Logger instance for diagnostics. When omitted, defaults to
   *   the global singleton via `Logger.getInstance()`.
   */
  constructor(aiFactory?: AIServiceFactory, logger?: ILogger) {
    this.aiFactory = aiFactory ?? AIServiceFactory.getInstance();
    this.logger = logger ?? Logger.getInstance();
  }

  /**
   * Analyze a new feature request using AI.
   */
  async analyzeFeatureRequest(params: {
    featureIdea: string;
    description: string;
    existingPRD?: PRDDocument;
    projectState?: any;
    businessJustification?: string;
    targetUsers?: string[];
    requestedBy: string;
  }): Promise<{
    analysis: string;
    recommendation: 'approve' | 'reject' | 'modify';
    priority: TaskPriority;
    complexity: TaskComplexity;
    estimatedEffort: number;
    risks: string[];
    dependencies: string[];
  }> {
    const FeatureAnalysisSchema = z.object({
      analysis: z.string().describe('Full analysis text'),
      recommendation: z.enum(['approve', 'reject', 'modify']),
      priority: z.enum(['critical', 'high', 'medium', 'low']),
      complexity: z.number().min(1).max(10),
      estimatedEffort: z.number().positive().describe('Estimated effort in hours'),
      risks: z.array(z.string()),
      dependencies: z.array(z.string()),
    });

    return safeCall(async () => {
      const config = FEATURE_PROMPT_CONFIGS.analyzeRequest;
      const model = this.aiFactory.getMainModel() || this.aiFactory.getBestAvailableModel();

      if (!model) {
        this.logger.error('Feature analysis failed: AI service is not available');
        throw new Error('AI service is not available. Please configure at least one AI provider (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, or PERPLEXITY_API_KEY).');
      }

      const prompt = formatFeaturePrompt(config.userPrompt, {
        featureIdea: params.featureIdea,
        description: params.description,
        existingPRD: params.existingPRD ? JSON.stringify(params.existingPRD, null, 2) : 'No existing PRD provided',
        projectState: params.projectState ? JSON.stringify(params.projectState) : 'No project state provided',
        businessJustification: params.businessJustification || 'No business justification provided',
        targetUsers: params.targetUsers?.join(', ') || 'General users'
      });

      const result = await generateObject({
        model,
        system: config.systemPrompt,
        prompt,
        schema: FeatureAnalysisSchema,
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature
      });

      return {
        analysis: result.object.analysis,
        recommendation: result.object.recommendation,
        priority: this.mapPriority(result.object.priority),
        complexity: result.object.complexity as TaskComplexity,
        estimatedEffort: result.object.estimatedEffort,
        risks: result.object.risks,
        dependencies: result.object.dependencies,
      };
    });
  }

  /**
   * Map a priority string from the AI schema to TaskPriority enum.
   */
  private mapPriority(priority: string): TaskPriority {
    const map: Record<string, TaskPriority> = {
      critical: TaskPriority.CRITICAL,
      high: TaskPriority.HIGH,
      medium: TaskPriority.MEDIUM,
      low: TaskPriority.LOW,
    };
    return map[priority] ?? TaskPriority.MEDIUM;
  }

  // ---------------------------------------------------------------------------
  // Extraction helpers
  // ---------------------------------------------------------------------------

  extractRecommendation(analysis: string): 'approve' | 'reject' | 'modify' {
    if (analysis.toLowerCase().includes('approve')) return 'approve';
    if (analysis.toLowerCase().includes('reject')) return 'reject';
    return 'modify';
  }

  extractPriority(analysis: string): TaskPriority {
    if (analysis.toLowerCase().includes('critical')) return TaskPriority.CRITICAL;
    if (analysis.toLowerCase().includes('high')) return TaskPriority.HIGH;
    if (analysis.toLowerCase().includes('low')) return TaskPriority.LOW;
    return TaskPriority.MEDIUM;
  }

  extractComplexity(analysis: string): TaskComplexity {
    const match = analysis.match(/complexity.*?(\d+)/i);
    if (match) {
      const complexity = parseInt(match[1], 10);
      return Math.min(Math.max(complexity, 1), 10) as TaskComplexity;
    }
    return 5;
  }

  extractRisks(analysis: string): string[] {
    const riskPatterns = /(?:risk|concern|challenge|potential issue|caveat|danger|threat)s?[:\-]?\s*([^.\n]+)/gi;
    const risks: string[] = [];
    let match;
    while ((match = riskPatterns.exec(analysis)) !== null) {
      const risk = match[1].trim();
      if (risk.length > 5 && risk.length < 200) risks.push(risk);
    }
    // Fall back to section extraction: look for "Risks:" or "Risk Factors:" sections
    if (risks.length === 0) {
      const sectionMatch = analysis.match(/(?:risks?|risk factors?)[:\s]*\n([\s\S]*?)(?:\n\n|$)/i);
      if (sectionMatch) {
        const lines = sectionMatch[1].split('\n').map(l => l.replace(/^[-*•\d.]+\s*/, '').trim()).filter(l => l.length > 5);
        risks.push(...lines);
      }
    }
    return risks.length > 0 ? risks : ['Technical complexity', 'Integration challenges', 'Resource constraints'];
  }

  extractDependencies(analysis: string): string[] {
    const depPatterns = /(?:depend(?:s|ency|encies)|requires?|prerequisite|blocked by|needs)[:\-]?\s*([^.\n]+)/gi;
    const deps: string[] = [];
    let match;
    while ((match = depPatterns.exec(analysis)) !== null) {
      const dep = match[1].trim();
      if (dep.length > 3 && dep.length < 200) deps.push(dep);
    }
    if (deps.length === 0) {
      const sectionMatch = analysis.match(/(?:dependenc(?:y|ies)|prerequisites?)[:\s]*\n([\s\S]*?)(?:\n\n|$)/i);
      if (sectionMatch) {
        const lines = sectionMatch[1].split('\n').map(l => l.replace(/^[-*•\d.]+\s*/, '').trim()).filter(l => l.length > 3);
        deps.push(...lines);
      }
    }
    return deps;
  }
}
