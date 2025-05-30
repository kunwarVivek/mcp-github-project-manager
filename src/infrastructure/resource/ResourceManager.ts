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
  RelationshipType,
} from '../../domain/resource-types';
import { ResourceCache } from '../cache/ResourceCache';
import {
  ResourceSchema,
  ResourceSchemaMap,
  validateResourceByType,
  resourceSchemas
} from '../../domain/resource-schemas';

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
    // Create the resource
    const now = new Date().toISOString();
    const resource: T = {
      id: uuidv4(),
      type,
      version: 1,
      status: ResourceStatus.ACTIVE,
      createdAt: now, // Use ISO string
      updatedAt: now, // Use ISO string
      ...data,
    } as T;

    // Validate with Zod schema if available
    const schema = resourceSchemas[type]; // Use the exported variable instead of the type
    if (schema) {
      try {
        schema.parse(resource); // This will throw if validation fails
      } catch (error) {
        throw new ResourceValidationError(
          type,
          `Zod validation failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Also validate with legacy validation rules if provided
    if (options?.validationRules) {
      this.validateResource(data, options.validationRules);
    }

    await this.cache.set(resource.type, resource.id, resource, options?.cacheOptions);

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
    id: string
  ): Promise<T> {
    const resource = await this.cache.get<T>(type, id);

    if (!resource) {
      throw new ResourceNotFoundError(type, id);
    }

    if (resource.type !== type) {
      throw new ResourceValidationError(
        type,
        `Found resource with type ${resource.type} instead of ${type}`
      );
    }

    return resource;
  }

  async getAll<T extends Resource>(
    type: ResourceType,
    options?: {
      status?: ResourceStatus;
      filter?: (resource: T) => boolean;
    }
  ): Promise<T[]> {
    const resources = await this.cache.getByType<T>(type);

    return resources.filter(
      resource =>
        (options?.status === undefined || resource.status === options.status) &&
        (options?.filter === undefined || options.filter(resource))
    );
  }

  async getByIds<T extends Resource>(
    type: ResourceType,
    ids: string[]
  ): Promise<T[]> {
    const resources = await Promise.all(
      ids.map(async id => {
        try {
          return await this.get<T>(type, id);
        } catch (e) {
          if (e instanceof ResourceNotFoundError) {
            return null;
          }
          throw e;
        }
      })
    );

    // Fix the type predicate issue
    return resources.filter((resource): resource is Awaited<T> =>
      resource !== null
    ) as unknown as T[];
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

    // Handle the case where version is undefined
    const currentVersion = current.version ?? 0;

    const updated: T = {
      ...current,
      ...data,
      version: currentVersion + 1,
      updatedAt: new Date().toISOString(), // Use ISO string
    };

    // Validate with Zod schema if available
    const schema = resourceSchemas[type];
    if (schema) {
      try {
        schema.parse(updated);
      } catch (error) {
        throw new ResourceValidationError(
          type,
          `Zod validation failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Also validate with legacy validation rules if provided
    if (options?.validationRules) {
      this.validateResource(updated, options.validationRules);
    }

    // Check for optimistic locking
    if (options?.updateOptions?.optimisticLock && options.updateOptions.expectedVersion !== undefined) {
      if (currentVersion !== options.updateOptions.expectedVersion) {
        throw new ResourceVersionError(
          type,
          id,
          currentVersion,
          options.updateOptions.expectedVersion
        );
      }
    }

    await this.cache.set(type, id, updated, options?.cacheOptions);

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
    const now = new Date().toISOString();

    // Handle the case where version might be undefined
    const currentVersion = resource.version ?? 0;

    const updated = {
      ...resource,
      status: ResourceStatus.DELETED,
      deletedAt: now, // Use ISO string
      version: currentVersion + 1,
      updatedAt: now, // Use ISO string
    };

    await this.cache.set(type, id, updated);

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
    const now = new Date().toISOString();

    // Handle the case where version might be undefined
    const currentVersion = resource.version ?? 0;

    const updated = {
      ...resource,
      status: ResourceStatus.ARCHIVED,
      version: currentVersion + 1,
      updatedAt: now, // Use ISO string
    };

    await this.cache.set(type, id, updated);

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
    const now = new Date().toISOString();

    const updated = {
      ...resource,
      status: ResourceStatus.ACTIVE,
      version: resource.version ? resource.version + 1 : 1,
      updatedAt: now, // Use ISO string
      deletedAt: undefined, // Changed from null to undefined
    };

    await this.cache.set(type, id, updated);

    this.emit('resource', {
      type: ResourceEventType.RESTORED,
      resourceId: id,
      resourceType: type,
      timestamp: updated.updatedAt,
      data: updated,
    });
  }

  async createRelationship(
    sourceType: ResourceType,
    sourceId: string,
    relationshipType: RelationshipType,
    targetType: ResourceType,
    targetId: string
  ): Promise<void> {
    // Verify both resources exist
    await this.get(sourceType, sourceId);
    await this.get(targetType, targetId);

    // Store the relationship
    await this.cache.setRelationship(
      sourceId,
      relationshipType,
      targetId
    );

    this.emit('resource', {
      type: ResourceEventType.RELATIONSHIP_CREATED,
      resourceId: sourceId,
      resourceType: sourceType,
      timestamp: new Date(),
      data: {
        sourceId,
        relationshipType,
        targetId,
      },
    });
  }

  async getRelatedResources<T extends Resource>(
    type: ResourceType,
    id: string,
    relationshipType: RelationshipType,
    targetType: ResourceType
  ): Promise<T[]> {
    // Verify source resource exists
    await this.get(type, id);

    // Get related resource IDs
    const relatedIds = await this.cache.getRelationships(id, relationshipType);

    // Get all related resources
    return this.getByIds<T>(targetType, relatedIds);
  }

  async removeRelationship(
    sourceType: ResourceType,
    sourceId: string,
    relationshipType: RelationshipType,
    targetId: string
  ): Promise<void> {
    // Verify source resource exists
    await this.get(sourceType, sourceId);

    // Remove the relationship
    await this.cache.removeRelationship(sourceId, relationshipType, targetId);

    this.emit('resource', {
      type: ResourceEventType.RELATIONSHIP_REMOVED,
      resourceId: sourceId,
      resourceType: sourceType,
      timestamp: new Date(),
      data: {
        sourceId,
        relationshipType,
        targetId,
      },
    });
  }

  private validateResource(
    data: any,
    rules: ResourceValidationRule[]
  ): void {
    const errors = rules
      .filter(rule => !rule.validate(data))
      .map(rule => rule.getErrorMessage(data));

    if (errors.length > 0) {
      throw new ResourceValidationError(
        data.type,
        `Validation failed: ${errors.join(', ')}`
      );
    }
  }

  // Modified method to work with the validateResource function that returns string[] instead of validation result
  validateWithZod(type: ResourceType, data: unknown): any {
    try {
      return validateResourceByType(type, data);
    } catch (error) {
      throw new ResourceValidationError(
        type,
        `Validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}