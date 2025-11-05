import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { IssueEnrichmentService } from '../../src/services/IssueEnrichmentService';
import { AIServiceFactory } from '../../src/services/ai/AIServiceFactory';
import { ProjectManagementService } from '../../src/services/ProjectManagementService';

// Mock the AI service factory
jest.mock('../../src/services/ai/AIServiceFactory');

// Mock the ai package
jest.mock('ai', () => ({
  generateText: jest.fn(),
  generateObject: jest.fn()
}));

// Mock ProjectManagementService
jest.mock('../../src/services/ProjectManagementService');

describe('IssueEnrichmentService', () => {
  let service: IssueEnrichmentService;
  let mockAIService: any;
  let mockProjectService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock AI service - just needs to be a valid model object
    mockAIService = {
      modelId: 'test-model',
      provider: 'test-provider'
    };

    // Mock AIServiceFactory
    const mockFactory = {
      getMainModel: jest.fn().mockReturnValue(mockAIService),
      getFallbackModel: jest.fn().mockReturnValue(mockAIService),
      getModel: jest.fn().mockReturnValue(mockAIService),
      getBestAvailableModel: jest.fn().mockReturnValue(mockAIService),
      getPRDModel: jest.fn().mockReturnValue(mockAIService),
      getResearchModel: jest.fn().mockReturnValue(mockAIService)
    };

    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue(mockFactory);

    // Mock ProjectManagementService methods
    mockProjectService = {
      listProjectItems: jest.fn(),
      listMilestones: jest.fn(),
      updateProjectItem: jest.fn()
    };

    (ProjectManagementService as jest.Mock).mockImplementation(() => mockProjectService);

    service = new IssueEnrichmentService(AIServiceFactory.getInstance(), new ProjectManagementService('test-owner', 'test-repo', 'test-token'));
  });

  describe('enrichIssue', () => {
    it('should enrich a single issue with comprehensive metadata', async () => {
      const mockEnrichment = {
        suggestedLabels: ['bug', 'critical', 'authentication'],
        suggestedPriority: 'high',
        suggestedType: 'bug',
        complexity: 'moderate',
        estimatedEffort: '3-5 days',
        relatedIssues: ['#123', '#456'],
        milestone: 'v1.0',
        sprint: 'Sprint 3',
        reasoning: 'This is a critical authentication bug affecting user login'
      };

      mockProjectService.listMilestones.mockResolvedValue([
        { id: '1', title: 'v1.0', state: 'open' }
      ]);

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify(mockEnrichment)
      });

      const result = await service.enrichIssue({
        projectId: 'project-123',
        issueId: 'issue-456',
        issueTitle: 'Users cannot login',
        issueDescription: 'The login form is not working after recent changes',
        projectContext: 'This is a production web application'
      });

      expect(result.issueId).toBe('issue-456');
      expect(result.suggestedLabels).toContain('bug');
      expect(result.suggestedLabels).toContain('critical');
      expect(result.suggestedPriority).toBe('high');
      expect(result.suggestedType).toBe('bug');
      expect(result.complexity).toBe('moderate');
      expect(result.estimatedEffort).toBe('3-5 days');
      expect(result.relatedIssues).toHaveLength(2);
      expect(result.reasoning).toBeDefined();
      expect(generateText).toHaveBeenCalledTimes(1);
    });

    it('should handle feature requests differently than bugs', async () => {
      const mockFeatureEnrichment = {
        suggestedLabels: ['enhancement', 'feature', 'ui'],
        suggestedPriority: 'medium',
        suggestedType: 'feature',
        complexity: 'complex',
        estimatedEffort: '1-2 weeks',
        relatedIssues: [],
        reasoning: 'This is a new feature request requiring UI/UX work'
      };

      mockProjectService.listMilestones.mockResolvedValue([]);

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify(mockFeatureEnrichment)
      });

      const result = await service.enrichIssue({
        projectId: 'project-123',
        issueId: 'issue-789',
        issueTitle: 'Add dark mode support',
        issueDescription: 'Users want a dark theme option for the application'
      });

      expect(result.suggestedType).toBe('feature');
      expect(result.suggestedLabels).toContain('enhancement');
      expect(result.complexity).toBe('complex');
    });

    it('should suggest low priority for documentation tasks', async () => {
      const mockDocsEnrichment = {
        suggestedLabels: ['documentation', 'good-first-issue'],
        suggestedPriority: 'low',
        suggestedType: 'documentation',
        complexity: 'simple',
        estimatedEffort: '2-4 hours',
        relatedIssues: [],
        reasoning: 'Documentation update is straightforward'
      };

      mockProjectService.listMilestones.mockResolvedValue([]);

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify(mockDocsEnrichment)
      });

      const result = await service.enrichIssue({
        projectId: 'project-123',
        issueId: 'issue-doc',
        issueTitle: 'Update README with installation instructions',
        issueDescription: 'Add step-by-step installation guide to README'
      });

      expect(result.suggestedPriority).toBe('low');
      expect(result.suggestedType).toBe('documentation');
      expect(result.complexity).toBe('simple');
      expect(result.suggestedLabels).toContain('good-first-issue');
    });

    it('should identify critical issues correctly', async () => {
      const mockCriticalEnrichment = {
        suggestedLabels: ['bug', 'critical', 'security', 'urgent'],
        suggestedPriority: 'critical',
        suggestedType: 'bug',
        complexity: 'complex',
        estimatedEffort: '1-2 days',
        relatedIssues: [],
        reasoning: 'Security vulnerability needs immediate attention'
      };

      mockProjectService.listMilestones.mockResolvedValue([]);

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify(mockCriticalEnrichment)
      });

      const result = await service.enrichIssue({
        projectId: 'project-123',
        issueId: 'issue-sec',
        issueTitle: 'SQL injection vulnerability in search',
        issueDescription: 'User input is not properly sanitized'
      });

      expect(result.suggestedPriority).toBe('critical');
      expect(result.suggestedLabels).toContain('security');
      expect(result.suggestedLabels).toContain('urgent');
    });
  });

  describe('enrichIssues', () => {
    it('should enrich multiple issues in bulk', async () => {
      const mockIssues = {
        items: [
          {
            id: 'issue-1',
            number: 1,
            title: 'Bug in login',
            body: 'Users cannot login'
          },
          {
            id: 'issue-2',
            number: 2,
            title: 'Add new feature',
            body: 'Need dark mode'
          }
        ]
      };

      mockProjectService.listProjectItems.mockResolvedValue(mockIssues.items);
      mockProjectService.listMilestones.mockResolvedValue([]);

      const { generateText } = require('ai');
      generateText
        .mockResolvedValueOnce({
          text: JSON.stringify({
            suggestedLabels: ['bug'],
            suggestedPriority: 'high',
            suggestedType: 'bug',
            complexity: 'moderate',
            estimatedEffort: '2 days',
            relatedIssues: [],
            reasoning: 'Critical bug'
          })
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            suggestedLabels: ['feature'],
            suggestedPriority: 'medium',
            suggestedType: 'feature',
            complexity: 'complex',
            estimatedEffort: '1 week',
            relatedIssues: [],
            reasoning: 'New feature'
          })
        });

      const result = await service.enrichIssues({
        projectId: 'project-123',
        issueIds: ['issue-1', 'issue-2'],
        projectContext: 'Web application'
      });

      expect(result).toHaveLength(2);
      expect(result[0].suggestedType).toBe('bug');
      expect(result[1].suggestedType).toBe('feature');
      expect(generateText).toHaveBeenCalledTimes(2);
    });

    it('should filter issues by provided issueIds', async () => {
      const mockIssues = {
        items: [
          { id: 'issue-1', number: 1, title: 'Bug 1', body: 'Bug 1' },
          { id: 'issue-2', number: 2, title: 'Bug 2', body: 'Bug 2' },
          { id: 'issue-3', number: 3, title: 'Bug 3', body: 'Bug 3' }
        ]
      };

      mockProjectService.listProjectItems.mockResolvedValue(mockIssues.items);
      mockProjectService.listMilestones.mockResolvedValue([]);

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify({
          suggestedLabels: ['bug'],
          suggestedPriority: 'high',
          suggestedType: 'bug',
          complexity: 'simple',
          estimatedEffort: '1 day',
          relatedIssues: [],
          reasoning: 'Bug fix needed'
        })
      });

      const result = await service.enrichIssues({
        projectId: 'project-123',
        issueIds: ['issue-1', 'issue-3']
      });

      expect(result).toHaveLength(2);
      expect(result[0].issueId).toBe('issue-1');
      expect(result[1].issueId).toBe('issue-3');
    });

    it('should handle empty project gracefully', async () => {
      mockProjectService.listProjectItems.mockResolvedValue({ items: [] });

      const result = await service.enrichIssues({
        projectId: 'empty-project',
        issueIds: []
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('applyEnrichment', () => {
    it('should apply enrichment to issue when autoApply is true', async () => {
      const enrichment = {
        issueId: 'issue-123',
        suggestedLabels: ['bug', 'critical'],
        suggestedPriority: 'high',
        suggestedType: 'bug',
        complexity: 'moderate',
        estimatedEffort: '3 days',
        relatedIssues: [],
        reasoning: 'Critical bug requiring immediate attention'
      };

      mockProjectService.updateProjectItem.mockResolvedValue({
        success: true
      });

      const result = await service.applyEnrichment({
        projectId: 'project-123',
        issueNumber: 42,
        enrichment,
        applyLabels: true
      });

      expect(result.applied).toBeDefined();
      expect(Array.isArray(result.applied)).toBe(true);
    });

    it('should handle errors during enrichment application', async () => {
      const enrichment = {
        issueId: 'issue-123',
        suggestedLabels: ['bug'],
        suggestedPriority: 'high',
        suggestedType: 'bug',
        complexity: 'simple',
        estimatedEffort: '1 day',
        relatedIssues: [],
        reasoning: 'Test'
      };

      mockProjectService.updateProjectItem.mockRejectedValue(
        new Error('Failed to update issue')
      );

      await expect(
        service.applyEnrichment({
          projectId: 'project-123',
          issueNumber: 42,
          enrichment
        })
      ).rejects.toThrow('Failed to update issue');
    });
  });

  describe('error handling', () => {
    it('should throw error when AI service is unavailable', async () => {
      const mockFactory = AIServiceFactory.getInstance();
      (mockFactory.getModel as jest.Mock).mockReturnValue(null);
      (mockFactory.getBestAvailableModel as jest.Mock).mockReturnValue(null);

      mockProjectService.listMilestones.mockResolvedValue([]);

      await expect(
        service.enrichIssue({
          projectId: 'test',
          issueId: 'test',
          issueTitle: 'Test'
        })
      ).rejects.toThrow('AI service is not available');
    });

    it('should handle malformed AI responses', async () => {
      mockProjectService.listMilestones.mockResolvedValue([]);

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: 'This is not valid JSON'
      });

      await expect(
        service.enrichIssue({
          projectId: 'test',
          issueId: 'test',
          issueTitle: 'Test'
        })
      ).rejects.toThrow();
    });

    it('should handle AI generation errors', async () => {
      mockProjectService.listMilestones.mockResolvedValue([]);

      const { generateText } = require('ai');
      generateText.mockRejectedValue(new Error('AI model error'));

      await expect(
        service.enrichIssue({
          projectId: 'test',
          issueId: 'test',
          issueTitle: 'Test'
        })
      ).rejects.toThrow('AI model error');
    });
  });

  describe('context awareness', () => {
    it('should use project context in enrichment analysis', async () => {
      const mockEnrichment = {
        suggestedLabels: ['backend', 'api'],
        suggestedPriority: 'high',
        suggestedType: 'bug',
        complexity: 'moderate',
        estimatedEffort: '2 days',
        relatedIssues: [],
        reasoning: 'Backend API issue'
      };

      mockProjectService.listMilestones.mockResolvedValue([]);

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify(mockEnrichment)
      });

      await service.enrichIssue({
        projectId: 'project-123',
        issueId: 'issue-api',
        issueTitle: 'API endpoint returning 500 error',
        issueDescription: 'The /users endpoint crashes',
        projectContext: 'This is a Node.js REST API backend service'
      });

      const generateTextCall = generateText.mock.calls[0][0];
      expect(generateTextCall.prompt).toContain('Node.js REST API backend service');
    });

    it('should consider available milestones when suggesting milestone', async () => {
      const mockMilestones = [
        { id: '1', title: 'v1.0 - MVP', state: 'open', number: 1 },
        { id: '2', title: 'v2.0 - Advanced Features', state: 'open', number: 2 }
      ];

      mockProjectService.listMilestones.mockResolvedValue(mockMilestones);

      const mockEnrichment = {
        suggestedLabels: ['feature'],
        suggestedPriority: 'medium',
        suggestedType: 'feature',
        complexity: 'simple',
        estimatedEffort: '3 days',
        relatedIssues: [],
        milestone: 'v1.0 - MVP',
        reasoning: 'Simple feature for MVP'
      };

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify(mockEnrichment)
      });

      const result = await service.enrichIssue({
        projectId: 'project-123',
        issueId: 'issue-feat',
        issueTitle: 'Add basic search functionality'
      });

      expect(result.milestone).toBe('v1.0 - MVP');
      const generateTextCall = generateText.mock.calls[0][0];
      expect(generateTextCall.prompt).toContain('v1.0 - MVP');
      expect(generateTextCall.prompt).toContain('v2.0 - Advanced Features');
    });
  });

  describe('related issues detection', () => {
    it('should identify related issues based on content', async () => {
      const mockEnrichment = {
        suggestedLabels: ['bug', 'authentication'],
        suggestedPriority: 'high',
        suggestedType: 'bug',
        complexity: 'moderate',
        estimatedEffort: '2 days',
        relatedIssues: ['#42', '#55', '#67'],
        reasoning: 'Related to other auth issues #42 and #55'
      };

      mockProjectService.listMilestones.mockResolvedValue([]);

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify(mockEnrichment)
      });

      const result = await service.enrichIssue({
        projectId: 'project-123',
        issueId: 'issue-auth',
        issueTitle: 'OAuth login broken',
        issueDescription: 'OAuth authentication fails for Google provider'
      });

      expect(result.relatedIssues).toHaveLength(3);
      expect(result.relatedIssues).toContain('#42');
      expect(result.relatedIssues).toContain('#55');
    });
  });

  describe('complexity assessment', () => {
    it('should assess simple tasks correctly', async () => {
      const mockEnrichment = {
        suggestedLabels: ['documentation'],
        suggestedPriority: 'low',
        suggestedType: 'documentation',
        complexity: 'simple',
        estimatedEffort: '1 hour',
        relatedIssues: [],
        reasoning: 'Simple typo fix'
      };

      mockProjectService.listMilestones.mockResolvedValue([]);

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify(mockEnrichment)
      });

      const result = await service.enrichIssue({
        projectId: 'project-123',
        issueId: 'issue-typo',
        issueTitle: 'Fix typo in README',
        issueDescription: 'Change "recieve" to "receive"'
      });

      expect(result.complexity).toBe('simple');
      expect(result.estimatedEffort).toBe('1 hour');
    });

    it('should assess complex tasks correctly', async () => {
      const mockEnrichment = {
        suggestedLabels: ['feature', 'complex', 'architecture'],
        suggestedPriority: 'high',
        suggestedType: 'enhancement',
        complexity: 'complex',
        estimatedEffort: '2-3 weeks',
        relatedIssues: [],
        reasoning: 'Major architectural change requiring refactoring'
      };

      mockProjectService.listMilestones.mockResolvedValue([]);

      const { generateText } = require('ai');
      generateText.mockResolvedValue({
        text: JSON.stringify(mockEnrichment)
      });

      const result = await service.enrichIssue({
        projectId: 'project-123',
        issueId: 'issue-refactor',
        issueTitle: 'Refactor to microservices architecture',
        issueDescription: 'Migrate monolith to microservices'
      });

      expect(result.complexity).toBe('complex');
      expect(result.estimatedEffort).toContain('weeks');
    });
  });
});
