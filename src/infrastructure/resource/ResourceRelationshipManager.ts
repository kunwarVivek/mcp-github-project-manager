import { Resource, ResourceType, RelationshipType, Relationship, ResourceStatus } from "../../domain/resource-types";
import { ResourceCache } from "../cache/ResourceCache";

export class ResourceRelationshipManager {
  private static RELATIONSHIP_NAMESPACE = "relationships";
  private static RELATIONSHIP_TAG = "relationship";

  constructor(private cache: ResourceCache) {}

  /**
   * Create a relationship between two resources
   */
  async createRelationship(
    sourceId: string,
    sourceType: ResourceType,
    targetId: string,
    targetType: ResourceType,
    relationshipType: RelationshipType,
    metadata?: Record<string, unknown>
  ): Promise<Relationship> {
    // Create a unique ID for the relationship
    const id = `rel_${sourceId}_${targetId}_${relationshipType}`;

    // Create Date objects instead of strings
    const now = new Date();

    const relationship: Relationship = {
      id,
      type: ResourceType.RELATIONSHIP, // Using the RELATIONSHIP ResourceType
      version: 1,
      status: ResourceStatus.ACTIVE,
      createdAt: now.toISOString(), // Convert Date to string
      updatedAt: now.toISOString(), // Convert Date to string
      sourceId,
      sourceType,
      targetId,
      targetType,
      relationshipType
    };

    // Store in cache with appropriate tags
    await this.cache.set(ResourceType.RELATIONSHIP, id, relationship, {
      tags: [
        ResourceRelationshipManager.RELATIONSHIP_TAG,
        `source:${sourceId}`,
        `target:${targetId}`,
        `type:${relationshipType}`,
      ],
      namespaces: [ResourceRelationshipManager.RELATIONSHIP_NAMESPACE],
    });

    return relationship;
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(relationshipId: string): Promise<void> {
    await this.cache.delete(relationshipId);
  }

  /**
   * Get all relationships where a resource is the source
   */
  async getOutgoingRelationships(
    resourceId: string,
    type?: RelationshipType
  ): Promise<Relationship[]> {
    const relationships = await this.cache.getByTag(`source:${resourceId}`) as Relationship[];

    if (!type) {
      return relationships;
    }

    // Make sure to compare relationshipType, not the Resource type
    return relationships.filter(rel => rel.relationshipType === type);
  }

  /**
   * Get all relationships where a resource is the target
   */
  async getIncomingRelationships(
    resourceId: string,
    type?: RelationshipType
  ): Promise<Relationship[]> {
    const relationships = await this.cache.getByTag(`target:${resourceId}`) as Relationship[];

    if (!type) {
      return relationships;
    }

    // Make sure to compare relationshipType, not the Resource type
    return relationships.filter(rel => rel.relationshipType === type);
  }

  /**
   * Get all relationships of a specific type
   */
  async getRelationshipsByType(type: RelationshipType): Promise<Relationship[]> {
    const relationships = await this.cache.getByTag(`type:${type}`);
    // Properly cast the result to Relationship[] instead of just using 'as'
    return relationships.filter(rel =>
      rel.type === ResourceType.RELATIONSHIP &&
      (rel as Relationship).relationshipType === type
    ) as Relationship[];
  }

  /**
   * Get all related resources of a specific type
   */
  async getRelatedResources<T extends Resource>(
    resourceId: string,
    targetType: ResourceType,
    relationshipType?: RelationshipType
  ): Promise<T[]> {
    // Get outgoing relationships that match the criteria
    const relationships = await this.getOutgoingRelationships(resourceId, relationshipType);

    // Filter by target type
    const matchingRelationships = relationships.filter(
      rel => rel.targetType === targetType
    );

    // Get the actual resources
    const resources: T[] = [];
    for (const rel of matchingRelationships) {
      const resource = await this.cache.get<T>(rel.targetType, rel.targetId);
      if (resource) {
        resources.push(resource);
      }
    }

    return resources;
  }

  /**
   * Find resources that depend on the given resource
   */
  async getDependentResources<T extends Resource>(
    resourceId: string
  ): Promise<T[]> {
    // Get incoming dependency relationships
    const relationships = await this.getIncomingRelationships(
      resourceId,
      RelationshipType.DEPENDENCY
    );

    // Get the actual resources
    const resources: T[] = [];
    for (const rel of relationships) {
      const resource = await this.cache.get<T>(rel.sourceType, rel.sourceId);
      if (resource) {
        resources.push(resource);
      }
    }

    return resources;
  }

  /**
   * Find parent resources
   */
  async getParentResources<T extends Resource>(
    resourceId: string
  ): Promise<T[]> {
    // Get incoming parent-child relationships
    const relationships = await this.getIncomingRelationships(
      resourceId,
      RelationshipType.PARENT_CHILD
    );

    // Get the actual resources
    const resources: T[] = [];
    for (const rel of relationships) {
      const resource = await this.cache.get<T>(rel.sourceType, rel.sourceId);
      if (resource) {
        resources.push(resource);
      }
    }

    return resources;
  }

  /**
   * Find child resources
   */
  async getChildResources<T extends Resource>(
    resourceId: string
  ): Promise<T[]> {
    // Get outgoing parent-child relationships
    const relationships = await this.getOutgoingRelationships(
      resourceId,
      RelationshipType.PARENT_CHILD
    );

    // Get the actual resources
    const resources: T[] = [];
    for (const rel of relationships) {
      const resource = await this.cache.get<T>(rel.targetType, rel.targetId);
      if (resource) {
        resources.push(resource);
      }
    }

    return resources;
  }

  /**
   * Delete all relationships for a resource
   */
  async deleteAllRelationships(resourceId: string): Promise<void> {
    const outgoing = await this.getOutgoingRelationships(resourceId);
    const incoming = await this.getIncomingRelationships(resourceId);

    const allRelationships = [...outgoing, ...incoming];

    for (const rel of allRelationships) {
      await this.cache.delete(rel.id);
    }
  }
}