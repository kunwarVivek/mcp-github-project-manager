/**
 * ProjectManagementService - Facade for GitHub project management.
 *
 * **Architecture note:** This facade delegates every method to a specialized
 * service. The 76 methods are grouped by domain. For new code, prefer
 * accessing sub-services directly via the typed getters at the bottom of this
 * class (e.g., `pms.issues.createIssue(...)`) — the legacy delegation
 * methods are preserved for backward compatibility only.
 *
 * ## Method Groups
 * | Group | Methods | Sub-service |
 * |-------|---------|-------------|
 * | Issues | createIssue, listIssues, getIssue, updateIssue, … | IssueService |
 * | Sub-issues | updateIssueStatus, addIssueDependency, … | SubIssueService |
 * | Milestones | createMilestone, listMilestones, getMilestoneMetrics, … | MilestoneService |
 * | Sprints | createSprint, listSprints, planSprint, … | SprintPlanningService |
 * | Projects | createProject, listProjects, getProject, … | ProjectStatusService |
 * | Templates | getProjectReadme, listProjectFields, createProjectView, … | ProjectTemplateService |
 * | Linking | addProjectItem, removeProjectItem, listProjectItems, … | ProjectLinkingService |
 * | Roadmap | createRoadmap | RoadmapService |
 * | PRs | createPullRequest, listPullRequests, mergePullRequest, … | PullRequestService |
 * | Fields | setFieldValue, getFieldValue, clearFieldValue | FieldValueService |
 * | Labels | createLabel, listLabels | LabelService |
 * | Automation | createAutomationRule, listAutomationRules, … | ProjectAutomationService |
 * | Iterations | getIterationConfiguration, getCurrentIteration, … | IterationService |
 */
import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import type { ResourceStatus } from "../domain/resource-types";
import type {
  Issue, CreateIssue, Milestone, CreateMilestone, Project, CreateProject,
  Sprint, CreateSprint, CustomField, ProjectView, ProjectItem
} from "../domain/types";
// Entity imports removed - services now return plain objects for MCP compatibility
import { safeCall } from './utils/safeCall';

import { SubIssueService } from "./SubIssueService";
import type { IssueDependency, IssueHistoryEntry } from "./SubIssueService";
import type { IssueService } from "./IssueService";
import type { RoadmapService } from "./RoadmapService";
import type { ProjectAutomationService, CreateAutomationRuleInput, UpdateAutomationRuleInput, AutomationRuleDTO, AutomationRuleSummary } from "./ProjectAutomationService";
import { MilestoneService } from "./MilestoneService";
import type { MilestoneMetrics } from "./MilestoneService";
import { SprintPlanningService } from "./SprintPlanningService";
import type { SprintMetrics } from "./SprintPlanningService";
import { ProjectStatusService } from "./ProjectStatusService";
import { ProjectTemplateService } from "./ProjectTemplateService";
import { ProjectLinkingService } from "./ProjectLinkingService";
import type { PullRequestService } from "./PullRequestService";
import type { FieldValueService } from "./FieldValueService";
import type { LabelService } from "./LabelService";
import type { IterationService } from "./IterationService";

export type { IssueDependency, IssueHistoryEntry, MilestoneMetrics, SprintMetrics };
export { SubIssueService, MilestoneService, SprintPlanningService, ProjectStatusService, ProjectTemplateService, ProjectLinkingService };

