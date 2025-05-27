import { ResourceType, ResourceStatus } from "../domain/resource-types";
import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { ResourceCache } from "../infrastructure/cache/ResourceCache";
import { FilePersistenceAdapter } from "../infrastructure/persistence/FilePersistenceAdapter";
import { Logger } from "../infrastructure/logger/index";
import { Project, Milestone, Issue, Sprint } from "../domain/types";

export interface SyncMetadata {
  resourceId: string;
  resourceType: ResourceType;
  lastModified: string;
  etag?: string;
  version: number;
  syncedAt: string;
}

export interface SyncResult {
  success: boolean;
  syncedResources: number;
  errors: string[];
  duration: number;
  skippedResources: number;
}

export interface SyncOptions {
  timeout: number;
  resourceTypes: ResourceType[];
  forceSync: boolean;
  batchSize: number;
}

export class GitHubStateSyncService {
  private readonly logger = Logger.getInstance();
  private readonly cache: ResourceCache;
  private readonly persistence: FilePersistenceAdapter;
  private readonly factory: GitHubRepositoryFactory;
  private syncInProgress = false;
  private lastSyncTime?: Date;

  constructor(
    factory: GitHubRepositoryFactory,
    cache: ResourceCache,
    persistence: FilePersistenceAdapter
  ) {
    this.factory = factory;
    this.cache = cache;
    this.persistence = persistence;
  }

