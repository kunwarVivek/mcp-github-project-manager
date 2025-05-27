import { Resource, ResourceCacheOptions, ResourceType } from "../../domain/resource-types";
import { SyncMetadata } from "../../services/GitHubStateSyncService";

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
  tags?: string[];
  namespace?: string;
  lastModified?: string;
  version?: number;
}

export class ResourceCache {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number = 3600000; // 1 hour in milliseconds
  private tagIndex: Map<string, Set<string>>;
  private typeIndex: Map<ResourceType, Set<string>>;
  private namespaceIndex: Map<string, Set<string>>;
  private static instance: ResourceCache;

  constructor() {
    this.cache = new Map();
    this.tagIndex = new Map();
    this.typeIndex = new Map();
    this.namespaceIndex = new Map();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ResourceCache {
    if (!ResourceCache.instance) {
      ResourceCache.instance = new ResourceCache();
    }
    return ResourceCache.instance;
  }



  /**
   * Set resource with type information for persistence
   */
  async set<T>(
    type: ResourceType,
    id: string,
    value: T,
    options?: ResourceCacheOptions
  ): Promise<void> {
    const ttl = options?.ttl || this.defaultTTL;
    const expiresAt = Date.now() + ttl;
    const tags = options?.tags || [];
    const namespaces = options?.namespaces || [];

    // Cache the resource
    const entry: CacheEntry<T> = {
      value,
      expiresAt,
      tags,
      lastModified: (value as any).updatedAt || new Date().toISOString(),
      version: (value as any).version || 1,
    };

    const cacheKey = this.getCacheKey(type, id);
    this.cache.set(cacheKey, entry);

    // Index by type
    this.addToTypeIndex(type, cacheKey);

    // Index by tags
    if (tags.length > 0) {
      this.addToTagIndex(cacheKey, tags);
    }

    // Index by namespaces
    if (namespaces.length > 0) {
      namespaces.forEach((namespace: string) => {
        this.addToNamespaceIndex(namespace, cacheKey);
      });
    }
  }

  /**
   * Get resource by type and ID
   */
  async get<T extends Resource>(
    type: ResourceType,
    id: string,
    options?: ResourceCacheOptions
  ): Promise<T | null> {
    const cacheKey = this.getCacheKey(type, id);
    const entry = this.cache.get(cacheKey) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.removeFromIndices(cacheKey, entry);
      this.cache.delete(cacheKey);
      return null;
    }

    // Check if deleted and if we should include deleted resources
    if (options?.includeDeleted === false && this.isDeleted(entry.value)) {
      return null;
    }

    // Check if it matches the required tags
    if (options?.tags?.length) {
      if (!this.hasMatchingTags(entry, options.tags)) {
        return null;
      }
    }

    return entry.value;
  }



  async getByType<T extends Resource>(
    type: ResourceType,
    options?: ResourceCacheOptions
  ): Promise<T[]> {
    const ids = this.typeIndex.get(type);
    if (!ids || ids.size === 0) {
      return [];
    }

    const resources: T[] = [];
    for (const id of ids) {
      // Parse the cache key to get the actual resource ID
      const parsed = this.parseCacheKey(id);
      if (parsed) {
        const resource = await this.get<T>(parsed.type, parsed.id, options);
        if (resource) {
          resources.push(resource);
        }
      }
    }

    return resources;
  }

  async getByTag<T extends Resource>(
    tag: string,
    type?: ResourceType,
    options?: ResourceCacheOptions
  ): Promise<T[]> {
    const ids = this.tagIndex.get(tag);
    if (!ids || ids.size === 0) {
      return [];
    }

    const resources: T[] = [];
    for (const id of ids) {
      const parsed = this.parseCacheKey(id);
      if (parsed) {
        const resource = await this.get<T>(parsed.type, parsed.id, options);
        if (resource && (!type || resource.type === type)) {
          resources.push(resource);
        }
      }
    }

    return resources;
  }

  async getByNamespace<T extends Resource>(
    namespace: string,
    options?: ResourceCacheOptions
  ): Promise<T[]> {
    const ids = this.namespaceIndex.get(namespace);
    if (!ids || ids.size === 0) {
      return [];
    }

    const resources: T[] = [];
    for (const id of ids) {
      const parsed = this.parseCacheKey(id);
      if (parsed) {
        const resource = await this.get<T>(parsed.type, parsed.id, options);
        if (resource) {
          resources.push(resource);
        }
      }
    }

    return resources;
  }