export class ProjectManagementService {
  private readonly factory: GitHubRepositoryFactory;
  private readonly subIssueService: SubIssueService;
  private readonly milestoneService: MilestoneService;
  private readonly sprintPlanningService: SprintPlanningService;
  private readonly projectStatusService: ProjectStatusService;
  private readonly templateService: ProjectTemplateService;
  private readonly linkingService: ProjectLinkingService;
  private readonly issueService: IssueService;
  private readonly roadmapService: RoadmapService;
  private readonly automationService: ProjectAutomationService;
  private readonly pullRequestService: PullRequestService;
  private readonly fieldValueService: FieldValueService;
  private readonly labelService: LabelService;
  private readonly iterationService: IterationService;

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
    automationService: ProjectAutomationService,
    pullRequestService: PullRequestService,
    fieldValueService: FieldValueService,
    labelService: LabelService,
    iterationService: IterationService
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
    this.pullRequestService = pullRequestService;
    this.fieldValueService = fieldValueService;
    this.labelService = labelService;
    this.iterationService = iterationService;
  }

  getRepositoryFactory(): GitHubRepositoryFactory { return this.factory; }

  // -- SubIssueService --------------------------------------------------------

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

  // -- MilestoneService -------------------------------------------------------

  async getMilestoneMetrics(id: string, includeIssues = false): Promise<MilestoneMetrics> {
    return this.milestoneService.getMilestoneMetrics(id, includeIssues);
  }
  async getOverdueMilestones(limit = 10, includeIssues = false): Promise<MilestoneMetrics[]> {
    return this.milestoneService.getOverdueMilestones(limit, includeIssues);
  }
  async getUpcomingMilestones(daysAhead = 30, limit = 10, includeIssues = false): Promise<MilestoneMetrics[]> {
    return this.milestoneService.getUpcomingMilestones(daysAhead, limit, includeIssues);
  }
  async createMilestone(data: { title: string; description?: string; dueDate?: string }): Promise<Milestone> {
    return this.milestoneService.createMilestone({ title: data.title, description: data.description || '', dueDate: data.dueDate });
  }
  async listMilestones(state = 'open', sort = 'due_on', direction = 'asc'): Promise<Milestone[]> {
    return this.milestoneService.listMilestones(state, sort, direction);
  }
  async updateMilestone(data: { milestoneId: string; title?: string; description?: string; dueDate?: string; state?: 'open' | 'closed' }): Promise<Milestone> {
    return this.milestoneService.updateMilestone(data);
  }
  async deleteMilestone(data: { milestoneId: string }): Promise<{ success: boolean; message: string }> {
    return this.milestoneService.deleteMilestone(data);
  }

  // -- SprintPlanningService --------------------------------------------------

  async planSprint(data: { sprint: CreateSprint; issueIds: number[] }): Promise<Sprint> {
    return this.sprintPlanningService.planSprint(data);
  }
  async findSprints(filters?: { status?: ResourceStatus }): Promise<Sprint[]> {
    return this.sprintPlanningService.findSprints(filters);
  }
  async updateSprint(data: { sprintId: string; title?: string; description?: string; startDate?: string; endDate?: string; status?: 'planned' | 'active' | 'completed'; issues?: string[] }): Promise<Sprint> {
    return this.sprintPlanningService.updateSprint(data);
  }
  async addIssuesToSprint(data: { sprintId: string; issueIds: string[] }): Promise<{ success: boolean; addedIssues: number; message: string }> {
    return this.sprintPlanningService.addIssuesToSprint(data);
  }
  async removeIssuesFromSprint(data: { sprintId: string; issueIds: string[] }): Promise<{ success: boolean; removedIssues: number; message: string }> {
    return this.sprintPlanningService.removeIssuesFromSprint(data);
  }
  async getSprintMetrics(id: string, includeIssues = false): Promise<SprintMetrics> {
    return this.sprintPlanningService.getSprintMetrics(id, includeIssues);
  }
  async createSprint(data: { title: string; description?: string; startDate: string; endDate: string; issues?: string[] }): Promise<Sprint> {
    return this.sprintPlanningService.createSprint({ title: data.title, description: data.description || '', startDate: data.startDate, endDate: data.endDate, issueIds: data.issues });
  }
  async listSprints(status = 'all'): Promise<Sprint[]> {
    return this.sprintPlanningService.listSprints(status);
  }
  async getCurrentSprint(includeIssues = true): Promise<Sprint | null> {
    return this.sprintPlanningService.getCurrentSprint(includeIssues);
  }

  // -- ProjectStatusService ---------------------------------------------------

  async createProject(data: { title: string; shortDescription?: string; visibility?: 'private' | 'public' }): Promise<Project> {
    return this.projectStatusService.createProject(data);
  }
  async listProjects(status = 'active', limit = 10): Promise<Project[]> {
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

  // -- ProjectTemplateService -------------------------------------------------

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
    return this.templateService.createProjectView({ projectId: data.projectId, name: data.name, layout: data.layout || 'table' });
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

  // -- ProjectLinkingService --------------------------------------------------

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

  // -- RoadmapService ---------------------------------------------------------

  async createRoadmap(data: {
    project: CreateProject;
    milestones: Array<{ milestone: CreateMilestone; issues: CreateIssue[] }>;
  }): Promise<{ project: Project; milestones: Array<Milestone & { issues: Issue[] }> }> {
    return this.roadmapService.createRoadmap(data);
  }

  // -- IssueService -----------------------------------------------------------

  async createIssue(data: { title: string; description: string; milestoneId?: string; assignees?: string[]; labels?: string[]; priority?: string; type?: string }): Promise<Issue> {
    return this.issueService.createIssue(data);
  }
  async listIssues(options: { status?: string; milestone?: string; labels?: string[]; assignee?: string; sort?: string; direction?: string; limit?: number } = {}): Promise<Issue[]> {
    return this.issueService.listIssues(options);
  }
  async getIssue(issueId: string): Promise<Issue | null> {
    return this.issueService.getIssue(issueId);
  }
  async updateIssue(issueId: string, updates: { title?: string; description?: string; status?: string; milestoneId?: string | null; assignees?: string[]; labels?: string[] }): Promise<Issue> {
    return this.issueService.updateIssue(issueId, updates);
  }
  async createIssueComment(data: { issueNumber: number; body: string }): Promise<{ id: number; body: string; user: string; createdAt: string; updatedAt: string }> {
    return this.issueService.createIssueComment(data);
  }
  async updateIssueComment(data: { commentId: number; body: string }): Promise<{ id: number; body: string; user: string; createdAt: string; updatedAt: string }> {
    return this.issueService.updateIssueComment(data);
  }
  async deleteIssueComment(data: { commentId: number }): Promise<{ success: boolean; message: string }> {
    return this.issueService.deleteIssueComment(data);
  }
  async listIssueComments(data: { issueNumber: number; limit?: number }): Promise<Array<{ id: number; body: string; user: string; createdAt: string; updatedAt: string }>> {
    return this.issueService.listIssueComments(data);
  }
  async createDraftIssue(data: { projectId: string; title: string; body?: string; assigneeIds?: string[] }): Promise<{ id: string; title: string; body: string }> {
    return this.issueService.createDraftIssue(data);
  }
  async updateDraftIssue(data: { draftIssueId: string; title?: string; body?: string; assigneeIds?: string[] }): Promise<{ id: string; title: string; body: string }> {
    return this.issueService.updateDraftIssue(data);
  }
  async deleteDraftIssue(data: { draftIssueId: string }): Promise<{ success: boolean; message: string }> {
    return this.issueService.deleteDraftIssue(data);
  }

  // -- PullRequestService -----------------------------------------------------

  async createPullRequest(data: { title: string; body?: string; head: string; base: string; draft?: boolean }): Promise<{ number: number; id: number; title: string; state: string; url: string }> {
    return this.pullRequestService.createPullRequest(data);
  }
  async getPullRequest(data: { pullNumber: number }): Promise<{ number: number; title: string; state: string; body: string; head: string; base: string; user: string; merged: boolean; url: string }> {
    return this.pullRequestService.getPullRequest(data);
  }
  async listPullRequests(data: { state?: 'open' | 'closed' | 'all'; limit?: number }): Promise<Array<{ number: number; title: string; state: string; user: string; url: string }>> {
    return this.pullRequestService.listPullRequests(data);
  }
  async updatePullRequest(data: { pullNumber: number; title?: string; body?: string; state?: 'open' | 'closed' }): Promise<{ number: number; title: string; state: string; url: string }> {
    return this.pullRequestService.updatePullRequest(data);
  }
  async mergePullRequest(data: { pullNumber: number; mergeMethod?: 'merge' | 'squash' | 'rebase'; commitTitle?: string; commitMessage?: string }): Promise<{ merged: boolean; message: string; sha: string }> {
    return this.pullRequestService.mergePullRequest(data);
  }
  async listPullRequestReviews(data: { pullNumber: number }): Promise<Array<{ id: number; user: string; state: string; body: string }>> {
    return this.pullRequestService.listPullRequestReviews(data);
  }
  async createPullRequestReview(data: { pullNumber: number; body?: string; event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'; comments?: Array<{ path: string; position?: number; body: string }> }): Promise<{ id: number; user: string; state: string; body: string }> {
    return this.pullRequestService.createPullRequestReview(data);
  }

  // -- FieldValueService ------------------------------------------------------

  async setFieldValue(data: { projectId: string; itemId: string; fieldId: string; value: unknown }): Promise<{ success: boolean; message: string }> {
    return this.fieldValueService.setFieldValue(data);
  }
  async getFieldValue(data: { projectId: string; itemId: string; fieldId: string }): Promise<{ fieldId: string; fieldName: string; value: unknown; type: string }> {
    return this.fieldValueService.getFieldValue(data);
  }
  async clearFieldValue(data: { projectId: string; itemId: string; fieldId: string }): Promise<{ success: boolean; message: string }> {
    return this.fieldValueService.clearFieldValue(data);
  }

  // -- LabelService -----------------------------------------------------------

  async createLabel(data: { name: string; color?: string; description?: string }): Promise<{ id: number; name: string; color: string; description: string }> {
    return this.labelService.createLabel(data);
  }
  async listLabels(data: { limit?: number } = {}): Promise<Array<{ id: number; name: string; color: string; description: string }>> {
    return this.labelService.listLabels(data);
  }

  // -- ProjectAutomationService -----------------------------------------------

  async createAutomationRule(data: CreateAutomationRuleInput): Promise<AutomationRuleDTO> {
    return safeCall(() => this.automationService.createRuleFromInput(data));
  }
  async updateAutomationRule(data: UpdateAutomationRuleInput): Promise<Omit<AutomationRuleDTO, 'projectId'>> {
    return safeCall(() => this.automationService.updateRuleFromInput(data));
  }
  async deleteAutomationRule(data: { ruleId: string }): Promise<{ success: boolean }> {
    return safeCall(async () => {
      await this.automationService.deleteRule(data.ruleId);
      return { success: true };
    });
  }
  async getAutomationRule(data: { ruleId: string }): Promise<AutomationRuleDTO> {
    return safeCall(() => this.automationService.getRuleDTO(data.ruleId));
  }
  async listAutomationRules(data: { projectId: string }): Promise<{ rules: AutomationRuleSummary[] }> {
    return safeCall(async () => ({ rules: await this.automationService.listRuleSummaries(data.projectId) }));
  }
  async enableAutomationRule(data: { ruleId: string }): Promise<{ id: string; name: string; enabled: boolean }> {
    return safeCall(async () => {
      const updated = await this.automationService.enableRule(data.ruleId);
      return { id: updated.id, name: updated.name, enabled: updated.enabled };
    });
  }
  async disableAutomationRule(data: { ruleId: string }): Promise<{ id: string; name: string; enabled: boolean }> {
    return safeCall(async () => {
      const updated = await this.automationService.disableRule(data.ruleId);
      return { id: updated.id, name: updated.name, enabled: updated.enabled };
    });
  }

  // -- IterationService -------------------------------------------------------

  async getIterationConfiguration(data: { projectId: string; fieldName?: string }): Promise<{ fieldId: string; fieldName: string; duration: number; startDay: number; iterations: Array<{ id: string; title: string; startDate: string; duration: number }> }> {
    return this.iterationService.getIterationConfiguration(data);
  }
  async getCurrentIteration(data: { projectId: string; fieldName?: string }): Promise<{ id: string; title: string; startDate: string; endDate: string; duration: number } | null> {
    return this.iterationService.getCurrentIteration(data);
  }
  async getIterationItems(data: { projectId: string; iterationId: string; limit?: number }): Promise<{ items: Array<{ id: string; title: string; type: string; status?: string }> }> {
    return this.iterationService.getIterationItems(data);
  }
  async getIterationByDate(data: { projectId: string; date: string; fieldName?: string }): Promise<{ id: string; title: string; startDate: string; endDate: string; duration: number } | null> {
    return this.iterationService.getIterationByDate(data);
  }
  async assignItemsToIteration(data: { projectId: string; itemIds: string[]; iterationId: string; fieldName?: string }): Promise<{ success: boolean; assignedCount: number }> {
    return this.iterationService.assignItemsToIteration(data);
  }

  // ==========================================================================
  // Typed sub-service accessors — prefer these over the delegation methods
  // above for new code.
  // ==========================================================================

  /** Direct access to issue operations (create, list, update, comments, drafts). */
  get issues(): IssueService { return this.issueService; }

  /** Direct access to sub-issue operations (dependencies, history, status). */
  get subIssues(): SubIssueService { return this.subIssueService; }

  /** Direct access to milestone operations (CRUD, metrics, overdue). */
  get milestones(): MilestoneService { return this.milestoneService; }

  /** Direct access to sprint planning operations (CRUD, metrics, current sprint). */
  get sprints(): SprintPlanningService { return this.sprintPlanningService; }

  /** Direct access to project CRUD and status operations. */
  get projects(): ProjectStatusService { return this.projectStatusService; }

  /** Direct access to project template operations (README, fields, views). */
  get templates(): ProjectTemplateService { return this.templateService; }

  /** Direct access to project linking operations (add/remove/archive items). */
  get linking(): ProjectLinkingService { return this.linkingService; }

  /** Direct access to roadmap operations. */
  get roadmap(): RoadmapService { return this.roadmapService; }

  /** Direct access to automation rule operations (CRUD, enable/disable). */
  get automation(): ProjectAutomationService { return this.automationService; }

  /** Direct access to pull request operations (CRUD, merge, reviews). */
  get pullRequests(): PullRequestService { return this.pullRequestService; }

  /** Direct access to field value operations (get/set/clear). */
  get fieldValues(): FieldValueService { return this.fieldValueService; }

  /** Direct access to label operations (create, list). */
  get labels(): LabelService { return this.labelService; }

  /** Direct access to iteration operations (config, current, items). */
  get iterations(): IterationService { return this.iterationService; }
}
