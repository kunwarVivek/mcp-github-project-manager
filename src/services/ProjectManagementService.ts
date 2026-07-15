/**
 * ProjectManagementService - Facade Pattern
 *
 * This service acts as a facade coordinating multiple specialized services:
 * - SubIssueService: Issue dependencies, status, milestone assignment
 * - MilestoneService: Milestone CRUD and metrics
 * - SprintPlanningService: Sprint lifecycle and planning
 * - ProjectStatusService: Project CRUD operations
 * - ProjectTemplateService: Project customization (README, fields, views)
 * - ProjectLinkingService: Project item operations
 *
 * Direct implementations remain for:
 * - Roadmap creation (orchestration)
 * - Issue CRUD, comments
 * - Draft issues
 * - Pull requests
 * - Field value operations
 * - Labels
 * - Automation rules
 * - Iteration management
 */
import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import { GitHubMilestoneRepository } from "../infrastructure/github/repositories/GitHubMilestoneRepository";
import { GitHubProjectRepository } from "../infrastructure/github/repositories/GitHubProjectRepository";
import { GitHubSprintRepository } from "../infrastructure/github/repositories/GitHubSprintRepository";
import { ResourceStatus, ResourceType } from "../domain/resource-types";
import {
  Issue,
  CreateIssue,
  Milestone,
  CreateMilestone,
  Project,
  CreateProject,
  Sprint,
  CreateSprint,
  CustomField,
  ProjectView,
  createResource,
  ProjectItem
} from "../domain/types";
import { z } from "zod";
import { MCPErrorCode } from "../domain/mcp-types";
import {
  DomainError,
  ResourceNotFoundError,
  ValidationError,
  RateLimitError,
  UnauthorizedError,
  GitHubAPIError
} from "../domain/errors";
import {
  AutomationTrigger,
  AutomationAction,
  AutomationTriggerType,
  AutomationActionType,
  CreateAutomationRule
} from "../domain/automation-types";

// Import extracted services
import { SubIssueService } from "./SubIssueService";
import type { IssueDependency, IssueHistoryEntry } from "./SubIssueService";
import { IssueService } from "./IssueService";
import { RoadmapService } from "./RoadmapService";
import { ProjectAutomationService } from "./ProjectAutomationService";
import { MilestoneService } from "./MilestoneService";
import type { MilestoneMetrics } from "./MilestoneService";
import { SprintPlanningService } from "./SprintPlanningService";
import type { SprintMetrics } from "./SprintPlanningService";
import { ProjectStatusService } from "./ProjectStatusService";
import { ProjectTemplateService } from "./ProjectTemplateService";
import { ProjectLinkingService } from "./ProjectLinkingService";

export type { IssueDependency, IssueHistoryEntry, MilestoneMetrics, SprintMetrics };
export { SubIssueService, MilestoneService, SprintPlanningService, ProjectStatusService, ProjectTemplateService, ProjectLinkingService };

// Validation schema for roadmap creation
/**
 * ProjectManagementService - Facade for GitHub project management
 *
 * Coordinates multiple specialized services while providing a unified API
 * for project management operations.
 */
export class ProjectManagementService {
  private readonly factory: GitHubRepositoryFactory;

  // Injected services for delegation
  private readonly subIssueService: SubIssueService;
  private readonly milestoneService: MilestoneService;
  private readonly sprintPlanningService: SprintPlanningService;
  private readonly projectStatusService: ProjectStatusService;
  private readonly templateService: ProjectTemplateService;
  private readonly linkingService: ProjectLinkingService;
  private readonly issueService: IssueService;
  private readonly roadmapService: RoadmapService;
  private readonly automationService: ProjectAutomationService;

  /**
   * Create a new ProjectManagementService with all dependencies injected.
   *
   * @param factory - GitHub repository factory for direct operations
   * @param subIssueService - Service for issue dependencies and status
   * @param milestoneService - Service for milestone operations
   * @param sprintPlanningService - Service for sprint planning
   * @param projectStatusService - Service for project CRUD
   * @param templateService - Service for project customization
   * @param linkingService - Service for project item operations
   * @param issueService - Service for issue CRUD, comments, and draft issues
   * @param roadmapService - Service for full-roadmap creation
   */
  constructor(
    factory: GitHubRepositoryFactory,
    subIssueService: SubIssueService,
    milestoneService: MilestoneService,
    sprintPlanningService: SprintPlanningService,
    projectStatusService: ProjectStatusService,
    templateService: ProjectTemplateService,
    linkingService: ProjectLinkingService,
    issueService: IssueService,
    roadmapService: RoadmapService,
    automationService: ProjectAutomationService
  ) {
    this.factory = factory;
    this.subIssueService = subIssueService;
    this.milestoneService = milestoneService;
    this.sprintPlanningService = sprintPlanningService;
    this.projectStatusService = projectStatusService;
    this.templateService = templateService;
    this.linkingService = linkingService;
    this.issueService = issueService;
    this.roadmapService = roadmapService;
    this.automationService = automationService;
  }

