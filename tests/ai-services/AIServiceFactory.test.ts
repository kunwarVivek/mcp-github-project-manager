import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Set up environment variables before importing the factory
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-anthropic-key-12345';
process.env.OPENAI_API_KEY = 'sk-test-openai-key-12345';
process.env.GOOGLE_API_KEY = 'test-google-key-12345';
process.env.PERPLEXITY_API_KEY = 'pplx-test-perplexity-key-12345';
process.env.AI_MAIN_MODEL = 'claude-3-5-sonnet-20241022';
process.env.AI_RESEARCH_MODEL = 'perplexity-llama-3.1-sonar-large-128k-online';
process.env.AI_FALLBACK_MODEL = 'gpt-4o';
process.env.AI_PRD_MODEL = 'claude-3-5-sonnet-20241022';

import { AIServiceFactory } from '../../src/services/ai/AIServiceFactory';

describe('AIServiceFactory', () => {
  let factory: AIServiceFactory;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();

    // Save original environment
    originalEnv = { ...process.env };

    // Set test environment variables with non-empty values
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-anthropic-key-12345';
    process.env.OPENAI_API_KEY = 'sk-test-openai-key-12345';
    process.env.GOOGLE_API_KEY = 'test-google-key-12345';
    process.env.PERPLEXITY_API_KEY = 'pplx-test-perplexity-key-12345';
    process.env.AI_MAIN_MODEL = 'claude-3-5-sonnet-20241022';
    process.env.AI_RESEARCH_MODEL = 'perplexity-llama-3.1-sonar-large-128k-online';
    process.env.AI_FALLBACK_MODEL = 'gpt-4o';
    process.env.AI_PRD_MODEL = 'claude-3-5-sonnet-20241022';

    // Reset singleton instance
    (AIServiceFactory as any).instance = undefined;
    factory = AIServiceFactory.getInstance();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // Reset singleton instance
    (AIServiceFactory as any).instance = undefined;
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const factory1 = AIServiceFactory.getInstance();
      const factory2 = AIServiceFactory.getInstance();

      expect(factory1).toBe(factory2);
    });
  });

  describe('model configuration', () => {
    it('should parse anthropic model correctly', () => {
      const config = factory.getConfiguration();

      expect(config.main).toBeDefined();
      expect(config.main?.provider).toBe('anthropic');
      expect(config.main?.model).toBe('claude-3-5-sonnet-20241022');
      expect(config.main?.apiKey).toBe('sk-ant-test-anthropic-key-12345');
    });

    it('should parse openai model correctly', () => {
      const config = factory.getConfiguration();

      expect(config.fallback).toBeDefined();
      expect(config.fallback?.provider).toBe('openai');
      expect(config.fallback?.model).toBe('gpt-4o');
      expect(config.fallback?.apiKey).toBe('sk-test-openai-key-12345');
    });

    it('should parse perplexity model correctly', () => {
      const config = factory.getConfiguration();

      expect(config.research).toBeDefined();
      expect(config.research?.provider).toBe('perplexity');
      expect(config.research?.model).toBe('perplexity-llama-3.1-sonar-large-128k-online');
      expect(config.research?.apiKey).toBe('pplx-test-perplexity-key-12345');
    });
  });

  describe('model instances', () => {
    it('should return main model instance', () => {
      const model = factory.getMainModel();
      expect(model).toBeDefined();
      expect(model?.modelId).toBe('claude-3-5-sonnet-20241022');
    });

    it('should return research model instance', () => {
      const model = factory.getResearchModel();
      expect(model).toBeDefined();
      expect(model?.modelId).toBe('perplexity-llama-3.1-sonar-large-128k-online');
    });

    it('should return fallback model instance', () => {
      const model = factory.getFallbackModel();
      expect(model).toBeDefined();
      expect(model?.modelId).toBe('gpt-4o');
    });

    it('should return PRD model instance', () => {
      const model = factory.getPRDModel();
      expect(model).toBeDefined();
      expect(model?.modelId).toBe('claude-3-5-sonnet-20241022');
    });
  });

  describe('configuration validation', () => {
    it('should validate complete configuration', () => {
      const validation = factory.validateConfiguration();

      expect(validation.hasAnyProvider).toBe(true);
      expect(validation.missing).toHaveLength(0);
      expect(validation.available.length).toBeGreaterThan(0);
      expect(validation.availableModels).toContain('main');
    });

    it('should have all providers available in test environment', () => {
      // In test environment, all API keys are set, so all providers should be available
      const validation = factory.validateConfiguration();

      expect(validation.hasAnyProvider).toBe(true);
      expect(validation.available).toContain('anthropic');
      expect(validation.available).toContain('openai');
      expect(validation.available).toContain('google');
      expect(validation.available).toContain('perplexity');
      expect(validation.missing).toHaveLength(0);
      expect(validation.availableModels).toContain('main');
      expect(validation.availableModels).toContain('fallback');
      expect(validation.availableModels).toContain('research');
      expect(validation.availableModels).toContain('prd');
    });
  });
});
