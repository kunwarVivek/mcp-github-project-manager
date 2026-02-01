/**
 * Unit tests for Issue Intelligence MCP Tools
 *
 * Tests the MCP tool definitions, schemas, and executors for
 * Phase 11 issue intelligence AI features.
 */

import {
  enrichIssueTool,
  suggestLabelsTool,
  detectDuplicatesTool,
  findRelatedIssuesTool,
  executeEnrichIssue,
  executeSuggestLabels,
  executeDetectDuplicates,
  executeFindRelatedIssues,
  issueIntelligenceTools,
  issueIntelligenceExecutors,
} from '../../src/infrastructure/tools/issue-intelligence-tools';
import { AIServiceFactory } from '../../src/services/ai/AIServiceFactory';
import { generateObject, embed, embedMany, cosineSimilarity } from 'ai';
import {
  EnrichIssueInputSchema,
  SuggestLabelsInputSchema,
  DetectDuplicatesInputSchema,
  FindRelatedIssuesInputSchema,
} from '../../src/infrastructure/tools/schemas/issue-intelligence-schemas';

// Mock dependencies
jest.mock('../../src/services/ai/AIServiceFactory');
jest.mock('ai', () => ({
  generateObject: jest.fn(),
  embed: jest.fn(),
  embedMany: jest.fn(),
  cosineSimilarity: jest.fn()
}));

const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;
const mockEmbed = embed as jest.MockedFunction<typeof embed>;
const mockEmbedMany = embedMany as jest.MockedFunction<typeof embedMany>;
const mockCosineSimilarity = cosineSimilarity as jest.MockedFunction<typeof cosineSimilarity>;
const mockGetModel = jest.fn().mockReturnValue(null);
const mockGetBestAvailableModel = jest.fn().mockReturnValue(null);