  /**
   * Perform initial sync on server startup
   */
  async performInitialSync(timeout: number = 30000): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error("Sync already in progress");
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      syncedResources: 0,
      errors: [],
      duration: 0,
      skippedResources: 0
    };

    try {
      this.logger.info("Starting initial GitHub state sync...");

      // Load existing metadata from persistence
      const existingMetadata = await this.persistence.loadMetadata();
      this.logger.info(`Loaded ${existingMetadata.length} existing resource metadata entries`);

      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Sync timeout exceeded")), timeout);
      });

      // Perform sync with timeout
      const syncPromise = this.performSyncInternal(existingMetadata);
      const syncResult = await Promise.race([syncPromise, timeoutPromise]);

      Object.assign(result, syncResult);
      result.success = true;
      this.lastSyncTime = new Date();

      this.logger.info(`Initial sync completed: ${result.syncedResources} resources synced, ${result.skippedResources} skipped`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown sync error";
      result.errors.push(errorMessage);
      this.logger.error("Initial sync failed:", error);
    } finally {
      result.duration = Date.now() - startTime;
      this.syncInProgress = false;
    }

    return result;
  }

  /**
   * Sync specific resource type
   */
  async syncResourceType(type: ResourceType, forceSync = false): Promise<void> {
    this.logger.info(`Syncing resource type: ${type}`);

    try {
      switch (type) {
        case ResourceType.PROJECT:
          await this.syncProjects(forceSync);
          break;
        case ResourceType.MILESTONE:
          await this.syncMilestones(forceSync);
          break;
        case ResourceType.ISSUE:
          await this.syncIssues(forceSync);
          break;
        case ResourceType.SPRINT:
          await this.syncSprints(forceSync);
          break;
        default:
          this.logger.warn(`Unknown resource type for sync: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to sync resource type ${type}:`, error);
      throw error;
    }
  }

  /**
   * Check which resources need syncing based on metadata
   */
  async checkResourceChanges(metadata: SyncMetadata[]): Promise<string[]> {
    const changedResources: string[] = [];

    for (const meta of metadata) {
      try {
        const needsSync = await this.needsSync(meta);
        if (needsSync) {
          changedResources.push(meta.resourceId);
        }
      } catch (error) {
        this.logger.warn(`Failed to check changes for resource ${meta.resourceId}:`, error);
        // Include in changed resources to be safe
        changedResources.push(meta.resourceId);
      }
    }

    return changedResources;
  }

  /**
   * Check if a resource needs syncing
   */
  private async needsSync(metadata: SyncMetadata): Promise<boolean> {
    // If no sync time recorded, needs sync
    if (!metadata.syncedAt) {
      return true;
    }

    // If resource not in cache, needs sync
    const cached = this.cache.get(metadata.resourceType, metadata.resourceId);
    if (!cached) {
      return true;
    }

    // Check if cache entry is stale (older than 5 minutes)
    const cacheAge = Date.now() - new Date(metadata.syncedAt).getTime();
    const maxCacheAge = 5 * 60 * 1000; // 5 minutes

    return cacheAge > maxCacheAge;
  }

  /**
   * Internal sync implementation
   */
  private async performSyncInternal(existingMetadata: SyncMetadata[]): Promise<Partial<SyncResult>> {
    const result: Partial<SyncResult> = {
      syncedResources: 0,
      errors: [],
      skippedResources: 0
    };

    // Group metadata by resource type
    const metadataByType = this.groupMetadataByType(existingMetadata);

    // Sync each resource type
    const resourceTypes = [ResourceType.PROJECT, ResourceType.MILESTONE, ResourceType.ISSUE, ResourceType.SPRINT];

    for (const type of resourceTypes) {
      try {
        const typeMetadata = metadataByType.get(type) || [];
        const syncCount = await this.syncResourceTypeWithMetadata(type, typeMetadata);
        result.syncedResources = (result.syncedResources || 0) + syncCount.synced;
        result.skippedResources = (result.skippedResources || 0) + syncCount.skipped;
      } catch (error) {
        const errorMessage = `Failed to sync ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors?.push(errorMessage);
        this.logger.error(errorMessage, error);
      }
    }

    return result;
  }

  /**
   * Group metadata by resource type
   */
  private groupMetadataByType(metadata: SyncMetadata[]): Map<ResourceType, SyncMetadata[]> {
    const grouped = new Map<ResourceType, SyncMetadata[]>();

    for (const meta of metadata) {
      if (!grouped.has(meta.resourceType)) {
        grouped.set(meta.resourceType, []);
      }
      grouped.get(meta.resourceType)!.push(meta);
    }

    return grouped;
  }

  /**
   * Sync resource type with existing metadata
   */
  private async syncResourceTypeWithMetadata(
    type: ResourceType,
    metadata: SyncMetadata[]
  ): Promise<{ synced: number; skipped: number }> {
    let synced = 0;
    let skipped = 0;

    // Check which resources need syncing
    const resourcesNeedingSync = await this.checkResourceChanges(metadata);

    this.logger.info(`${type}: ${resourcesNeedingSync.length} resources need syncing out of ${metadata.length} total`);

    // Sync resources that need updating
    for (const resourceId of resourcesNeedingSync) {
      try {
        await this.syncSingleResource(type, resourceId);
        synced++;
      } catch (error) {
        this.logger.warn(`Failed to sync ${type} ${resourceId}:`, error);
        // Continue with other resources
      }
    }

    skipped = metadata.length - resourcesNeedingSync.length;
    return { synced, skipped };
  }

  /**
   * Sync a single resource
   */
  private async syncSingleResource(type: ResourceType, resourceId: string): Promise<void> {
    switch (type) {
      case ResourceType.PROJECT:
        const projectRepo = this.factory.createProjectRepository();
        const project = await projectRepo.findById(resourceId);
        if (project) {
          await this.cache.set(type, resourceId, project);
          await this.updateMetadata(type, resourceId, project);
        }
        break;
      case ResourceType.MILESTONE:
        const milestoneRepo = this.factory.createMilestoneRepository();
        const milestone = await milestoneRepo.findById(resourceId);
        if (milestone) {
          await this.cache.set(type, milestone.id.toString(), milestone);
          await this.updateMetadata(type, milestone.id.toString(), milestone);
        }
        break;
      case ResourceType.ISSUE:
        const issueRepo = this.factory.createIssueRepository();
        const issue = await issueRepo.findById(resourceId);
        if (issue) {
          await this.cache.set(type, issue.id.toString(), issue);
          await this.updateMetadata(type, issue.id.toString(), issue);
        }
        break;
      case ResourceType.SPRINT:
        const sprintRepo = this.factory.createSprintRepository();
        const sprint = await sprintRepo.findById(resourceId);
        if (sprint) {
          await this.cache.set(type, resourceId, sprint);
          await this.updateMetadata(type, resourceId, sprint);
        }
        break;
    }
  }

  /**
   * Update metadata for a resource
   */
  private async updateMetadata(type: ResourceType, resourceId: string, resource: any): Promise<void> {
    const metadata: SyncMetadata = {
      resourceId,
      resourceType: type,
      lastModified: resource.updatedAt || new Date().toISOString(),
      version: resource.version || 1,
      syncedAt: new Date().toISOString()
    };

    await this.persistence.saveMetadata(metadata);
  }

  /**
   * Sync all projects
   */
  private async syncProjects(forceSync: boolean): Promise<void> {
    const projectRepo = this.factory.createProjectRepository();
    const projects = await projectRepo.findAll();

    for (const project of projects) {
      await this.cache.set(ResourceType.PROJECT, project.id, project);
      await this.updateMetadata(ResourceType.PROJECT, project.id, project);
    }
  }

  /**
   * Sync all milestones
   */
  private async syncMilestones(forceSync: boolean): Promise<void> {
    const milestoneRepo = this.factory.createMilestoneRepository();
    const milestones = await milestoneRepo.findAll();

    for (const milestone of milestones) {
      await this.cache.set(ResourceType.MILESTONE, milestone.id.toString(), milestone);
      await this.updateMetadata(ResourceType.MILESTONE, milestone.id.toString(), milestone);
    }
  }

  /**
   * Sync all issues
   */
  private async syncIssues(forceSync: boolean): Promise<void> {
    const issueRepo = this.factory.createIssueRepository();
    const issues = await issueRepo.findAll();

    for (const issue of issues) {
      await this.cache.set(ResourceType.ISSUE, issue.id.toString(), issue);
      await this.updateMetadata(ResourceType.ISSUE, issue.id.toString(), issue);
    }
  }

  /**
   * Sync all sprints
   */
  private async syncSprints(forceSync: boolean): Promise<void> {
    const sprintRepo = this.factory.createSprintRepository();
    const sprints = await sprintRepo.findAll();

    for (const sprint of sprints) {
      await this.cache.set(ResourceType.SPRINT, sprint.id, sprint);
      await this.updateMetadata(ResourceType.SPRINT, sprint.id, sprint);
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): { inProgress: boolean; lastSyncTime?: Date } {
    return {
      inProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime
    };
  }
}