  async delete(id: string): Promise<void> {
    const entry = this.cache.get(id);
    if (entry) {
      this.removeFromIndices(id, entry);
      this.cache.delete(id);
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.tagIndex.clear();
    this.typeIndex.clear();
    this.namespaceIndex.clear();
  }

  async clearByType(type: ResourceType): Promise<void> {
    const ids = this.typeIndex.get(type);
    if (!ids) {
      return;
    }

    // Create a copy to iterate through since we'll be modifying the set
    const idsCopy = new Set(ids);
    for (const id of idsCopy) {
      await this.delete(id);
    }

    this.typeIndex.delete(type);
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    const idsToRemove = new Set<string>();

    for (const tag of tags) {
      const taggedIds = this.tagIndex.get(tag);
      if (taggedIds) {
        for (const id of taggedIds) {
          idsToRemove.add(id);
        }
      }
    }

    for (const id of idsToRemove) {
      await this.delete(id);
    }
  }

  async invalidateByPattern(pattern: string | RegExp): Promise<void> {
    const regex = typeof pattern === 'string'
      ? new RegExp(pattern.replace(/\*/g, '.*'))
      : pattern;

    const idsToRemove: string[] = [];

    for (const id of this.cache.keys()) {
      if (regex.test(id)) {
        idsToRemove.push(id);
      }
    }

    for (const id of idsToRemove) {
      await this.delete(id);
    }
  }

  async setTags(id: string, tags: string[]): Promise<void> {
    const entry = this.cache.get(id);
    if (!entry) {
      return;
    }

    // Remove from existing tag indices
    if (entry.tags) {
      for (const tag of entry.tags) {
        const taggedIds = this.tagIndex.get(tag);
        if (taggedIds) {
          taggedIds.delete(id);
          if (taggedIds.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      }
    }

    // Update tags
    entry.tags = tags;
    this.cache.set(id, entry);

    // Add to new tag indices
    this.addToTagIndex(id, tags);
  }

  async refresh(id: string, ttl?: number): Promise<void> {
    const entry = this.cache.get(id);
    if (!entry) {
      return;
    }

    const newTtl = ttl || this.defaultTTL;
    entry.expiresAt = Date.now() + newTtl;
    this.cache.set(id, entry);
  }

  // Relationship management methods
  async setRelationship(sourceId: string, relationshipType: string, targetId: string): Promise<void> {
    const relationshipKey = this.getRelationshipKey(sourceId, relationshipType, targetId);

    // Create a simple relationship entry
    const entry: CacheEntry<any> = {
      value: {
        sourceId,
        relationshipType,
        targetId
      }
    };

    this.cache.set(relationshipKey, entry);

    // Also keep an index of relationships by source id and type
    const sourceTypeKey = `relationship:${sourceId}:${relationshipType}`;
    let relationships = this.cache.get(sourceTypeKey);

    if (!relationships) {
      relationships = {
        value: new Set<string>()
      };
      this.cache.set(sourceTypeKey, relationships);
    }

    relationships.value.add(targetId);
  }

  async getRelationships(sourceId: string, relationshipType: string): Promise<string[]> {
    const sourceTypeKey = `relationship:${sourceId}:${relationshipType}`;
    const relationships = this.cache.get(sourceTypeKey);

    if (!relationships) {
      return [];
    }

    return Array.from(relationships.value);
  }

  async removeRelationship(sourceId: string, relationshipType: string, targetId: string): Promise<void> {
    const relationshipKey = this.getRelationshipKey(sourceId, relationshipType, targetId);

    // Remove the relationship entry
    this.cache.delete(relationshipKey);

    // Update the relationship index
    const sourceTypeKey = `relationship:${sourceId}:${relationshipType}`;
    const relationships = this.cache.get(sourceTypeKey);

    if (relationships) {
      relationships.value.delete(targetId);

      // If no more relationships of this type, remove the index entry
      if (relationships.value.size === 0) {
        this.cache.delete(sourceTypeKey);
      }
    }
  }

  private getRelationshipKey(sourceId: string, relationshipType: string, targetId: string): string {
    return `relationship:${sourceId}:${relationshipType}:${targetId}`;
  }

  private isDeleted(value: Resource): boolean {
    return value.deletedAt !== null && value.deletedAt !== undefined;
  }

  private hasMatchingTags(entry: CacheEntry<any>, tags: string[]): boolean {
    if (!entry.tags || entry.tags.length === 0) return false;
    return tags.some(tag => entry.tags!.includes(tag));
  }

  private addToTagIndex(id: string, tags: string[]): void {
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(id);
    }
  }

  private addToTypeIndex(type: ResourceType, id: string): void {
    if (!this.typeIndex.has(type)) {
      this.typeIndex.set(type, new Set());
    }
    this.typeIndex.get(type)!.add(id);
  }

  private addToNamespaceIndex(namespace: string, id: string): void {
    if (!this.namespaceIndex.has(namespace)) {
      this.namespaceIndex.set(namespace, new Set());
    }
    this.namespaceIndex.get(namespace)!.add(id);
  }

  private removeFromIndices(id: string, entry: CacheEntry<any>): void {
    // Remove from tag index
    if (entry.tags) {
      for (const tag of entry.tags) {
        const taggedIds = this.tagIndex.get(tag);
        if (taggedIds) {
          taggedIds.delete(id);
          if (taggedIds.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      }
    }

    // Remove from type index
    if (entry.value && entry.value.type) {
      const type = entry.value.type;
      const typeIds = this.typeIndex.get(type);
      if (typeIds) {
        typeIds.delete(id);
        if (typeIds.size === 0) {
          this.typeIndex.delete(type);
        }
      }
    }

    // Remove from namespace index
    if (entry.namespace) {
      const namespaceIds = this.namespaceIndex.get(entry.namespace);
      if (namespaceIds) {
        namespaceIds.delete(id);
        if (namespaceIds.size === 0) {
          this.namespaceIndex.delete(entry.namespace);
        }
      }
    }
  }

  // Utility methods for testing and monitoring
  getSize(): number {
    return this.cache.size;
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  getTags(id: string): string[] | undefined {
    return this.cache.get(id)?.tags;
  }

  getStats(): {
    size: number;
    tagCount: number;
    typeCount: number;
    namespaceCount: number;
  } {
    return {
      size: this.cache.size,
      tagCount: this.tagIndex.size,
      typeCount: this.typeIndex.size,
      namespaceCount: this.namespaceIndex.size,
    };
  }

  /**
   * Get cache key for type and ID
   */
  private getCacheKey(type: ResourceType, id: string): string {
    return `${type}:${id}`;
  }

  /**
   * Parse cache key to get type and ID
   */
  private parseCacheKey(cacheKey: string): { type: ResourceType; id: string } | null {
    const parts = cacheKey.split(':');
    if (parts.length < 2) {
      return null;
    }

    const type = parts[0] as ResourceType;
    const id = parts.slice(1).join(':'); // Handle IDs that might contain colons

    return { type, id };
  }

  /**
   * Check if a resource needs syncing based on metadata
   */
  needsSync(type: ResourceType, id: string): boolean {
    const cacheKey = this.getCacheKey(type, id);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return true; // Not in cache, needs sync
    }

    // Check if cache entry is stale (older than 5 minutes)
    const cacheAge = Date.now() - (entry.expiresAt || 0);
    const maxCacheAge = 5 * 60 * 1000; // 5 minutes

    return cacheAge > maxCacheAge;
  }

  /**
   * Get metadata for all cached resources
   */
  getAllMetadata(): SyncMetadata[] {
    const metadata: SyncMetadata[] = [];

    for (const [cacheKey, entry] of this.cache.entries()) {
      const parsed = this.parseCacheKey(cacheKey);
      if (!parsed) {
        continue; // Skip invalid cache keys
      }

      metadata.push({
        resourceId: parsed.id,
        resourceType: parsed.type,
        lastModified: entry.lastModified || new Date().toISOString(),
        version: entry.version || 1,
        syncedAt: new Date().toISOString()
      });
    }

    return metadata;
  }

  /**
   * Get metadata for a specific resource
   */
  getMetadata(type: ResourceType, id: string): SyncMetadata | null {
    const cacheKey = this.getCacheKey(type, id);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    return {
      resourceId: id,
      resourceType: type,
      lastModified: entry.lastModified || new Date().toISOString(),
      version: entry.version || 1,
      syncedAt: new Date().toISOString()
    };
  }

  /**
   * Update metadata for a resource without changing the cached value
   */
  updateMetadata(type: ResourceType, id: string, metadata: Partial<SyncMetadata>): void {
    const cacheKey = this.getCacheKey(type, id);
    const entry = this.cache.get(cacheKey);

    if (entry) {
      if (metadata.lastModified) {
        entry.lastModified = metadata.lastModified;
      }
      if (metadata.version) {
        entry.version = metadata.version;
      }

      this.cache.set(cacheKey, entry);
    }
  }

  /**
   * Invalidate cache entry for a specific resource
   */
  invalidate(type: ResourceType, id: string): void {
    const cacheKey = this.getCacheKey(type, id);
    const entry = this.cache.get(cacheKey);

    if (entry) {
      this.removeFromIndices(cacheKey, entry);
      this.cache.delete(cacheKey);
    }
  }

  /**
   * Get all cached resources of a specific type
   */
  getAllByType<T>(type: ResourceType): T[] {
    const resources: T[] = [];

    for (const [cacheKey, entry] of this.cache.entries()) {
      const parsed = this.parseCacheKey(cacheKey);
      if (parsed && parsed.type === type) {
        // Check if expired
        if (!entry.expiresAt || Date.now() <= entry.expiresAt) {
          resources.push(entry.value);
        }
      }
    }

    return resources;
  }

  /**
   * Warm cache with initial data
   */
  warmCache(type: ResourceType, resources: any[]): void {
    for (const resource of resources) {
      const id = resource.id?.toString() || resource.number?.toString();
      if (id) {
        this.set(type, id, resource);
      }
    }
  }
}