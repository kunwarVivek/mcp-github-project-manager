import { ResourceManager } from "../../infrastructure/resource/ResourceManager";
import { ResourceCache } from "../../infrastructure/cache/ResourceCache";
import { Project, CreateProject } from "../../domain/types";
import { 
  ResourceStatus, 
  ResourceType, 
  ResourceEvent,
  ResourceEventType,
  ResourceNotFoundError,
  ResourceVersionError,
  ResourceValidationError,
  ResourceValidationRule
} from "../../domain/resource-types";
import { TestFactory } from "../test-utils";

describe("Resource System", () => {
  let manager: ResourceManager;
  let cache: ResourceCache;

  beforeEach(() => {
    cache = new ResourceCache();
    manager = new ResourceManager(cache);
  });

  describe("Resource CRUD Operations", () => {
    it("should create a resource", async () => {
      const projectData = {
        title: "Test Project",
        description: "Test Description",
        status: ResourceStatus.ACTIVE,
        visibility: "private" as const,
        views: [],
        fields: []
      };

      const created = await manager.create<Project>(
        ResourceType.PROJECT,
        projectData
      );

      expect(created.id).toBeDefined();
      expect(created.type).toBe(ResourceType.PROJECT);
      expect(created.version).toBe(1);
      expect(created.status).toBe(ResourceStatus.ACTIVE);
      expect(created.title).toBe("Test Project");
    });

    it("should read a cached resource", async () => {
      const projectData = {
        title: "Test Project",
        description: "Test Description",
        status: ResourceStatus.ACTIVE,
        visibility: "private" as const,
        views: [],
        fields: []
      };

      const created = await manager.create<Project>(
        ResourceType.PROJECT,
        projectData
      );
      const cached = await manager.get<Project>(ResourceType.PROJECT, created.id);

      expect(cached).toBeDefined();
      expect(cached.id).toBe(created.id);
      expect(cached.title).toBe(created.title);
    });

    it("should update a resource with version check", async () => {
      const project = await manager.create<Project>(
        ResourceType.PROJECT,
        {
          title: "Original Title",
          description: "Test Description",
          status: ResourceStatus.ACTIVE,
          visibility: "private" as const,
          views: [],
          fields: []
        }
      );

      const updateData = {
        title: "Updated Title",
      };

      const updateResponse = await manager.update<Project>(
        ResourceType.PROJECT,
        project.id,
        updateData,
        {
          updateOptions: { 
            optimisticLock: true, 
            expectedVersion: project.version 
          }
        }
      );

      expect(updateResponse.title).toBe("Updated Title");
      expect(updateResponse.version).toBe(project.version + 1);
    });

    it("should handle version conflicts", async () => {
      const project = await manager.create<Project>(
        ResourceType.PROJECT,
        {
          title: "Test Project",
          description: "Test Description",
          status: ResourceStatus.ACTIVE,
          visibility: "private" as const,
          views: [],
          fields: []
        }
      );

      await expect(
        manager.update<Project>(
          ResourceType.PROJECT,
          project.id,
          { title: "Updated Title" },
          {
            updateOptions: {
              optimisticLock: true,
              expectedVersion: project.version + 1
            }
          }
        )
      ).rejects.toThrow(ResourceVersionError);
    });
  });

  describe("Resource Status Management", () => {
    it("should archive and restore resources", async () => {
      const project = await manager.create<Project>(
        ResourceType.PROJECT,
        {
          title: "Test Project",
          description: "Test Description",
          status: ResourceStatus.ACTIVE,
          visibility: "private" as const,
          views: [],
          fields: []
        }
      );

      await manager.archive(ResourceType.PROJECT, project.id);
      const archivedProject = await manager.get<Project>(ResourceType.PROJECT, project.id);
      expect(archivedProject.status).toBe(ResourceStatus.ARCHIVED);

      await manager.restore(ResourceType.PROJECT, project.id);
      const restoredProject = await manager.get<Project>(ResourceType.PROJECT, project.id);
      expect(restoredProject.status).toBe(ResourceStatus.ACTIVE);
    });

    it("should soft delete resources", async () => {
      const project = await manager.create<Project>(
        ResourceType.PROJECT,
        {
          title: "Test Project",
          description: "Test Description",
          status: ResourceStatus.ACTIVE,
          visibility: "private" as const,
          views: [],
          fields: []
        }
      );

      await manager.delete(ResourceType.PROJECT, project.id);
      const deletedProject = await manager.get<Project>(
        ResourceType.PROJECT,
        project.id,
        { includeDeleted: true }
      );

      expect(deletedProject.status).toBe(ResourceStatus.DELETED);
      expect(deletedProject.deletedAt).toBeDefined();
    });
  });

  describe("Resource Events", () => {
    it("should emit events for resource operations", async () => {
      const events: ResourceEvent[] = [];
      manager.on('resource', (event: ResourceEvent) => events.push(event));

      const project = await manager.create<Project>(
        ResourceType.PROJECT,
        {
          title: "Test Project",
          description: "Test Description",
          status: ResourceStatus.ACTIVE,
          visibility: "private" as const,
          views: [],
          fields: []
        }
      );

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(ResourceEventType.CREATED);
      expect(events[0].resourceId).toBe(project.id);
      expect(events[0].resourceType).toBe(ResourceType.PROJECT);
    });
  });
});