import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { perplexity } from '@ai-sdk/perplexity';
import {
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  GOOGLE_API_KEY,
  PERPLEXITY_API_KEY,
  AI_MAIN_MODEL,
  AI_RESEARCH_MODEL,
  AI_FALLBACK_MODEL,
  AI_PRD_MODEL
} from '../../env.js';

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
  main: AIModelConfig;
  research: AIModelConfig;
  fallback: AIModelConfig;
  prd: AIModelConfig;
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
  private parseModelConfig(modelString: string): AIModelConfig {
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
      throw new Error(`API key not found for ${provider} provider. Please set the corresponding environment variable.`);
    }

    return { provider, model, apiKey };
  }

  /**
   * Get AI model instance for specific use case
   */
  public getModel(type: 'main' | 'research' | 'fallback' | 'prd') {
    const config = this.config[type];

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
  public getMainModel() {
    return this.getModel('main');
  }

  /**
   * Get research AI model (for enhanced analysis)
   */
  public getResearchModel() {
    return this.getModel('research');
  }

  /**
   * Get fallback AI model (when main model fails)
   */
  public getFallbackModel() {
    return this.getModel('fallback');
  }

  /**
   * Get PRD AI model (for PRD generation)
   */
  public getPRDModel() {
    return this.getModel('prd');
  }

  /**
   * Get configuration for debugging
   */
  public getConfiguration(): AIServiceConfig {
    return { ...this.config };
  }

  /**
   * Check if all required API keys are available
   */
  public validateConfiguration(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    if (!ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY');
    if (!OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
    if (!GOOGLE_API_KEY) missing.push('GOOGLE_API_KEY');
    if (!PERPLEXITY_API_KEY) missing.push('PERPLEXITY_API_KEY');

    return {
      valid: missing.length === 0,
      missing
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
        // Simple test generation using generateText from ai package
        const { generateText } = await import('ai');
        await generateText({
          model,
          prompt: 'Test connection',
          maxTokens: 10
        });
        results.anthropic = true;
      } catch (error) {
        console.warn('Anthropic connection test failed:', error);
      }
    }

    // Add similar tests for other providers as needed

    return results;
  }
}
