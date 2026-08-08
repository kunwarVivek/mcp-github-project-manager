import { generateText } from 'ai';
import { AIServiceFactory } from '../ai/AIServiceFactory.js';
import { ILogger, Logger } from '../../infrastructure/logger';
import {
  TaskPriority,
  TaskComplexity,
  PRDDocument
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

      const result = await generateText({
        model,
        system: config.systemPrompt,
        prompt,
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature
      });

      const analysis = result.text;

      return {
        analysis,
        recommendation: this.extractRecommendation(analysis),
        priority: this.extractPriority(analysis),
        complexity: this.extractComplexity(analysis),
        estimatedEffort: this.extractComplexity(analysis) * 8,
        risks: this.extractRisks(analysis),
        dependencies: this.extractDependencies(analysis)
      };
    });
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
      const complexity = parseInt(match[1]);
      return Math.min(Math.max(complexity, 1), 10) as TaskComplexity;
    }
    return 5;
  }

  extractRisks(analysis: string): string[] {
    return ['Technical complexity', 'Integration challenges', 'Resource constraints'];
  }

  extractDependencies(analysis: string): string[] {
    return [];
  }
}