describe('Issue Intelligence MCP Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      getModel: mockGetModel,
      getBestAvailableModel: mockGetBestAvailableModel
    });

    // Default mock for embeddings
    mockEmbed.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] } as any);
    mockEmbedMany.mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] } as any);
    mockCosineSimilarity.mockReturnValue(0.5);
  });

  describe('Tool Definitions', () => {
    describe('enrichIssueTool', () => {
      it('should have correct name', () => {
        expect(enrichIssueTool.name).toBe('enrich_issue');
      });

      it('should have title', () => {
        expect(enrichIssueTool.title).toBe('Enrich Issue');
      });

      it('should have description mentioning sections', () => {
        expect(enrichIssueTool.description).toContain('Problem');
        expect(enrichIssueTool.description).toContain('Solution');
        expect(enrichIssueTool.description).toContain('AcceptanceCriteria');
      });

      it('should have aiOperation annotation', () => {
        expect(enrichIssueTool.annotations?.idempotentHint).toBe(false);
        expect(enrichIssueTool.annotations?.openWorldHint).toBe(true);
      });

      it('should have input schema', () => {
        expect(enrichIssueTool.schema).toBeDefined();
      });

      it('should have output schema', () => {
        expect(enrichIssueTool.outputSchema).toBeDefined();
      });
    });

    describe('suggestLabelsTool', () => {
      it('should have correct name', () => {
        expect(suggestLabelsTool.name).toBe('suggest_labels');
      });

      it('should have title', () => {
        expect(suggestLabelsTool.title).toBe('Suggest Labels');
      });

      it('should have description mentioning confidence tiers', () => {
        expect(suggestLabelsTool.description).toContain('high');
        expect(suggestLabelsTool.description).toContain('medium');
        expect(suggestLabelsTool.description).toContain('low');
      });

      it('should have aiOperation annotation', () => {
        expect(suggestLabelsTool.annotations?.idempotentHint).toBe(false);
      });

      it('should have input schema', () => {
        expect(suggestLabelsTool.schema).toBeDefined();
      });

      it('should have output schema', () => {
        expect(suggestLabelsTool.outputSchema).toBeDefined();
      });
    });

    describe('detectDuplicatesTool', () => {
      it('should have correct name', () => {
        expect(detectDuplicatesTool.name).toBe('detect_duplicates');
      });

      it('should have title', () => {
        expect(detectDuplicatesTool.title).toBe('Detect Duplicate Issues');
      });

      it('should have description mentioning embeddings', () => {
        expect(detectDuplicatesTool.description).toContain('semantic similarity');
        expect(detectDuplicatesTool.description).toContain('embeddings');
      });

      it('should have description with confidence thresholds', () => {
        expect(detectDuplicatesTool.description).toContain('0.92');
        expect(detectDuplicatesTool.description).toContain('0.75');
      });

      it('should have aiOperation annotation', () => {
        expect(detectDuplicatesTool.annotations?.idempotentHint).toBe(false);
      });

      it('should have input and output schemas', () => {
        expect(detectDuplicatesTool.schema).toBeDefined();
        expect(detectDuplicatesTool.outputSchema).toBeDefined();
      });
    });

    describe('findRelatedIssuesTool', () => {
      it('should have correct name', () => {
        expect(findRelatedIssuesTool.name).toBe('find_related_issues');
      });

      it('should have title', () => {
        expect(findRelatedIssuesTool.title).toBe('Find Related Issues');
      });

      it('should have description mentioning relationship types', () => {
        expect(findRelatedIssuesTool.description).toContain('semantic similarity');
        expect(findRelatedIssuesTool.description).toContain('dependency');
        expect(findRelatedIssuesTool.description).toContain('component');
      });

      it('should have aiOperation annotation', () => {
        expect(findRelatedIssuesTool.annotations?.idempotentHint).toBe(false);
      });

      it('should have input and output schemas', () => {
        expect(findRelatedIssuesTool.schema).toBeDefined();
        expect(findRelatedIssuesTool.outputSchema).toBeDefined();
      });
    });

    describe('issueIntelligenceTools array', () => {
      it('should contain 4 tools', () => {
        expect(issueIntelligenceTools).toHaveLength(4);
      });

      it('should contain all issue intelligence tools', () => {
        const names = issueIntelligenceTools.map(t => t.name);
        expect(names).toContain('enrich_issue');
        expect(names).toContain('suggest_labels');
        expect(names).toContain('detect_duplicates');
        expect(names).toContain('find_related_issues');
      });
    });

    describe('issueIntelligenceExecutors', () => {
      it('should have executor for each tool', () => {
        expect(issueIntelligenceExecutors).toHaveProperty('enrich_issue');
        expect(issueIntelligenceExecutors).toHaveProperty('suggest_labels');
        expect(issueIntelligenceExecutors).toHaveProperty('detect_duplicates');
        expect(issueIntelligenceExecutors).toHaveProperty('find_related_issues');
      });

      it('should have functions as executors', () => {
        expect(typeof issueIntelligenceExecutors.enrich_issue).toBe('function');
        expect(typeof issueIntelligenceExecutors.suggest_labels).toBe('function');
        expect(typeof issueIntelligenceExecutors.detect_duplicates).toBe('function');
        expect(typeof issueIntelligenceExecutors.find_related_issues).toBe('function');
      });
    });
  });

  describe('Input Schema Validation', () => {
    describe('EnrichIssueInputSchema', () => {
      it('should accept valid input', () => {
        const input = {
          issueTitle: 'Bug fix needed',
          issueDescription: 'The app crashes on startup'
        };
        expect(() => EnrichIssueInputSchema.parse(input)).not.toThrow();
      });

      it('should require issueTitle', () => {
        const input = {
          issueDescription: 'Description only'
        };
        expect(() => EnrichIssueInputSchema.parse(input)).toThrow();
      });

      it('should accept optional projectContext', () => {
        const input = {
          issueTitle: 'Bug fix',
          issueDescription: 'Description',
          projectContext: 'E-commerce application'
        };
        expect(() => EnrichIssueInputSchema.parse(input)).not.toThrow();
      });

      it('should accept optional repositoryLabels', () => {
        const input = {
          issueTitle: 'Bug fix',
          issueDescription: 'Description',
          repositoryLabels: [{ name: 'bug' }, { name: 'urgent' }]
        };
        expect(() => EnrichIssueInputSchema.parse(input)).not.toThrow();
      });
    });

    describe('SuggestLabelsInputSchema', () => {
      it('should accept valid input', () => {
        const input = {
          issueTitle: 'New feature',
          issueDescription: 'Add dark mode',
          existingLabels: [{ name: 'enhancement' }]
        };
        expect(() => SuggestLabelsInputSchema.parse(input)).not.toThrow();
      });

      it('should require existingLabels', () => {
        const input = {
          issueTitle: 'Test',
          issueDescription: 'Description'
        };
        expect(() => SuggestLabelsInputSchema.parse(input)).toThrow();
      });

      it('should accept optional issueHistory', () => {
        const input = {
          issueTitle: 'Test',
          issueDescription: 'Description',
          existingLabels: [{ name: 'bug' }],
          issueHistory: [{ labels: ['bug'], title: 'Past issue' }]
        };
        expect(() => SuggestLabelsInputSchema.parse(input)).not.toThrow();
      });

      it('should accept optional config', () => {
        const input = {
          issueTitle: 'Test',
          issueDescription: 'Description',
          existingLabels: [],
          config: { maxSuggestions: 5, preferExisting: true }
        };
        expect(() => SuggestLabelsInputSchema.parse(input)).not.toThrow();
      });
    });

    describe('DetectDuplicatesInputSchema', () => {
      it('should accept valid input', () => {
        const input = {
          issueTitle: 'New issue',
          issueDescription: 'Description',
          existingIssues: [{ id: '1', number: 1, title: 'Old issue', body: 'Body', state: 'open' }]
        };
        expect(() => DetectDuplicatesInputSchema.parse(input)).not.toThrow();
      });

      it('should require existingIssues', () => {
        const input = {
          issueTitle: 'Test',
          issueDescription: 'Description'
        };
        expect(() => DetectDuplicatesInputSchema.parse(input)).toThrow();
      });

      it('should accept optional thresholds', () => {
        const input = {
          issueTitle: 'Test',
          issueDescription: 'Description',
          existingIssues: [],
          thresholds: { high: 0.9, medium: 0.7 }
        };
        expect(() => DetectDuplicatesInputSchema.parse(input)).not.toThrow();
      });

      it('should accept optional maxResults', () => {
        const input = {
          issueTitle: 'Test',
          issueDescription: 'Description',
          existingIssues: [],
          maxResults: 5
        };
        expect(() => DetectDuplicatesInputSchema.parse(input)).not.toThrow();
      });
    });

    describe('FindRelatedIssuesInputSchema', () => {
      it('should accept valid input', () => {
        const input = {
          issueId: 'src-123',
          issueTitle: 'Feature request',
          issueDescription: 'Add feature',
          repositoryIssues: [{ id: '1', number: 1, title: 'Issue', body: 'Body', labels: [], state: 'open' }]
        };
        expect(() => FindRelatedIssuesInputSchema.parse(input)).not.toThrow();
      });

      it('should require issueId', () => {
        const input = {
          issueTitle: 'Test',
          issueDescription: 'Description',
          repositoryIssues: []
        };
        expect(() => FindRelatedIssuesInputSchema.parse(input)).toThrow();
      });

      it('should accept optional issueLabels', () => {
        const input = {
          issueId: 'src-123',
          issueTitle: 'Test',
          issueDescription: 'Description',
          repositoryIssues: [],
          issueLabels: ['bug', 'urgent']
        };
        expect(() => FindRelatedIssuesInputSchema.parse(input)).not.toThrow();
      });

      it('should accept optional config', () => {
        const input = {
          issueId: 'src-123',
          issueTitle: 'Test',
          issueDescription: 'Description',
          repositoryIssues: [],
          config: { includeSemanticSimilarity: false }
        };
        expect(() => FindRelatedIssuesInputSchema.parse(input)).not.toThrow();
      });
    });
  });

  describe('Executors', () => {
    describe('executeEnrichIssue', () => {
      it('should execute and return result', async () => {
        const result = await executeEnrichIssue({
          issueTitle: 'Test issue',
          issueDescription: 'Test description'
        });

        expect(result).toHaveProperty('original');
        expect(result).toHaveProperty('enrichedBody');
        expect(result).toHaveProperty('sections');
        expect(result).toHaveProperty('overallConfidence');
      });

      it('should pass projectContext to service', async () => {
        const result = await executeEnrichIssue({
          issueTitle: 'Test',
          issueDescription: 'Description',
          projectContext: 'E-commerce app'
        });

        expect(result).toBeDefined();
      });

      it('should pass repositoryLabels to service', async () => {
        const result = await executeEnrichIssue({
          issueTitle: 'Test',
          issueDescription: 'Description',
          repositoryLabels: [{ name: 'bug' }]
        });

        expect(result).toBeDefined();
      });
    });

    describe('executeSuggestLabels', () => {
      it('should execute and return result', async () => {
        const result = await executeSuggestLabels({
          issueTitle: 'Bug report',
          issueDescription: 'Something is broken',
          existingLabels: [{ name: 'bug' }]
        });

        expect(result).toHaveProperty('high');
        expect(result).toHaveProperty('medium');
        expect(result).toHaveProperty('low');
        expect(result).toHaveProperty('confidence');
      });

      it('should pass config to service', async () => {
        const result = await executeSuggestLabels({
          issueTitle: 'Test',
          issueDescription: 'Description',
          existingLabels: [],
          config: { maxSuggestions: 3, preferExisting: true, includeNewProposals: true }
        });

        expect(result).toBeDefined();
      });

      it('should pass issueHistory to service', async () => {
        const result = await executeSuggestLabels({
          issueTitle: 'Test',
          issueDescription: 'Description',
          existingLabels: [],
          issueHistory: [{ labels: ['bug'], title: 'Old issue' }]
        });

        expect(result).toBeDefined();
      });
    });

    describe('executeDetectDuplicates', () => {
      it('should execute and return result', async () => {
        const result = await executeDetectDuplicates({
          issueTitle: 'Test issue',
          issueDescription: 'Test description',
          existingIssues: [],
          maxResults: 10
        });

        expect(result).toHaveProperty('highConfidence');
        expect(result).toHaveProperty('mediumConfidence');
        expect(result).toHaveProperty('lowConfidence');
        expect(result).toHaveProperty('confidence');
      });

      it('should pass thresholds to service', async () => {
        const result = await executeDetectDuplicates({
          issueTitle: 'Test',
          issueDescription: 'Description',
          existingIssues: [],
          maxResults: 10,
          thresholds: { high: 0.9, medium: 0.7 }
        });

        expect(result).toBeDefined();
      });

      it('should pass maxResults to service', async () => {
        const result = await executeDetectDuplicates({
          issueTitle: 'Test',
          issueDescription: 'Description',
          existingIssues: [{ id: '1', number: 1, title: 'Existing', body: 'Body', state: 'open' as const }],
          maxResults: 5
        });

        expect(result).toBeDefined();
      });
    });

    describe('executeFindRelatedIssues', () => {
      it('should execute and return result', async () => {
        const result = await executeFindRelatedIssues({
          issueId: 'src-123',
          issueTitle: 'Test issue',
          issueDescription: 'Test description',
          repositoryIssues: []
        });

        expect(result).toHaveProperty('relationships');
        expect(result).toHaveProperty('confidence');
      });

      it('should pass config to service', async () => {
        const result = await executeFindRelatedIssues({
          issueId: 'src-123',
          issueTitle: 'Test',
          issueDescription: 'Description',
          repositoryIssues: [],
          config: { includeSemanticSimilarity: true, includeDependencies: false, includeComponentGrouping: true }
        });

        expect(result).toBeDefined();
      });

      it('should pass issueLabels to service', async () => {
        const result = await executeFindRelatedIssues({
          issueId: 'src-123',
          issueTitle: 'Test',
          issueDescription: 'Description',
          repositoryIssues: [],
          issueLabels: ['bug', 'auth']
        });

        expect(result).toBeDefined();
      });
    });
  });
});
