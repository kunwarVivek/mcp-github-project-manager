import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { perplexity } from '@ai-sdk/perplexity';
import { LanguageModel } from 'ai';
import {
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  GOOGLE_API_KEY,
  PERPLEXITY_API_KEY,
  AI_MAIN_MODEL,
  AI_RESEARCH_MODEL,
  AI_FALLBACK_MODEL,
  AI_PRD_MODEL
} from '../../env';

/**
 * AI Provider Types
 */
export type AIProvider = 'anthropic' | 'openai' | 'google' | 'perplexity';

/**
 * AI Model Configuration
 */
export interface AIModelConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

/**
 * AI Service Configuration
 */
export interface AIServiceConfig {
  main: AIModelConfig | null;
  research: AIModelConfig | null;
  fallback: AIModelConfig | null;
  prd: AIModelConfig | null;
}

/**
 * Factory for creating AI service instances with Vercel AI SDK
 */
export class AIServiceFactory {
  private static instance: AIServiceFactory;
  private config: AIServiceConfig;

  private constructor() {
    this.config = this.buildConfiguration();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AIServiceFactory {
    if (!AIServiceFactory.instance) {
      AIServiceFactory.instance = new AIServiceFactory();
    }
    return AIServiceFactory.instance;
  }

  /**
   * Build AI service configuration from environment variables
   */
  private buildConfiguration(): AIServiceConfig {
    return {
      main: this.parseModelConfig(AI_MAIN_MODEL),
      research: this.parseModelConfig(AI_RESEARCH_MODEL),
      fallback: this.parseModelConfig(AI_FALLBACK_MODEL),
      prd: this.parseModelConfig(AI_PRD_MODEL)
    };
  }

  /**
   * Parse model configuration from model string
   */
  private parseModelConfig(modelString: string): AIModelConfig | null {
    // Extract provider from model name
    let provider: AIProvider;
    let model: string;
    let apiKey: string;

    if (modelString.startsWith('claude-')) {
      provider = 'anthropic';
      model = modelString;
      apiKey = ANTHROPIC_API_KEY;
    } else if (modelString.startsWith('gpt-') || modelString.startsWith('o1')) {
      provider = 'openai';
      model = modelString;
      apiKey = OPENAI_API_KEY;
    } else if (modelString.startsWith('gemini-')) {
      provider = 'google';
      model = modelString;
      apiKey = GOOGLE_API_KEY;
    } else if (modelString.includes('perplexity') || modelString.includes('llama') || modelString.includes('sonar')) {
      provider = 'perplexity';
      model = modelString;
      apiKey = PERPLEXITY_API_KEY;
    } else {
      // Default to anthropic for unknown models
      provider = 'anthropic';
      model = 'claude-3-5-sonnet-20241022';
      apiKey = ANTHROPIC_API_KEY;
    }

    if (!apiKey) {
      process.stderr.write(`⚠️  AI Provider Warning: No API key found for ${provider} provider. AI features using this provider will be disabled.\n`);
      return null;
    }

    return { provider, model, apiKey };
  }

  /**
   * Get AI model instance for specific use case
   */
  public getModel(type: 'main' | 'research' | 'fallback' | 'prd'): LanguageModel | null {
    const config = this.config[type];

    if (!config) {
      process.stderr.write(`⚠️  AI Model Warning: ${type} model is not available due to missing API key.\n`);
      return null;
    }

    switch (config.provider) {
      case 'anthropic':
        return anthropic(config.model);

      case 'openai':
        return openai(config.model);

      case 'google':
        return google(config.model);

      case 'perplexity':
        return perplexity(config.model);

      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  /**
   * Get main AI model (for general task generation)
   */
  public getMainModel(): LanguageModel | null {
    return this.getModel('main');
  }

  /**
   * Get research AI model (for enhanced analysis)
   */
  public getResearchModel(): LanguageModel | null {
    return this.getModel('research');
  }

  /**
   * Get fallback AI model (when main model fails)
   */
  public getFallbackModel(): LanguageModel | null {
    return this.getModel('fallback');
  }

  /**
   * Get PRD AI model (for PRD generation)
   */
  public getPRDModel(): LanguageModel | null {
    return this.getModel('prd');
  }

  /**
   * Get the best available model with fallback logic
   * Tries models in order of preference: main -> fallback -> any available
   */
  public getBestAvailableModel(): LanguageModel | null {
    // Try main model first
    const mainModel = this.getMainModel();
    if (mainModel) return mainModel;

    // Try fallback model
    const fallbackModel = this.getFallbackModel();
    if (fallbackModel) return fallbackModel;

    // Try PRD model
    const prdModel = this.getPRDModel();
    if (prdModel) return prdModel;

    // Try research model
    const researchModel = this.getResearchModel();
    if (researchModel) return researchModel;

    // No models available
    return null;
  }

  /**
   * Check if any AI functionality is available
   */
  public isAIAvailable(): boolean {
    return this.getBestAvailableModel() !== null;
  }

  /**
   * Get configuration for debugging
   */
  public getConfiguration(): AIServiceConfig {
    return { ...this.config };
  }

  /**
   * Check AI provider availability and configuration status
   */
  public validateConfiguration(): {
    hasAnyProvider: boolean;
    available: string[];
    missing: string[];
    availableModels: string[];
    unavailableModels: string[];
  } {
    const missing: string[] = [];
    const available: string[] = [];
    const availableModels: string[] = [];
    const unavailableModels: string[] = [];

    // Check each provider
    if (!ANTHROPIC_API_KEY) {
      missing.push('ANTHROPIC_API_KEY');
    } else {
      available.push('anthropic');
    }

    if (!OPENAI_API_KEY) {
      missing.push('OPENAI_API_KEY');
    } else {
      available.push('openai');
    }

    if (!GOOGLE_API_KEY) {
      missing.push('GOOGLE_API_KEY');
    } else {
      available.push('google');
    }

    if (!PERPLEXITY_API_KEY) {
      missing.push('PERPLEXITY_API_KEY');
    } else {
      available.push('perplexity');
    }

    // Check which models are available
    if (this.config.main) availableModels.push('main'); else unavailableModels.push('main');
    if (this.config.research) availableModels.push('research'); else unavailableModels.push('research');
    if (this.config.fallback) availableModels.push('fallback'); else unavailableModels.push('fallback');
    if (this.config.prd) availableModels.push('prd'); else unavailableModels.push('prd');

    return {
      hasAnyProvider: available.length > 0,
      available,
      missing,
      availableModels,
      unavailableModels
    };
  }

  /**
   * Test connection to AI providers
   */
  public async testConnections(): Promise<{ [key in AIProvider]: boolean }> {
    const results: { [key in AIProvider]: boolean } = {
      anthropic: false,
      openai: false,
      google: false,
      perplexity: false
    };

    // Test each provider if API key is available
    if (ANTHROPIC_API_KEY) {
      try {
        const model = this.getModel('main');
        if (model) {
          // Simple test generation using generateText from ai package
          const { generateText } = await import('ai');
          await generateText({
            model,
            prompt: 'Test connection',
            maxTokens: 10
          });
          results.anthropic = true;
        }        } catch (error) {
        process.stderr.write(`Anthropic connection test failed: ${error}\n`);
      }
    }

    // Add similar tests for other providers as needed

    return results;
  }
}
