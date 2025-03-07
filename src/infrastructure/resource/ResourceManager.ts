import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  Resource,
  ResourceType,
  ResourceStatus,
  ResourceEvent,
  ResourceEventType,
  ResourceValidationRule,
  ResourceValidationError,
  ResourceNotFoundError,
  ResourceVersionError,
  ResourceCacheOptions,
  ResourceUpdateOptions,
} from '../../domain/resource-types';
import { ResourceCache } from '../cache/ResourceCache';

export class ResourceManager extends EventEmitter {
  constructor(private cache: ResourceCache) {
    super();
  }

  async create<T extends Resource>(
    type: ResourceType,
    data: Partial<T>,
    options?: {
      validationRules?: ResourceValidationRule[];
      cacheOptions?: ResourceCacheOptions;
    }
  ): Promise<T> {
    if (options?.validationRules) {
      this.validateResource(data, options.validationRules);
    }

    const resource: T = {
      id: uuidv4(),
      type,
      version: 1,
      status: ResourceStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    } as T;

    await this.cache.set(resource.id, resource, options?.cacheOptions);

    this.emit('resource', {
      type: ResourceEventType.CREATED,
      resourceId: resource.id,
      resourceType: resource.type,
      timestamp: resource.createdAt,
      data: resource,
    });

    return resource;
  }

  async get<T extends Resource>(
    type: ResourceType,
    id: string,
    options?: ResourceCacheOptions
  ): Promise<T> {
    const resource = await this.cache.get<T>(id, options);
    if (!resource) {
      throw new ResourceNotFoundError(type, id);
    }
    return resource;
  }

  async update<T extends Resource>(
    type: ResourceType,
    id: string,
    data: Partial<T>,
    options?: {
      validationRules?: ResourceValidationRule[];
      updateOptions?: ResourceUpdateOptions;
      cacheOptions?: ResourceCacheOptions;
    }
  ): Promise<T> {
    const current = await this.get<T>(type, id);

    if (options?.validationRules) {
      this.validateResource({ ...current, ...data }, options.validationRules);
    }

    if (options?.updateOptions?.optimisticLock) {
      if (current.version !== options.updateOptions.expectedVersion) {
        throw new ResourceVersionError(
          type,
          id,
          options.updateOptions.expectedVersion!,
          current.version
        );
      }
    }

    const updated: T = {
      ...current,
      ...data,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };

    await this.cache.set(id, updated, options?.cacheOptions);

    this.emit('resource', {
      type: ResourceEventType.UPDATED,
      resourceId: updated.id,
      resourceType: updated.type,
      timestamp: updated.updatedAt,
      data: updated,
    });

    return updated;
  }

  async delete(type: ResourceType, id: string): Promise<void> {
    const resource = await this.get(type, id);

    const updated = {
      ...resource,
      status: ResourceStatus.DELETED,
      deletedAt: new Date().toISOString(),
      version: resource.version + 1,
      updatedAt: new Date().toISOString(),
    };

    await this.cache.set(id, updated);

    this.emit('resource', {
      type: ResourceEventType.DELETED,
      resourceId: id,
      resourceType: type,
      timestamp: updated.updatedAt,
      data: updated,
    });
  }

  async archive(type: ResourceType, id: string): Promise<void> {
    const resource = await this.get(type, id);

    const updated = {
      ...resource,
      status: ResourceStatus.ARCHIVED,
      version: resource.version + 1,
      updatedAt: new Date().toISOString(),
    };

    await this.cache.set(id, updated);

    this.emit('resource', {
      type: ResourceEventType.ARCHIVED,
      resourceId: id,
      resourceType: type,
      timestamp: updated.updatedAt,
      data: updated,
    });
  }

  async restore(type: ResourceType, id: string): Promise<void> {
    const resource = await this.get(type, id);

    const updated = {
      ...resource,
      status: ResourceStatus.ACTIVE,
      version: resource.version + 1,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    await this.cache.set(id, updated);

    this.emit('resource', {
      type: ResourceEventType.RESTORED,
      resourceId: id,
      resourceType: type,
      timestamp: updated.updatedAt,
      data: updated,
    });
  }

  private validateResource(
    data: any,
    rules: ResourceValidationRule[]
  ): void {
    const errors = rules
      .filter(rule => !rule.validate(data[rule.field]))
      .map(rule => rule.message);

    if (errors.length > 0) {
      throw new ResourceValidationError(`Validation failed: ${errors.join(', ')}`);
    }
  }
}