  // ============================================================================
  // Repository Accessors (for internal use)
  // ============================================================================

  getRepositoryFactory(): GitHubRepositoryFactory {
    return this.factory;
  }

  private mapErrorToMCPError(error: unknown): Error {
    if (error instanceof ValidationError) {
      return new DomainError(`${MCPErrorCode.VALIDATION_ERROR}: ${error.message}`);
    }
    if (error instanceof ResourceNotFoundError) {
      return new DomainError(`${MCPErrorCode.RESOURCE_NOT_FOUND}: ${error.message}`);
    }
    if (error instanceof RateLimitError) {
      return new DomainError(`${MCPErrorCode.RATE_LIMITED}: ${error.message}`);
    }
    if (error instanceof UnauthorizedError) {
      return new DomainError(`${MCPErrorCode.UNAUTHORIZED}: ${error.message}`);
    }
    if (error instanceof GitHubAPIError) {
      return new DomainError(`${MCPErrorCode.INTERNAL_ERROR}: GitHub API Error - ${error.message}`);
    }
    return new DomainError(`${MCPErrorCode.INTERNAL_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }

  // ============================================================================
  // SubIssueService Delegation
  // ============================================================================

  async updateIssueStatus(issueId: string, status: ResourceStatus): Promise<Issue> {
    return this.subIssueService.updateIssueStatus(issueId, status);
  }

  async addIssueDependency(issueId: string, dependsOnId: string): Promise<void> {
    return this.subIssueService.addIssueDependency(issueId, dependsOnId);
  }

  async getIssueDependencies(issueId: string): Promise<string[]> {
    return this.subIssueService.getIssueDependencies(issueId);
  }

  async assignIssueToMilestone(issueId: string, milestoneId: string): Promise<Issue> {
    return this.subIssueService.assignIssueToMilestone(issueId, milestoneId);
  }

  async getIssueHistory(issueId: string): Promise<IssueHistoryEntry[]> {
    return this.subIssueService.getIssueHistory(issueId);
  }

  // ============================================================================
  // MilestoneService Delegation
  // ============================================================================

  async getMilestoneMetrics(id: string, includeIssues: boolean = false): Promise<MilestoneMetrics> {
    return this.milestoneService.getMilestoneMetrics(id, includeIssues);
  }

  async getOverdueMilestones(limit: number = 10, includeIssues: boolean = false): Promise<MilestoneMetrics[]> {
    return this.milestoneService.getOverdueMilestones(limit, includeIssues);
  }

  async getUpcomingMilestones(daysAhead: number = 30, limit: number = 10, includeIssues: boolean = false): Promise<MilestoneMetrics[]> {
    return this.milestoneService.getUpcomingMilestones(daysAhead, limit, includeIssues);
  }

  async createMilestone(data: { title: string; description?: string; dueDate?: string }): Promise<Milestone> {
    return this.milestoneService.createMilestone({
      title: data.title,
      description: data.description || '',
      dueDate: data.dueDate
    });
  }

  async listMilestones(state: string = 'open', sort: string = 'due_on', direction: string = 'asc'): Promise<Milestone[]> {
    return this.milestoneService.listMilestones(state, sort, direction);
  }

  async updateMilestone(data: { milestoneId: string; title?: string; description?: string; dueDate?: string; state?: 'open' | 'closed' }): Promise<Milestone> {
    return this.milestoneService.updateMilestone(data);
  }

  async deleteMilestone(data: { milestoneId: string }): Promise<{ success: boolean; message: string }> {
    return this.milestoneService.deleteMilestone(data);
  }

  // ============================================================================
  // SprintPlanningService Delegation
  // ============================================================================

  async planSprint(data: { sprint: CreateSprint; issueIds: number[] }): Promise<Sprint> {
    return this.sprintPlanningService.planSprint(data);
  }

  async findSprints(filters?: { status?: ResourceStatus }): Promise<Sprint[]> {
    return this.sprintPlanningService.findSprints(filters);
  }

  async updateSprint(data: {
    sprintId: string;
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    status?: 'planned' | 'active' | 'completed';
    issues?: string[];
  }): Promise<Sprint> {
    return this.sprintPlanningService.updateSprint(data);
  }

  async addIssuesToSprint(data: { sprintId: string; issueIds: string[] }): Promise<{ success: boolean; addedIssues: number; message: string }> {
    return this.sprintPlanningService.addIssuesToSprint(data);
  }

  async removeIssuesFromSprint(data: { sprintId: string; issueIds: string[] }): Promise<{ success: boolean; removedIssues: number; message: string }> {
    return this.sprintPlanningService.removeIssuesFromSprint(data);
  }

  async getSprintMetrics(id: string, includeIssues: boolean = false): Promise<SprintMetrics> {
    return this.sprintPlanningService.getSprintMetrics(id, includeIssues);
  }

  async createSprint(data: { title: string; description?: string; startDate: string; endDate: string; issues?: string[] }): Promise<Sprint> {
    return this.sprintPlanningService.createSprint({
      title: data.title,
      description: data.description || '',
      startDate: data.startDate,
      endDate: data.endDate,
      issueIds: data.issues
    });
  }

  async listSprints(status: string = 'all'): Promise<Sprint[]> {
    return this.sprintPlanningService.listSprints(status);
  }

  async getCurrentSprint(includeIssues: boolean = true): Promise<Sprint | null> {
    return this.sprintPlanningService.getCurrentSprint(includeIssues);
  }

  // ============================================================================
  // ProjectStatusService Delegation
  // ============================================================================

  async createProject(data: { title: string; shortDescription?: string; visibility?: 'private' | 'public' }): Promise<Project> {
    return this.projectStatusService.createProject(data);
  }

  async listProjects(status: string = 'active', limit: number = 10): Promise<Project[]> {
    return this.projectStatusService.listProjects(status, limit);
  }

  async getProject(projectId: string): Promise<Project | null> {
    return this.projectStatusService.getProject(projectId);
  }

  async updateProject(data: { projectId: string; title?: string; shortDescription?: string; closed?: boolean }): Promise<Project> {
    return this.projectStatusService.updateProject(data);
  }

  async deleteProject(data: { projectId: string }): Promise<{ success: boolean; message: string }> {
    return this.projectStatusService.deleteProject(data);
  }

  // ============================================================================
  // ProjectTemplateService Delegation
  // ============================================================================

  async getProjectReadme(data: { projectId: string }): Promise<{ readme: string }> {
    return this.templateService.getProjectReadme(data);
  }

  async updateProjectReadme(data: { projectId: string; readme: string }): Promise<{ success: boolean; message: string }> {
    return this.templateService.updateProjectReadme(data);
  }

  async listProjectFields(data: { projectId: string }): Promise<CustomField[]> {
    return this.templateService.listProjectFields(data);
  }

  async createProjectField(data: { projectId: string; name: string; type: string; options?: Array<{ name: string; color?: string; description?: string }> }): Promise<CustomField> {
    return this.templateService.createProjectField(data);
  }

  async updateProjectField(data: { projectId: string; fieldId: string; name?: string; options?: Array<{ id?: string; name: string; color?: string; description?: string }> }): Promise<CustomField> {
    return this.templateService.updateProjectField(data);
  }

  async createProjectView(data: { projectId: string; name: string; layout?: 'table' | 'board' | 'roadmap' }): Promise<ProjectView> {
    return this.templateService.createProjectView({
      projectId: data.projectId,
      name: data.name,
      layout: data.layout || 'table'
    });
  }

  async listProjectViews(data: { projectId: string }): Promise<ProjectView[]> {
    return this.templateService.listProjectViews(data);
  }

  async updateProjectView(data: { projectId: string; viewId: string; name?: string; layout?: 'table' | 'board' | 'roadmap'; filter?: string; sortBy?: Array<{ field: string; direction: 'asc' | 'desc' }> }): Promise<ProjectView> {
    return this.templateService.updateProjectView(data);
  }

  async deleteProjectView(data: { projectId: string; viewId: string }): Promise<{ success: boolean; message: string }> {
    return this.templateService.deleteProjectView(data);
  }

  // ============================================================================
  // ProjectLinkingService Delegation
  // ============================================================================

  async addProjectItem(data: { projectId: string; contentId: string; contentType: 'issue' | 'pull_request' }): Promise<ProjectItem> {
    return this.linkingService.addProjectItem(data);
  }

  async removeProjectItem(data: { projectId: string; itemId: string }): Promise<{ success: boolean; message: string }> {
    return this.linkingService.removeProjectItem(data);
  }

  async archiveProjectItem(data: { projectId: string; itemId: string }): Promise<{ success: boolean; message: string }> {
    return this.linkingService.archiveProjectItem(data);
  }

  async unarchiveProjectItem(data: { projectId: string; itemId: string }): Promise<{ success: boolean; message: string }> {
    return this.linkingService.unarchiveProjectItem(data);
  }

  async listProjectItems(data: { projectId: string; limit?: number }): Promise<ProjectItem[]> {
    return this.linkingService.listProjectItems(data);
  }

  // ============================================================================
  // Roadmap Management (Orchestration - kept in facade)
  // ============================================================================

  async createRoadmap(data: {
    project: CreateProject;
    milestones: Array<{
      milestone: CreateMilestone;
      issues: CreateIssue[];
    }>;
  }): Promise<{
    project: Project;
    milestones: Array<Milestone & { issues: Issue[] }>;
  }> {
    return this.roadmapService.createRoadmap(data);
  }

  // ============================================================================
  // Issue Management (Direct implementation)
  // ============================================================================

  async createIssue(data: {
    title: string;
    description: string;
    milestoneId?: string;
    assignees?: string[];
    labels?: string[];
    priority?: string;
    type?: string;
  }): Promise<Issue> {
    return this.issueService.createIssue(data);
  }

  async listIssues(options: {
    status?: string;
    milestone?: string;
    labels?: string[];
    assignee?: string;
    sort?: string;
    direction?: string;
    limit?: number;
  } = {}): Promise<Issue[]> {
    return this.issueService.listIssues(options);
  }

  async getIssue(issueId: string): Promise<Issue | null> {
    return this.issueService.getIssue(issueId);
  }

  async updateIssue(
    issueId: string,
    updates: {
      title?: string;
      description?: string;
      status?: string;
      milestoneId?: string | null;
      assignees?: string[];
      labels?: string[];
    }
  ): Promise<Issue> {
    return this.issueService.updateIssue(issueId, updates);
  }

  // ============================================================================
  // Issue Comment Operations (Direct implementation)
  // ============================================================================

  async createIssueComment(data: {
    issueNumber: number;
    body: string;
  }): Promise<{ id: number; body: string; user: string; createdAt: string; updatedAt: string }> {
    return this.issueService.createIssueComment(data);
  }

  async updateIssueComment(data: {
    commentId: number;
    body: string;
  }): Promise<{ id: number; body: string; user: string; createdAt: string; updatedAt: string }> {
    return this.issueService.updateIssueComment(data);
  }

  async deleteIssueComment(data: { commentId: number }): Promise<{ success: boolean; message: string }> {
    return this.issueService.deleteIssueComment(data);
  }

  async listIssueComments(data: {
    issueNumber: number;
    limit?: number;
  }): Promise<Array<{ id: number; body: string; user: string; createdAt: string; updatedAt: string }>> {
    return this.issueService.listIssueComments(data);
  }

  // ============================================================================
  // Draft Issue Operations (Direct implementation)
  // ============================================================================

  async createDraftIssue(data: {
    projectId: string;
    title: string;
    body?: string;
    assigneeIds?: string[];
  }): Promise<{ id: string; title: string; body: string }> {
    return this.issueService.createDraftIssue(data);
  }

  async updateDraftIssue(data: {
    draftIssueId: string;
    title?: string;
    body?: string;
    assigneeIds?: string[];
  }): Promise<{ id: string; title: string; body: string }> {
    return this.issueService.updateDraftIssue(data);
  }

  async deleteDraftIssue(data: { draftIssueId: string }): Promise<{ success: boolean; message: string }> {
    return this.issueService.deleteDraftIssue(data);
  }

  // ============================================================================
  // Pull Request Operations (Direct implementation)
  // ============================================================================

  async createPullRequest(data: {
    title: string;
    body?: string;
    head: string;
    base: string;
    draft?: boolean;
  }): Promise<{ number: number; id: number; title: string; state: string; url: string }> {
    try {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.pulls.create({
        owner: config.owner,
        repo: config.repo,
        title: data.title,
        body: data.body || '',
        head: data.head,
        base: data.base,
        draft: data.draft || false
      });

      return {
        number: response.data.number,
        id: response.data.id,
        title: response.data.title,
        state: response.data.state,
        url: response.data.html_url
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async getPullRequest(data: { pullNumber: number }): Promise<{
    number: number;
    title: string;
    state: string;
    body: string;
    head: string;
    base: string;
    user: string;
    merged: boolean;
    url: string;
  }> {
    try {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.pulls.get({
        owner: config.owner,
        repo: config.repo,
        pull_number: data.pullNumber
      });

      return {
        number: response.data.number,
        title: response.data.title,
        state: response.data.state,
        body: response.data.body || '',
        head: response.data.head.ref,
        base: response.data.base.ref,
        user: response.data.user?.login || 'unknown',
        merged: response.data.merged,
        url: response.data.html_url
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async listPullRequests(data: {
    state?: 'open' | 'closed' | 'all';
    limit?: number;
  }): Promise<Array<{ number: number; title: string; state: string; user: string; url: string }>> {
    try {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.pulls.list({
        owner: config.owner,
        repo: config.repo,
        state: data.state || 'open',
        per_page: data.limit || 30
      });

      return response.data.map(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        user: pr.user?.login || 'unknown',
        url: pr.html_url
      }));
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async updatePullRequest(data: {
    pullNumber: number;
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
  }): Promise<{ number: number; title: string; state: string; url: string }> {
    try {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.pulls.update({
        owner: config.owner,
        repo: config.repo,
        pull_number: data.pullNumber,
        title: data.title,
        body: data.body,
        state: data.state
      });

      return {
        number: response.data.number,
        title: response.data.title,
        state: response.data.state,
        url: response.data.html_url
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async mergePullRequest(data: {
    pullNumber: number;
    mergeMethod?: 'merge' | 'squash' | 'rebase';
    commitTitle?: string;
    commitMessage?: string;
  }): Promise<{ merged: boolean; message: string; sha: string }> {
    try {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.pulls.merge({
        owner: config.owner,
        repo: config.repo,
        pull_number: data.pullNumber,
        merge_method: data.mergeMethod || 'merge',
        commit_title: data.commitTitle,
        commit_message: data.commitMessage
      });

      return {
        merged: response.data.merged,
        message: response.data.message,
        sha: response.data.sha
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async listPullRequestReviews(data: { pullNumber: number }): Promise<Array<{
    id: number;
    user: string;
    state: string;
    body: string;
  }>> {
    try {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.pulls.listReviews({
        owner: config.owner,
        repo: config.repo,
        pull_number: data.pullNumber
      });

      return response.data.map(review => ({
        id: review.id,
        user: review.user?.login || 'unknown',
        state: review.state,
        body: review.body || ''
      }));
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async createPullRequestReview(data: {
    pullNumber: number;
    body?: string;
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    comments?: Array<{ path: string; position?: number; body: string }>;
  }): Promise<{ id: number; user: string; state: string; body: string }> {
    try {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.pulls.createReview({
        owner: config.owner,
        repo: config.repo,
        pull_number: data.pullNumber,
        body: data.body,
        event: data.event,
        comments: data.comments
      });

      return {
        id: response.data.id,
        user: response.data.user?.login || 'unknown',
        state: response.data.state,
        body: response.data.body || ''
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  // ============================================================================
  // Field Value Operations (Direct implementation)
  // ============================================================================

  async setFieldValue(data: {
    projectId: string;
    itemId: string;
    fieldId: string;
    value: unknown;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // Get field details to determine type
      const fieldQuery = `
        query($projectId: ID!, $fieldId: ID!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              field(id: $fieldId) {
                ... on ProjectV2Field { id name dataType }
                ... on ProjectV2IterationField { id name dataType }
                ... on ProjectV2SingleSelectField { id name dataType options { id name } }
              }
            }
          }
        }
      `;

      interface FieldQueryResponse {
        node: {
          field: {
            id: string;
            name: string;
            dataType: string;
            options?: Array<{ id: string; name: string }>;
          };
        };
      }

      const fieldResponse = await this.factory.graphql<FieldQueryResponse>(fieldQuery, {
        projectId: data.projectId,
        fieldId: data.fieldId
      });

      if (!fieldResponse.node?.field) {
        throw new ResourceNotFoundError(ResourceType.FIELD, data.fieldId);
      }

      const field = fieldResponse.node.field;
      let mutation = '';
      let variables: Record<string, unknown> = {};

      switch (field.dataType) {
        case 'TEXT':
          mutation = `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { text: $value } }) {
              projectV2Item { id }
            }
          }`;
          variables = { projectId: data.projectId, itemId: data.itemId, fieldId: data.fieldId, value: String(data.value) };
          break;
        case 'NUMBER':
          mutation = `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Float!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { number: $value } }) {
              projectV2Item { id }
            }
          }`;
          variables = { projectId: data.projectId, itemId: data.itemId, fieldId: data.fieldId, value: Number(data.value) };
          break;
        case 'DATE':
          mutation = `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Date!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { date: $value } }) {
              projectV2Item { id }
            }
          }`;
          variables = { projectId: data.projectId, itemId: data.itemId, fieldId: data.fieldId, value: String(data.value) };
          break;
        case 'SINGLE_SELECT':
          let optionId = String(data.value);
          if (field.options) {
            const option = field.options.find(o => o.name === data.value || o.id === data.value);
            if (option) optionId = option.id;
          }
          mutation = `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $value } }) {
              projectV2Item { id }
            }
          }`;
          variables = { projectId: data.projectId, itemId: data.itemId, fieldId: data.fieldId, value: optionId };
          break;
        case 'ITERATION':
          const iterationValue = data.value as { iterationId?: string };
          mutation = `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { iterationId: $value } }) {
              projectV2Item { id }
            }
          }`;
          variables = { projectId: data.projectId, itemId: data.itemId, fieldId: data.fieldId, value: iterationValue.iterationId || String(data.value) };
          break;
        default:
          throw new ValidationError(`Unsupported field type: ${field.dataType}`);
      }

      await this.factory.graphql(mutation, variables);
      return { success: true, message: `Field ${field.name} updated successfully` };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async getFieldValue(data: {
    projectId: string;
    itemId: string;
    fieldId: string;
  }): Promise<{ fieldId: string; fieldName: string; value: unknown; type: string }> {
    try {
      const query = `
        query($itemId: ID!) {
          node(id: $itemId) {
            ... on ProjectV2Item {
              fieldValues(first: 50) {
                nodes {
                  ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2Field { id name } } }
                  ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2Field { id name } } }
                  ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2Field { id name } } }
                  ... on ProjectV2ItemFieldSingleSelectValue { name optionId field { ... on ProjectV2SingleSelectField { id name } } }
                  ... on ProjectV2ItemFieldIterationValue { title iterationId field { ... on ProjectV2IterationField { id name } } }
                }
              }
            }
          }
        }
      `;

      interface FieldValueResponse {
        node: {
          fieldValues: {
            nodes: Array<{
              field: { id: string; name: string };
              text?: string;
              number?: number;
              date?: string;
              name?: string;
              optionId?: string;
              title?: string;
              iterationId?: string;
            }>;
          };
        };
      }

      const response = await this.factory.graphql<FieldValueResponse>(query, { itemId: data.itemId });

      if (!response.node?.fieldValues?.nodes) {
        throw new ResourceNotFoundError(ResourceType.FIELD, data.itemId);
      }

      const fieldValue = response.node.fieldValues.nodes.find(fv => fv.field?.id === data.fieldId);
      if (!fieldValue) {
        return { fieldId: data.fieldId, fieldName: 'unknown', value: null, type: 'unknown' };
      }

      let value: unknown = null;
      let type = 'unknown';

      if ('text' in fieldValue && fieldValue.text !== undefined) {
        value = fieldValue.text;
        type = 'TEXT';
      } else if ('number' in fieldValue && fieldValue.number !== undefined) {
        value = fieldValue.number;
        type = 'NUMBER';
      } else if ('date' in fieldValue && fieldValue.date !== undefined) {
        value = fieldValue.date;
        type = 'DATE';
      } else if ('optionId' in fieldValue) {
        value = { optionId: fieldValue.optionId, name: fieldValue.name };
        type = 'SINGLE_SELECT';
      } else if ('iterationId' in fieldValue) {
        value = { iterationId: fieldValue.iterationId, title: fieldValue.title };
        type = 'ITERATION';
      }

      return { fieldId: data.fieldId, fieldName: fieldValue.field?.name || 'unknown', value, type };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async clearFieldValue(data: {
    projectId: string;
    itemId: string;
    fieldId: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const mutation = `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
          clearProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId }) {
            projectV2Item { id }
          }
        }
      `;

      await this.factory.graphql(mutation, {
        projectId: data.projectId,
        itemId: data.itemId,
        fieldId: data.fieldId
      });

      return { success: true, message: `Field ${data.fieldId} cleared successfully` };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  // ============================================================================
  // Label Operations (Direct implementation)
  // ============================================================================

  async createLabel(data: {
    name: string;
    color?: string;
    description?: string;
  }): Promise<{ id: number; name: string; color: string; description: string }> {
    try {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.issues.createLabel({
        owner: config.owner,
        repo: config.repo,
        name: data.name,
        color: data.color?.replace('#', '') || 'ededed',
        description: data.description || ''
      });

      return {
        id: response.data.id,
        name: response.data.name,
        color: response.data.color,
        description: response.data.description || ''
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async listLabels(data: { limit?: number } = {}): Promise<Array<{
    id: number;
    name: string;
    color: string;
    description: string;
  }>> {
    try {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.issues.listLabelsForRepo({
        owner: config.owner,
        repo: config.repo,
        per_page: data.limit || 100
      });

      return response.data.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description || ''
      }));
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  // ============================================================================
  // Automation Rule Management (Direct implementation)
  // ============================================================================

  async createAutomationRule(data: {
    name: string;
    description?: string;
    projectId: string;
    enabled?: boolean;
    triggers: Array<{
      type: string;
      resourceType?: string;
      conditions?: Array<{ field: string; operator: string; value: unknown }>;
    }>;
    actions: Array<{ type: string; parameters: Record<string, unknown> }>;
  }): Promise<{
    id: string;
    name: string;
    description?: string;
    projectId: string;
    enabled: boolean;
    triggers: unknown[];
    actions: unknown[];
  }> {
    try {
      // Map tool-shaped string types to the domain enum types.
      const mappedTriggers = data.triggers.map(t => ({
        type: t.type as AutomationTriggerType,
        resourceType: t.resourceType as ResourceType | undefined,
        conditions: t.conditions?.map(c => ({ id: '', field: c.field, operator: c.operator, value: c.value }))
      }));
      const mappedActions = data.actions.map(a => ({
        type: a.type as AutomationActionType,
        parameters: a.parameters
      }));

      const rule = await this.automationService.createRule({
        name: data.name,
        description: data.description,
        projectId: data.projectId,
        enabled: data.enabled !== false,
        triggers: mappedTriggers,
        actions: mappedActions
      } as CreateAutomationRule);

      return {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        projectId: rule.projectId,
        enabled: rule.enabled,
        triggers: rule.triggers,
        actions: rule.actions
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async updateAutomationRule(data: {
    ruleId: string;
    name?: string;
    description?: string;
    enabled?: boolean;
    triggers?: Array<{
      type: string;
      resourceType?: string;
      conditions?: Array<{ field: string; operator: string; value: unknown }>;
    }>;
    actions?: Array<{ type: string; parameters: Record<string, unknown> }>;
  }): Promise<{
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    triggers: unknown[];
    actions: unknown[];
  }> {
    try {
      // Map tool-shaped string types to the domain enum types.
      const mappedTriggers = data.triggers?.map(t => ({
        id: '',
        type: t.type as AutomationTriggerType,
        resourceType: t.resourceType as ResourceType | undefined,
        conditions: t.conditions?.map(c => ({ id: '', field: c.field, operator: c.operator, value: c.value }))
      })) as AutomationTrigger[] | undefined;
      const mappedActions = data.actions?.map(a => ({
        id: '',
        type: a.type as AutomationActionType,
        parameters: a.parameters
      })) as AutomationAction[] | undefined;

      const updated = await this.automationService.updateRule(data.ruleId, {
        name: data.name,
        description: data.description,
        enabled: data.enabled,
        triggers: mappedTriggers,
        actions: mappedActions
      });

      return {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        enabled: updated.enabled,
        triggers: updated.triggers,
        actions: updated.actions
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async deleteAutomationRule(data: { ruleId: string }): Promise<{ success: boolean }> {
    try {
      await this.automationService.deleteRule(data.ruleId);
      return { success: true };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async getAutomationRule(data: { ruleId: string }): Promise<{
    id: string;
    name: string;
    description?: string;
    projectId: string;
    enabled: boolean;
    triggers: unknown[];
    actions: unknown[];
  }> {
    try {
      const rule = await this.automationService.getRuleById(data.ruleId);
      return {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        projectId: rule.projectId,
        enabled: rule.enabled,
        triggers: rule.triggers,
        actions: rule.actions
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async listAutomationRules(data: { projectId: string }): Promise<{
    rules: Array<{
      id: string;
      name: string;
      description?: string;
      enabled: boolean;
      triggersCount: number;
      actionsCount: number;
    }>;
  }> {
    try {
      const rules = await this.automationService.getRulesByProject(data.projectId);
      return {
        rules: rules.map(rule => ({
          id: rule.id,
          name: rule.name,
          description: rule.description,
          enabled: rule.enabled,
          triggersCount: rule.triggers.length,
          actionsCount: rule.actions.length
        }))
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async enableAutomationRule(data: { ruleId: string }): Promise<{ id: string; name: string; enabled: boolean }> {
    try {
      const updated = await this.automationService.enableRule(data.ruleId);
      return { id: updated.id, name: updated.name, enabled: updated.enabled };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async disableAutomationRule(data: { ruleId: string }): Promise<{ id: string; name: string; enabled: boolean }> {
    try {
      const updated = await this.automationService.disableRule(data.ruleId);
      return { id: updated.id, name: updated.name, enabled: updated.enabled };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  // ============================================================================
  // Iteration Management (Direct implementation)
  // ============================================================================

  async getIterationConfiguration(data: {
    projectId: string;
    fieldName?: string;
  }): Promise<{
    fieldId: string;
    fieldName: string;
    duration: number;
    startDay: number;
    iterations: Array<{ id: string; title: string; startDate: string; duration: number }>;
  }> {
    try {
      const fields = await this.listProjectFields({ projectId: data.projectId });
      const iterationField = fields.find((f: CustomField) =>
        f.type === 'iteration' && (!data.fieldName || f.name === data.fieldName)
      );

      if (!iterationField) {
        throw new ResourceNotFoundError(ResourceType.FIELD, data.fieldName || 'iteration field');
      }

      if (!iterationField.config) {
        throw new Error('Invalid iteration field configuration');
      }

      return {
        fieldId: iterationField.id,
        fieldName: iterationField.name,
        duration: iterationField.config.iterationDuration || 14,
        startDay: iterationField.config.iterationStart ? new Date(iterationField.config.iterationStart).getDay() : 1,
        iterations: (iterationField.config.iterations || []).map((iter: { id: string; title: string; startDate: string; duration: number }) => ({
          id: iter.id,
          title: iter.title,
          startDate: iter.startDate,
          duration: iter.duration
        }))
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async getCurrentIteration(data: {
    projectId: string;
    fieldName?: string;
  }): Promise<{ id: string; title: string; startDate: string; endDate: string; duration: number } | null> {
    try {
      const config = await this.getIterationConfiguration(data);
      const now = new Date();

      for (const iteration of config.iterations) {
        const start = new Date(iteration.startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + iteration.duration);

        if (now >= start && now < end) {
          return {
            id: iteration.id,
            title: iteration.title,
            startDate: iteration.startDate,
            endDate: end.toISOString(),
            duration: iteration.duration
          };
        }
      }

      return null;
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async getIterationItems(data: {
    projectId: string;
    iterationId: string;
    limit?: number;
  }): Promise<{ items: Array<{ id: string; title: string; type: string; status?: string }> }> {
    try {
      const items = await this.listProjectItems({
        projectId: data.projectId,
        limit: data.limit || 50
      });

      const iterationItems = items.filter((item: ProjectItem) => {
        const fieldValues = item.fieldValues || {};
        return Object.values(fieldValues).some(v => v === data.iterationId);
      });

      return {
        items: iterationItems.map((item: ProjectItem) => ({
          id: item.id,
          title: 'Untitled',
          type: item.contentType,
          status: undefined
        }))
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async getIterationByDate(data: {
    projectId: string;
    date: string;
    fieldName?: string;
  }): Promise<{ id: string; title: string; startDate: string; endDate: string; duration: number } | null> {
    try {
      const config = await this.getIterationConfiguration(data);
      const targetDate = new Date(data.date);

      for (const iteration of config.iterations) {
        const start = new Date(iteration.startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + iteration.duration);

        if (targetDate >= start && targetDate < end) {
          return {
            id: iteration.id,
            title: iteration.title,
            startDate: iteration.startDate,
            endDate: end.toISOString(),
            duration: iteration.duration
          };
        }
      }

      return null;
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async assignItemsToIteration(data: {
    projectId: string;
    itemIds: string[];
    iterationId: string;
    fieldName?: string;
  }): Promise<{ success: boolean; assignedCount: number }> {
    try {
      const fields = await this.listProjectFields({ projectId: data.projectId });
      const iterationField = fields.find((f: CustomField) =>
        f.type === 'iteration' && (!data.fieldName || f.name === data.fieldName)
      );

      if (!iterationField) {
        throw new ResourceNotFoundError(ResourceType.FIELD, data.fieldName || 'iteration field');
      }

      let assignedCount = 0;

      for (const itemId of data.itemIds) {
        try {
          await this.setFieldValue({
            projectId: data.projectId,
            itemId: itemId,
            fieldId: iterationField.id,
            value: { iterationId: data.iterationId }
          });
          assignedCount++;
        } catch {
          // Continue with other items on failure
        }
      }

      return { success: assignedCount > 0, assignedCount };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }
}
