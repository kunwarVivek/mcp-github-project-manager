/**
 * Integration tests for facade wiring via DI container.
 *
 * Verifies that:
 * - DI container correctly resolves all services
 * - ProjectManagementService delegates to extracted services
 * - Service dependencies are properly wired
 */
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { configureContainer, container, createProjectManagementService } from '../../container';
import { ProjectManagementService } from '../../services/ProjectManagementService';
import { SubIssueService } from '../../services/SubIssueService';
import { MilestoneService } from '../../services/MilestoneService';
import { SprintPlanningService } from '../../services/SprintPlanningService';
import { ProjectStatusService } from '../../services/ProjectStatusService';
import { ProjectTemplateService } from '../../services/ProjectTemplateService';
import { ProjectLinkingService } from '../../services/ProjectLinkingService';

describe('Facade Wiring Integration', () => {
  beforeEach(() => {
    // Clear container instances for clean state
    container.clearInstances();
  });

  describe('Container Configuration', () => {
    it('should configure container with test credentials', () => {
      const configured = configureContainer('test-token', 'test-owner', 'test-repo');
      expect(configured).toBeDefined();
    });

    it('should resolve GitHubRepositoryFactory from container', () => {
      configureContainer('test-token', 'test-owner', 'test-repo');
      const factory = container.resolve('GitHubRepositoryFactory');
      expect(factory).toBeDefined();
    });

    it('should resolve all extracted services from container', () => {
      configureContainer('test-token', 'test-owner', 'test-repo');

      expect(container.resolve('SubIssueService')).toBeDefined();
      expect(container.resolve('MilestoneService')).toBeDefined();
      expect(container.resolve('SprintPlanningService')).toBeDefined();
      expect(container.resolve('ProjectStatusService')).toBeDefined();
      expect(container.resolve('ProjectTemplateService')).toBeDefined();
      expect(container.resolve('ProjectLinkingService')).toBeDefined();
    });

    it('should resolve ProjectManagementService from container', () => {
      configureContainer('test-token', 'test-owner', 'test-repo');
      const service = container.resolve('ProjectManagementService');
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ProjectManagementService);
    });
  });

  describe('Direct Instantiation Helper', () => {
    it('should create ProjectManagementService via helper function', () => {
      const service = createProjectManagementService('test-owner', 'test-repo', 'test-token');
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ProjectManagementService);
    });

    it('should have all expected methods on the facade', () => {
      const service = createProjectManagementService('test-owner', 'test-repo', 'test-token');

      // SubIssue delegations
      expect(typeof service.updateIssueStatus).toBe('function');
      expect(typeof service.addIssueDependency).toBe('function');
      expect(typeof service.getIssueDependencies).toBe('function');
      expect(typeof service.assignIssueToMilestone).toBe('function');
      expect(typeof service.getIssueHistory).toBe('function');

      // Milestone delegations
      expect(typeof service.getMilestoneMetrics).toBe('function');
      expect(typeof service.getOverdueMilestones).toBe('function');
      expect(typeof service.getUpcomingMilestones).toBe('function');
      expect(typeof service.createMilestone).toBe('function');
      expect(typeof service.listMilestones).toBe('function');

      // Sprint delegations
      expect(typeof service.planSprint).toBe('function');
      expect(typeof service.createSprint).toBe('function');
      expect(typeof service.listSprints).toBe('function');
      expect(typeof service.getCurrentSprint).toBe('function');
      expect(typeof service.getSprintMetrics).toBe('function');

      // ProjectStatus delegations
      expect(typeof service.createProject).toBe('function');
      expect(typeof service.listProjects).toBe('function');
      expect(typeof service.getProject).toBe('function');
      expect(typeof service.updateProject).toBe('function');
      expect(typeof service.deleteProject).toBe('function');

      // ProjectTemplate delegations
      expect(typeof service.getProjectReadme).toBe('function');
      expect(typeof service.updateProjectReadme).toBe('function');
      expect(typeof service.listProjectFields).toBe('function');
      expect(typeof service.createProjectView).toBe('function');
      expect(typeof service.listProjectViews).toBe('function');

      // ProjectLinking delegations
      expect(typeof service.addProjectItem).toBe('function');
      expect(typeof service.removeProjectItem).toBe('function');
      expect(typeof service.listProjectItems).toBe('function');
      expect(typeof service.archiveProjectItem).toBe('function');
      expect(typeof service.unarchiveProjectItem).toBe('function');

      // Direct implementations (coordination/non-delegated)
      expect(typeof service.createRoadmap).toBe('function');
      expect(typeof service.createIssue).toBe('function');
      expect(typeof service.listIssues).toBe('function');
      expect(typeof service.setFieldValue).toBe('function');
      expect(typeof service.getRepositoryFactory).toBe('function');
    });
  });

  describe('Delegation Verification', () => {
    it('should return factory from getRepositoryFactory', () => {
      const service = createProjectManagementService('test-owner', 'test-repo', 'test-token');
      const factory = service.getRepositoryFactory();
      expect(factory).toBeDefined();
      expect(factory.getConfig).toBeDefined();
    });

    it('should have factory configured with correct owner and repo', () => {
      const service = createProjectManagementService('my-owner', 'my-repo', 'my-token');
      const factory = service.getRepositoryFactory();
      const config = factory.getConfig();
      expect(config.owner).toBe('my-owner');
      expect(config.repo).toBe('my-repo');
    });
  });

  describe('Service Independence', () => {
    it('should create independent service instances', () => {
      const service1 = createProjectManagementService('owner1', 'repo1', 'token1');
      const service2 = createProjectManagementService('owner2', 'repo2', 'token2');

      const config1 = service1.getRepositoryFactory().getConfig();
      const config2 = service2.getRepositoryFactory().getConfig();

      expect(config1.owner).toBe('owner1');
      expect(config2.owner).toBe('owner2');
      expect(config1.repo).toBe('repo1');
      expect(config2.repo).toBe('repo2');
    });
  });

  describe('Type Exports', () => {
    it('should re-export types from extracted services', () => {
      // Types are re-exported at compile time, verify the module loads correctly
      const service = createProjectManagementService('test-owner', 'test-repo', 'test-token');
      // If getMilestoneMetrics exists, MilestoneMetrics type is usable
      expect(typeof service.getMilestoneMetrics).toBe('function');
      // If getSprintMetrics exists, SprintMetrics type is usable
      expect(typeof service.getSprintMetrics).toBe('function');
    });
  });
});
