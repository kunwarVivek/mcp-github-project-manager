import { beforeEach, describe, expect, it, vi, Mocked, MockedClass, MockedFunction } from 'vitest';
import { ProjectManagementService } from '../../../services/ProjectManagementService';
import { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
import { SubIssueService } from '../../../services/SubIssueService';
import { MilestoneService } from '../../../services/MilestoneService';
import { SprintPlanningService } from '../../../services/SprintPlanningService';
import { ProjectStatusService } from '../../../services/ProjectStatusService';
import { ProjectTemplateService } from '../../../services/ProjectTemplateService';
import { ProjectLinkingService } from '../../../services/ProjectLinkingService';
import { IssueService } from '../../../services/IssueService';
import { RoadmapService } from '../../../services/RoadmapService';
import { ProjectAutomationService } from '../../../services/ProjectAutomationService';
import { PullRequestService } from '../../../services/PullRequestService';
import { FieldValueService } from '../../../services/FieldValueService';
import { LabelService } from '../../../services/LabelService';
import { IterationService } from '../../../services/IterationService';
import { ResourceStatus, ResourceType } from '../../../domain/resource-types';
import { ValidationError, ResourceNotFoundError, DomainError } from '../../../domain/errors';

/**
 * ProjectManagementService Unit Tests
 *
 * These tests verify setFieldValue and getFieldValue behavior using manual mock injection.
 * The service is instantiated directly with mocked dependencies (Approach B from DI refactoring).
 *
 * Mock Strategy:
 * - Create mock factory with graphql method BEFORE service instantiation
 * - Create stub services (not used by setFieldValue/getFieldValue)
 * - Instantiate service with mocks directly
 *
 * Note: The service's actual return format is `"Field ${name} updated successfully"`,
 * NOT `"Field value updated successfully for field '${name}'"`.
 */
describe('ProjectManagementService', () => {
  let service: ProjectManagementService;
  let mockGraphql: MockedFunction<any>;
  let mockFactory: GitHubRepositoryFactory;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock graphql function BEFORE service instantiation
    mockGraphql = vi.fn() as MockedFunction<any>;

    // Create mock factory with graphql method pre-configured
    mockFactory = {
      graphql: mockGraphql,
      createProjectRepository: vi.fn(),
      createMilestoneRepository: vi.fn(),
      createIssueRepository: vi.fn(),
      createSprintRepository: vi.fn(),
      createAutomationRuleRepository: vi.fn()
    } as unknown as GitHubRepositoryFactory;

    // Create stub services (not used by setFieldValue/getFieldValue tests)
    const mockSubIssue = {} as SubIssueService;
    const mockMilestone = {} as MilestoneService;
    const mockSprint = {} as SprintPlanningService;
    const mockProjectStatus = {} as ProjectStatusService;
    const mockTemplate = {} as ProjectTemplateService;
    const mockLinking = {} as ProjectLinkingService;
    const mockIssue = {} as IssueService;
    const mockRoadmap = {} as RoadmapService;
    const mockAutomation = {} as ProjectAutomationService;
    const mockPullRequest = {} as PullRequestService;
    const mockFieldValue = {
      setFieldValue: jest.fn<any>().mockResolvedValue({ success: true, message: 'Field updated' }),
      getFieldValue: jest.fn<any>().mockResolvedValue({ fieldId: 'field-1', fieldName: 'Status', value: 'Done', type: 'SINGLE_SELECT' }),
      clearFieldValue: jest.fn<any>().mockResolvedValue({ success: true, message: 'Field cleared' }),
    } as unknown as FieldValueService;
    const mockLabel = {} as LabelService;
    const mockIteration = {} as IterationService;

    // Instantiate service directly with mocked dependencies
    service = new ProjectManagementService(
      mockFactory,
      mockSubIssue,
      mockMilestone,
      mockSprint,
      mockProjectStatus,
      mockTemplate,
      mockLinking,
      mockIssue,
      mockRoadmap,
      mockAutomation,
      mockPullRequest,
      mockFieldValue,
      mockLabel,
      mockIteration
    );
  });

  it('should be properly initialized', () => {
    expect(service).toBeDefined();
  });

  describe('setFieldValue (delegation)', () => {
    it('should delegate to fieldValueService.setFieldValue', async () => {
      const data = { projectId: 'P1', itemId: 'I1', fieldId: 'F1', value: 'test' };
      const result = await service.setFieldValue(data);

      expect(result).toEqual({ success: true, message: 'Field updated' });
    });
  });

  describe('getFieldValue (delegation)', () => {
    it('should delegate to fieldValueService.getFieldValue', async () => {
      const data = { projectId: 'P1', itemId: 'I1', fieldId: 'F1' };
      const result = await service.getFieldValue(data);

      expect(result).toEqual({ fieldId: 'field-1', fieldName: 'Status', value: 'Done', type: 'SINGLE_SELECT' });
    });
  });

  describe('clearFieldValue (delegation)', () => {
    it('should delegate to fieldValueService.clearFieldValue', async () => {
      const data = { projectId: 'P1', itemId: 'I1', fieldId: 'F1' };
      const result = await service.clearFieldValue(data);

      expect(result).toEqual({ success: true, message: 'Field cleared' });
    });
  });
});
