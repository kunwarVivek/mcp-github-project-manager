import { ResourceManager } from "./ResourceManager";
import { ResourceCache } from "../cache/ResourceCache";
import { ResourceRelationshipManager } from "./ResourceRelationshipManager";
import { Resource, ResourceType, RelationshipType } from "../../domain/resource-types";

/**
 * Factory class for accessing the MCP Resource system
 * This is the main entry point for working with resources
 */
export class ResourceFactory {
  private static instance: ResourceFactory;
  private resourceManager: ResourceManager;
  private relationshipManager: ResourceRelationshipManager;
  private cache: ResourceCache;

  private constructor() {
    this.cache = new ResourceCache();
    this.resourceManager = new ResourceManager(this.cache);
    this.relationshipManager = new ResourceRelationshipManager(this.cache);
  }

  /**
   * Get the singleton instance of ResourceFactory
   */
  public static getInstance(): ResourceFactory {
    if (!ResourceFactory.instance) {
      ResourceFactory.instance = new ResourceFactory();
    }
    return ResourceFactory.instance;
  }

  /**
   * Get the resource manager
   */
  public getResourceManager(): ResourceManager {
    return this.resourceManager;
  }

  /**
   * Get the relationship manager
   */
  public getRelationshipManager(): ResourceRelationshipManager {
    return this.relationshipManager;
  }

  /**
   * Get the resource cache
   */
  public getCache(): ResourceCache {
    return this.cache;
  }

  /**
   * Create a resource with relationship in a single operation
   */
  public async createResourceWithRelationship<T extends Resource>(
    parentId: string | null,
    parentType: ResourceType | null,
    resourceType: ResourceType,
    resourceData: Partial<T>
  ): Promise<T> {
    // Create the resource first
    const resource = await this.resourceManager.create<T>(
      resourceType,
      resourceData
    );

    // Create a parent-child relationship if parent ID is provided
    if (parentId && parentType) {
      await this.relationshipManager.createRelationship(
        parentId,
        parentType,
        resource.id,
        resourceType,
        RelationshipType.PARENT_CHILD
      );
    }

    return resource;
  }

  /**
   * Create a dependency relationship between resources
   */
  public async createDependency(
    dependentId: string,
    dependentType: ResourceType,
    dependencyId: string,
    dependencyType: ResourceType
  ): Promise<void> {
    await this.relationshipManager.createRelationship(
      dependentId,
      dependentType,
      dependencyId,
      dependencyType,
      RelationshipType.DEPENDENCY
    );
  }

  /**
   * Delete a resource and all its relationships
   */
  public async deleteResourceWithRelationships(
    type: ResourceType,
    id: string
  ): Promise<void> {
    // Delete all relationships first
    await this.relationshipManager.deleteAllRelationships(id);
    
    // Then delete the resource
    await this.resourceManager.delete(type, id);
  }

  /**
   * Get a resource with its children
   */
  public async getResourceWithChildren<T extends Resource, C extends Resource>(
    type: ResourceType,
    id: string,
    childType?: ResourceType
  ): Promise<{ resource: T; children: C[] }> {
    const resource = await this.resourceManager.get<T>(type, id);
    
    // Get children with optional type filtering
    const children = await this.relationshipManager.getChildResources<C>(id);
    
    // Filter by child type if specified
    const filteredChildren = childType 
      ? children.filter(child => child.type === childType)
      : children;
    
    return {
      resource,
      children: filteredChildren,
    };
  }

  /**
   * Get a resource with its parent
   */
  public async getResourceWithParent<T extends Resource, P extends Resource>(
    type: ResourceType, 
    id: string
  ): Promise<{ resource: T; parent: P | null }> {
    const resource = await this.resourceManager.get<T>(type, id);
    
    // Get parents (should be at most one)
    const parents = await this.relationshipManager.getParentResources<P>(id);
    
    return {
      resource,
      parent: parents.length > 0 ? parents[0] : null,
    };
  }
}