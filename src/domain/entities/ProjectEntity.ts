/**
 * ProjectEntity - Rich domain entity for GitHub Projects
 *
 * This entity encapsulates business logic and invariants for projects,
 * providing computed properties and validation methods.
 *
 * ## Design Decisions
 * - Implements the existing `Project` interface for backward compatibility
 * - Adds computed properties for project health, activity, and metrics
 * - Enforces invariants (e.g., cannot reopen archived projects)
 * - Provides factory methods for common creation patterns
 *
 * ## Usage
 * ```typescript
 * const project = ProjectEntity.fromData(projectData);
 *
 * // Business logic
 * project.health; // 'healthy', 'at-risk', 'critical'
 * project.activityLevel; // 'active', 'moderate', 'stale'
 * project.canAddMilestone(); // checks if project allows new milestones
 * project.addField(field); // adds a custom field
 * ```
 */
import { ResourceStatus, ResourceType } from '../resource-types';
import type { Project, CreateProject, CustomField, ProjectView, } from '../types';

/**
 * Project health status
 */
export enum ProjectHealth {
  HEALTHY = 'healthy',
  AT_RISK = 'at-risk',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown',
}

/**
 * Project activity level
 */
export enum ActivityLevel {
  ACTIVE = 'active',
  MODERATE = 'moderate',
  STALE = 'stale',
  INACTIVE = 'inactive',
}

/**
 * Project visibility
 */
export enum ProjectVisibility {
  PRIVATE = 'private',
  PUBLIC = 'public',
}

/**
 * Configuration for ProjectEntity
 */
export interface ProjectEntityConfig {
  /** Number of days without updates to consider "stale" */
  staleDaysThreshold?: number;
  /** Maximum number of custom fields allowed */
  maxFields?: number;
  /** Maximum number of views allowed */
  maxViews?: number;
  /** Default visibility for new projects */
  defaultVisibility?: ProjectVisibility;
}

const DEFAULT_CONFIG: ProjectEntityConfig = {
  staleDaysThreshold: 30,
  maxFields: 50,
  maxViews: 10,
  defaultVisibility: ProjectVisibility.PRIVATE,
};

/**
 * Rich domain entity for GitHub Projects
 */
export class ProjectEntity implements Project {
  // Core properties (from Project interface)
  public readonly id: string;
  public readonly type: ResourceType;
  public title: string;
  public description: string;
  public readonly owner: string;
  public readonly number: number;
  public readonly url: string;
  public fields: CustomField[];
  public views: ProjectView[];
  public closed: boolean;
  public readonly createdAt: string;
  public updatedAt: string;
  public status: ResourceStatus;
  public visibility: string;
  public version: number;

  // Internal config
  private readonly config: ProjectEntityConfig;

  private constructor(
    data: Project,
    config: ProjectEntityConfig = DEFAULT_CONFIG
  ) {
    this.id = data.id;
    this.type = data.type;
    this.title = data.title;
    this.description = data.description;
    this.owner = data.owner;
    this.number = data.number;
    this.url = data.url;
    this.fields = [...(data.fields ?? [])];
    this.views = [...(data.views ?? [])];
    this.closed = data.closed;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.status = data.status ?? ResourceStatus.ACTIVE;
    this.visibility = data.visibility ?? config.defaultVisibility ?? ProjectVisibility.PRIVATE;
    this.version = data.version ?? 1;
    this.config = config;
  }

  // =========================================================================
  // Factory Methods
  // =========================================================================

  /**
   * Create a ProjectEntity from existing Project data
   */
  static fromData(data: Project, config?: ProjectEntityConfig): ProjectEntity {
    return new ProjectEntity(data, config);
  }

  /**
   * Create a new ProjectEntity with defaults
   */
  static create(
    data: CreateProject,
    options: {
      number: number;
      url: string;
      config?: ProjectEntityConfig;
    }
  ): ProjectEntity {
    const now = new Date().toISOString();
    const config = options.config ?? DEFAULT_CONFIG;

    const projectData: Project = {
      id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: ResourceType.PROJECT,
      title: data.title,
      description: data.shortDescription ?? data.description ?? '',
      owner: data.owner,
      number: options.number,
      url: options.url,
      fields: data.fields ?? [],
      views: data.views ?? [],
      closed: false,
      createdAt: now,
      updatedAt: now,
      status: data.status ?? ResourceStatus.ACTIVE,
      visibility: data.visibility ?? config.defaultVisibility ?? ProjectVisibility.PRIVATE,
      version: 1,
    };

    return new ProjectEntity(projectData, options.config);
  }

