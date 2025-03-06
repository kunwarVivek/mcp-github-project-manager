import {
  Resource,
  ResourceType,
  ResourceStatus,
  ResourceCacheOptions,
  ResourceQueryOptions,
  ResourceUpdateOptions,
  ResourceEvent,
  ResourceEventType,
  ResourceNotFoundError,
  ResourceVersionError,
  ResourceValidationError,
  ResourceUpdateData,
  CreateResourceData,
} from "../../domain/resource-types";
import { ResourceCache } from "../cache/ResourceCache";
import { OptimisticLockManager } from "./OptimisticLockManager";
import { v4 as uuidv4 } from "uuid";

export class ResourceManager {
  private static instance: ResourceManager;
  private cache: ResourceCache;
  private lockManager: OptimisticLockManager;
  private eventHandlers: ((event: ResourceEvent) => Promise<void>)[] = [];

  private constructor() {
    this.cache = ResourceCache.getInstance();
    this.lockManager = OptimisticLockManager.getInstance();
  }

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  /**
   * Create a new resource
   */
  async create<T extends Resource>(
    type: ResourceType,
    data: CreateResourceData<T>,
    options?: ResourceCacheOptions
  ): Promise<T> {
    const now = new Date().toISOString();
    const resource: T = {
      id: uuidv4(),
      type,
      version: 1,
      status: ResourceStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      metadata: data.metadata ?? {},
      ...data,
    } as T;

    await this.validateResource(resource);
    await this.cache.set(resource, options);
    await this.emitEvent({
      id: uuidv4(),
      type: ResourceEventType.CREATED,
      resourceId: resource.id,
      resourceType: type,
      timestamp: now,
      actor: "system",
      payload: resource,
    });

    return resource;
  }

  /**
   * Get a resource by ID
   */
  async get<T extends Resource>(
    type: ResourceType,
    id: string,
    options?: ResourceQueryOptions
  ): Promise<T> {
    const resource = await this.cache.get<T>(type, id);
    if (!resource) {
      throw new ResourceNotFoundError(type, id);
    }

    if (!options?.includeDeleted && resource.status === ResourceStatus.DELETED) {
      throw new ResourceNotFoundError(type, id);
    }

    return resource;
  }

  /**
   * Update an existing resource
   */
  async update<T extends Resource>(
    type: ResourceType,
    id: string,
    data: ResourceUpdateData<T>,
    options?: ResourceUpdateOptions & ResourceCacheOptions
  ): Promise<T> {
    const existing = await this.get<T>(type, id);

    if (options?.optimisticLock) {
      try {
        await this.lockManager.verifyAndLock(
          id,
          type,
          existing.version,
          options.expectedVersion
        );
      } catch (error) {
        throw error instanceof ResourceVersionError ? error : new Error("Lock acquisition failed");
      }
    }

    try {
      const updated: T = {
        ...existing,
        ...data,
        version: existing.version + 1,
        updatedAt: new Date().toISOString(),
        metadata: {
          ...existing.metadata,
          ...data.metadata,
        },
      };

      await this.validateResource(updated);
      await this.cache.set(updated, options);
      await this.emitEvent({
        id: uuidv4(),
        type: ResourceEventType.UPDATED,
        resourceId: updated.id,
        resourceType: updated.type,
        timestamp: updated.updatedAt,
        actor: "system",
        payload: {
          previous: existing,
          current: updated,
        },
      });

      return updated;
    } finally {
      if (options?.optimisticLock) {
        this.lockManager.releaseLock(id);
      }
    }
  }

  /**
   * Delete a resource
   */
  async delete(
    type: ResourceType,
    id: string,
    options?: ResourceUpdateOptions
  ): Promise<void> {
    const resource = await this.get(type, id);
    
    const now = new Date().toISOString();
    const updated = {
      ...resource,
      status: ResourceStatus.DELETED,
      deletedAt: now,
      version: resource.version + 1,
      updatedAt: now,
    };

    await this.cache.set(updated);
    await this.emitEvent({
      id: uuidv4(),
      type: ResourceEventType.DELETED,
      resourceId: id,
      resourceType: type,
      timestamp: now,
      actor: "system",
      payload: { resource: updated },
    });
  }

  /**
   * Archive a resource
   */
  async archive(
    type: ResourceType,
    id: string,
    options?: ResourceUpdateOptions
  ): Promise<void> {
    const resource = await this.get(type, id);
    
    const now = new Date().toISOString();
    const updated = {
      ...resource,
      status: ResourceStatus.ARCHIVED,
      version: resource.version + 1,
      updatedAt: now,
    };

    await this.cache.set(updated);
    await this.emitEvent({
      id: uuidv4(),
      type: ResourceEventType.ARCHIVED,
      resourceId: id,
      resourceType: type,
      timestamp: now,
      actor: "system",
      payload: { resource: updated },
    });
  }

  /**
   * Subscribe to resource events
   */
  onEvent(handler: (event: ResourceEvent) => Promise<void>): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Validate a resource
   */
  private async validateResource(resource: Resource): Promise<void> {
    const errors: Record<string, string> = {};

    if (!resource.id) {
      errors.id = "Required";
    }
    if (!resource.type) {
      errors.type = "Required";
    }

    if (Object.keys(errors).length > 0) {
      throw new ResourceValidationError("Invalid resource", errors);
    }
  }

  /**
   * Emit a resource event
   */
  private async emitEvent(event: ResourceEvent): Promise<void> {
    await Promise.all(
      this.eventHandlers.map((handler) => handler(event).catch(console.error))
    );
  }
}