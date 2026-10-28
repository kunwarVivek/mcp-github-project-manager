import { beforeEach, describe, expect, it, type Mocked, vi } from "vitest";
import {
  type Resource,
  ResourceNotFoundError,
  ResourceStatus,
  ResourceType,
} from "../../../../domain/resource-types";
import { ResourceManager } from "../../../../infrastructure/resource/ResourceManager";

// Mock the ResourceCache class
vi.mock("../../../../infrastructure/cache/ResourceCache", () => {
  return {
    ResourceCache: vi.fn().mockImplementation(function () {
      return {
        set: vi.fn(),
        get: vi.fn(),
        getByType: vi.fn(),
        getByTags: vi.fn(),
        getByNamespace: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        invalidateByTags: vi.fn(),
        invalidateByType: vi.fn(),
        invalidateByNamespace: vi.fn(),
      };
    }),
  };
});

import { ResourceCache } from "../../../../infrastructure/cache/ResourceCache";

/** Minimal titled resource used to exercise create(). */
interface TitledResource extends Resource {
  title: string;
  description: string;
  owner: string;
}

describe("ResourceManager", () => {
  let resourceManager: ResourceManager;
  let mockCache: Mocked<ResourceCache>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create a new instance of the mocked ResourceCache
    mockCache = vi.mocked(new ResourceCache());

    // Create resourceManager with mocked cache
    resourceManager = new ResourceManager(mockCache);
  });

  it("should initialize correctly", () => {
    expect(resourceManager).toBeDefined();
  });

  it("should create a resource successfully", async () => {
    // Setup
    const resourceData: Partial<TitledResource> = {
      title: "Test Resource",
      description: "This is a test resource",
      owner: "test-owner",
      // Add any other required fields for a project resource if needed
    };
    // Execute
    const resource = await resourceManager.create<TitledResource>(
      ResourceType.PROJECT,
      resourceData
    );
    // Verify
    expect(resource).toBeDefined();
    expect(resource.id).toBeDefined();
    expect(resource.type).toBe(ResourceType.PROJECT);
    expect(resource.status).toBe(ResourceStatus.ACTIVE);
    expect(resource.title).toBe("Test Resource");
    // createdAt and updatedAt should be ISO strings convertible to Date
    expect(typeof resource.createdAt).toBe("string");
    expect(resource.createdAt).toBeTruthy();
    expect(new Date(resource.createdAt).toString()).not.toBe("Invalid Date");
    if (resource.updatedAt) {
      expect(typeof resource.updatedAt).toBe("string");
      expect(new Date(resource.updatedAt).toString()).not.toBe("Invalid Date");
    }
    expect(mockCache.set).toHaveBeenCalledWith(resource.type, resource.id, resource, undefined);
  });

  it("should retrieve a resource by ID", async () => {
    // Setup
    const mockResource = {
      id: "test-123",
      type: ResourceType.PROJECT,
      status: ResourceStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      title: "Test Resource",
    };
    mockCache.get.mockResolvedValueOnce(mockResource);

    // Execute
    const resource = await resourceManager.get(ResourceType.PROJECT, "test-123");

    // Verify
    expect(resource).toBe(mockResource);
    expect(mockCache.get).toHaveBeenCalledWith(ResourceType.PROJECT, "test-123");
  });

  it("should throw NotFoundError when resource is not found", async () => {
    // Setup
    mockCache.get.mockResolvedValueOnce(null);

    // Execute & Verify
    await expect(resourceManager.get(ResourceType.PROJECT, "non-existent")).rejects.toThrow(
      ResourceNotFoundError
    );
  });
});