  // =========================================================================
  // Computed Properties
  // =========================================================================

  /**
   * Check if the project is open (not closed)
   */
  get isOpen(): boolean {
    return !this.closed;
  }

  /**
   * Check if the project is closed
   */
  get isClosed(): boolean {
    return this.closed;
  }

  /**
   * Check if the project is archived
   */
  get isArchived(): boolean {
    return this.status === ResourceStatus.ARCHIVED;
  }

  /**
   * Check if the project is active
   */
  get isActive(): boolean {
    return this.status === ResourceStatus.ACTIVE &&
           !this.closed;
  }

  /**
   * Get the number of custom fields
   */
  get fieldCount(): number {
    return this.fields.length;
  }

  /**
   * Get the number of views
   */
  get viewCount(): number {
    return this.views.length;
  }

  /**
   * Check if the project has any custom fields
   */
  get hasFields(): boolean {
    return this.fields.length > 0;
  }

  /**
   * Check if the project has any views
   */
  get hasViews(): boolean {
    return this.views.length > 0;
  }

  /**
   * Get the age of the project in days
   */
  get ageInDays(): number {
    const created = new Date(this.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get days since last update
   */
  get daysSinceUpdate(): number {
    const updated = new Date(this.updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - updated.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if the project is stale (no updates in threshold days)
   */
  get isStale(): boolean {
    return this.daysSinceUpdate >= (this.config.staleDaysThreshold ?? 30);
  }

  /**
   * Get the activity level based on last update
   */
  get activityLevel(): ActivityLevel {
    if (this.daysSinceUpdate <= 7) return ActivityLevel.ACTIVE;
    if (this.daysSinceUpdate <= 14) return ActivityLevel.MODERATE;
    if (this.daysSinceUpdate <= 30) return ActivityLevel.STALE;
    return ActivityLevel.INACTIVE;
  }

  /**
   * Get the health status of the project
   * Health is based on: closed status, staleness, and field count
   */
  get health(): ProjectHealth {
    if (this.closed || this.isArchived) return ProjectHealth.UNKNOWN;
    if (this.isStale) return ProjectHealth.CRITICAL;
    if (this.daysSinceUpdate > 14) return ProjectHealth.AT_RISK;
    return ProjectHealth.HEALTHY;
  }

  /**
   * Get a field by name
   */
  getFieldByName(name: string): CustomField | undefined {
    return this.fields.find(f => f.name.toLowerCase() === name.toLowerCase());
  }

  /**
   * Get a field by ID
   */
  getFieldById(fieldId: string): CustomField | undefined {
    return this.fields.find(f => f.id === fieldId);
  }

  /**
   * Get a view by name
   */
  getViewByName(name: string): ProjectView | undefined {
    return this.views.find(v => v.name.toLowerCase() === name.toLowerCase());
  }

  /**
   * Get a view by ID
   */
  getViewById(viewId: string): ProjectView | undefined {
    return this.views.find(v => v.id === viewId);
  }

  /**
   * Get fields by type
   */
  getFieldsByType(type: string): CustomField[] {
    return this.fields.filter(f => f.type === type);
  }

  /**
   * Get views by layout
   */
  getViewsByLayout(layout: string): ProjectView[] {
    return this.views.filter(v => v.layout === layout);
  }

  // =========================================================================
  // Business Logic Methods
  // =========================================================================

  /**
   * Close the project
   */
  close(): void {
    if (this.closed) {
      return; // Already closed
    }
    this.closed = true;
    this.status = ResourceStatus.CLOSED;
    this.touch();
  }

  /**
   * Reopen the project
   */
  reopen(): void {
    if (!this.closed) {
      return; // Already open
    }
    this.closed = false;
    this.status = ResourceStatus.ACTIVE;
    this.touch();
  }

  /**
   * Archive the project
   */
  archive(): void {
    if (this.isArchived) {
      return; // Already archived
    }
    this.status = ResourceStatus.ARCHIVED;
    this.closed = true;
    this.touch();
  }

  /**
   * Check if the project can accept new milestones
   */
  canAddMilestone(): boolean {
    return this.isOpen && !this.isArchived;
  }

  /**
   * Check if the project can accept new issues
   */
  canAddIssue(): boolean {
    return this.isOpen && !this.isArchived;
  }

  /**
   * Check if the project can accept new fields
   */
  canAddField(): boolean {
    return this.fields.length < (this.config.maxFields ?? 50);
  }

  /**
   * Check if the project can accept new views
   */
  canAddView(): boolean {
    return this.views.length < (this.config.maxViews ?? 10);
  }

  /**
   * Add a custom field to the project
   * @returns true if field was added, false if already exists or limit reached
   */
  addField(field: CustomField): boolean {
    if (!this.canAddField()) {
      return false;
    }

    // Check for duplicate name
    if (this.getFieldByName(field.name)) {
      return false;
    }

    this.fields.push(field);
    this.touch();
    return true;
  }

  /**
   * Remove a custom field from the project
   * @returns true if field was removed, false if not found
   */
  removeField(fieldId: string): boolean {
    const index = this.fields.findIndex(f => f.id === fieldId);
    if (index === -1) {
      return false;
    }

    this.fields.splice(index, 1);
    this.touch();
    return true;
  }

  /**
   * Update a custom field
   * @returns true if field was updated, false if not found
   */
  updateField(fieldId: string, updates: Partial<CustomField>): boolean {
    const field = this.getFieldById(fieldId);
    if (!field) {
      return false;
    }

    Object.assign(field, updates);
    this.touch();
    return true;
  }

  /**
   * Add a view to the project
   * @returns true if view was added, false if already exists or limit reached
   */
  addView(view: ProjectView): boolean {
    if (!this.canAddView()) {
      return false;
    }

    // Check for duplicate name
    if (this.getViewByName(view.name)) {
      return false;
    }

    this.views.push(view);
    this.touch();
    return true;
  }

  /**
   * Remove a view from the project
   * @returns true if view was removed, false if not found
   */
  removeView(viewId: string): boolean {
    const index = this.views.findIndex(v => v.id === viewId);
    if (index === -1) {
      return false;
    }

    this.views.splice(index, 1);
    this.touch();
    return true;
  }

  /**
   * Update a view
   * @returns true if view was updated, false if not found
   */
  updateView(viewId: string, updates: Partial<ProjectView>): boolean {
    const view = this.getViewById(viewId);
    if (!view) {
      return false;
    }

    Object.assign(view, updates);
    this.touch();
    return true;
  }

  /**
   * Get a summary of the project
   */
  toSummary(): {
    id: string;
    title: string;
    owner: string;
    number: number;
    status: string;
    isOpen: boolean;
    health: string;
    activityLevel: string;
    fieldCount: number;
    viewCount: number;
    ageInDays: number;
    isStale: boolean;
  } {
    return {
      id: this.id,
      title: this.title,
      owner: this.owner,
      number: this.number,
      status: this.status,
      isOpen: this.isOpen,
      health: this.health,
      activityLevel: this.activityLevel,
      fieldCount: this.fieldCount,
      viewCount: this.viewCount,
      ageInDays: this.ageInDays,
      isStale: this.isStale,
    };
  }

  /**
   * Convert to plain object (for serialization)
   */
  toData(): Project {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      description: this.description,
      owner: this.owner,
      number: this.number,
      url: this.url,
      fields: [...this.fields],
      views: [...this.views],
      closed: this.closed,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      status: this.status,
      visibility: this.visibility,
      version: this.version,
    };
  }

  /**
   * Create a copy of this project
   */
  clone(): ProjectEntity {
    return ProjectEntity.fromData(this.toData(), this.config);
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  /**
   * Update the updatedAt timestamp
   */
  private touch(): void {
    this.updatedAt = new Date().toISOString();
    this.version += 1;
  }
}
