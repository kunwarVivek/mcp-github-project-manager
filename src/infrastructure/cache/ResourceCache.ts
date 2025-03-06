import { Resource, ResourceType, ResourceCacheOptions } from "../../domain/resource-types";

interface CacheProvider {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, options?: ResourceCacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  clear(pattern?: string): Promise<void>;
}

class InMemoryCacheProvider implements CacheProvider {
  private cache = new Map<string, { value: unknown; expires?: number }>();

  async get(key: string): Promise<unknown | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expires && entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: unknown, options?: ResourceCacheOptions): Promise<void> {
    const expires = options?.ttl ? Date.now() + options.ttl * 1000 : undefined;
    this.cache.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export class ResourceCache {
  private static instance: ResourceCache;
  private provider: CacheProvider;

  private constructor() {
    this.provider = new InMemoryCacheProvider();
  }

  static getInstance(): ResourceCache {
    if (!ResourceCache.instance) {
      ResourceCache.instance = new ResourceCache();
    }
    return ResourceCache.instance;
  }

  setProvider(provider: CacheProvider): void {
    this.provider = provider;
  }

  private generateKey(type: ResourceType, id: string): string {
    return `${type}:${id}`;
  }

  async get<T extends Resource>(type: ResourceType, id: string): Promise<T | null> {
    try {
      const key = this.generateKey(type, id);
      const cached = await this.provider.get(key);
      return cached as T || null;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  async set(resource: Resource, options?: ResourceCacheOptions): Promise<void> {
    try {
      const key = this.generateKey(resource.type, resource.id);
      await this.provider.set(key, resource, options);

      // If tags are provided, create tag-based indices
      if (options?.tags?.length) {
        for (const tag of options.tags) {
          const tagKey = `tag:${tag}:${resource.type}`;
          const taggedIds = (await this.provider.get(tagKey) as string[]) || [];
          if (!taggedIds.includes(resource.id)) {
            taggedIds.push(resource.id);
            await this.provider.set(tagKey, taggedIds);
          }
        }
      }
    } catch (error) {
      console.error("Cache set error:", error);
    }
  }

  async delete(type: ResourceType, id: string): Promise<void> {
    try {
      const key = this.generateKey(type, id);
      await this.provider.delete(key);
    } catch (error) {
      console.error("Cache delete error:", error);
    }
  }

  async clearByType(type: ResourceType): Promise<void> {
    try {
      await this.provider.clear(`^${type}:`);
    } catch (error) {
      console.error("Cache clear error:", error);
    }
  }

  async clearByTag(tag: string): Promise<void> {
    try {
      const tagPattern = `^tag:${tag}:`;
      await this.provider.clear(tagPattern);
    } catch (error) {
      console.error("Cache clear by tag error:", error);
    }
  }

  async getByTag<T extends Resource>(tag: string, type: ResourceType): Promise<T[]> {
    try {
      const tagKey = `tag:${tag}:${type}`;
      const ids = (await this.provider.get(tagKey) as string[]) || [];
      const resources: T[] = [];

      for (const id of ids) {
        const resource = await this.get<T>(type, id);
        if (resource) {
          resources.push(resource);
        }
      }

      return resources;
    } catch (error) {
      console.error("Cache get by tag error:", error);
      return [];
    }
  }
}