/**
 * ProjectManagementService - Composition facade for the per-feature services.
 *
 * It holds the 14 feature services and exposes each through a typed getter
 * (e.g. `pms.issues.createIssue(...)`, `pms.sprints.planSprint(...)`). It adds
 * no behavior of its own: callers go straight to the owning service, so the
 * facade is not a fan-in node for every operation.
 *
 * | Getter | Service |
 * |--------|---------|
 * | issues | IssueService |
 * | subIssues | SubIssueService |
 * | milestones | MilestoneService |
 * | sprints | SprintPlanningService |
 * | projects | ProjectStatusService |
 * | templates | ProjectTemplateService |
 * | linking | ProjectLinkingService |
 * | roadmap | RoadmapService |
 * | automation | ProjectAutomationService |
 * | pullRequests | PullRequestService |
 * | fieldValues | FieldValueService |
 * | labels | LabelService |
 * | iterations | IterationService |
 */

import type { FieldValueService } from "./FieldValueService";
import type { IssueService } from "./IssueService";
import type { IterationService } from "./IterationService";
import type { LabelService } from "./LabelService";
import type { MilestoneService } from "./MilestoneService";
import type { ProjectAutomationService } from "./ProjectAutomationService";
import type { ProjectLinkingService } from "./ProjectLinkingService";
import type { ProjectStatusService } from "./ProjectStatusService";
import type { ProjectTemplateService } from "./ProjectTemplateService";
import type { PullRequestService } from "./PullRequestService";
import type { RoadmapService } from "./RoadmapService";
import type { SprintPlanningService } from "./SprintPlanningService";
import type { SubIssueService } from "./SubIssueService";

export class ProjectManagementService {
  constructor(
    private readonly subIssueService: SubIssueService,
    private readonly milestoneService: MilestoneService,
    private readonly sprintPlanningService: SprintPlanningService,
    private readonly projectStatusService: ProjectStatusService,
    private readonly templateService: ProjectTemplateService,
    private readonly linkingService: ProjectLinkingService,
    private readonly issueService: IssueService,
    private readonly roadmapService: RoadmapService,
    private readonly automationService: ProjectAutomationService,
    private readonly pullRequestService: PullRequestService,
    private readonly fieldValueService: FieldValueService,
    private readonly labelService: LabelService,
    private readonly iterationService: IterationService
  ) {}

  /** Issue operations (create, list, update, comments, drafts, blockers, types). */
  get issues(): IssueService {
    return this.issueService;
  }

  /** Sub-issue operations (dependencies, history, status). */
  get subIssues(): SubIssueService {
    return this.subIssueService;
  }

  /** Milestone operations (CRUD, metrics, overdue). */
  get milestones(): MilestoneService {
    return this.milestoneService;
  }

  /** Sprint planning operations (CRUD, metrics, current sprint). */
  get sprints(): SprintPlanningService {
    return this.sprintPlanningService;
  }

  /** Project CRUD and status operations. */
  get projects(): ProjectStatusService {
    return this.projectStatusService;
  }

  /** Project template operations (README, fields, views). */
  get templates(): ProjectTemplateService {
    return this.templateService;
  }

  /** Project linking operations (add/remove/archive items). */
  get linking(): ProjectLinkingService {
    return this.linkingService;
  }

  /** Roadmap operations. */
  get roadmap(): RoadmapService {
    return this.roadmapService;
  }

  /** Automation workflow operations. */
  get automation(): ProjectAutomationService {
    return this.automationService;
  }

  /** Pull request operations (CRUD, merge, reviews). */
  get pullRequests(): PullRequestService {
    return this.pullRequestService;
  }

  /** Field value operations (get/set/clear). */
  get fieldValues(): FieldValueService {
    return this.fieldValueService;
  }

  /** Label operations (create, list). */
  get labels(): LabelService {
    return this.labelService;
  }

  /** Iteration operations (config, current, items). */
  get iterations(): IterationService {
    return this.iterationService;
  }
}
