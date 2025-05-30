// Unmock ResourceCache for E2E tests
jest.unmock("../../infrastructure/cache/ResourceCache");

import { ResourceManager } from "../../infrastructure/resource/ResourceManager";
import { ResourceCache } from "../../infrastructure/cache/ResourceCache";
import { BaseProjectResource } from "../../domain/project-types";
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

  beforeEach(async () => {
    cache = new ResourceCache();
    manager = new ResourceManager(cache);
  });

  describe("Resource CRUD Operations", () => {
    it("should create a resource", async () => {
      const projectData = {
        title: "Test Project",
        description: "Test Description",
        status: ResourceStatus.ACTIVE
      };

      const created = await manager.create<BaseProjectResource>(
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
        status: ResourceStatus.ACTIVE
      };

      const created = await manager.create<BaseProjectResource>(
        ResourceType.PROJECT,
        projectData
      );



      const cached = await manager.get<BaseProjectResource>(ResourceType.PROJECT, created.id);

      expect(cached).toBeDefined();
      expect(cached.id).toBe(created.id);
      expect(cached.title).toBe(created.title);
    });

    it("should update a resource with version check", async () => {
      const project = await manager.create<BaseProjectResource>(
        ResourceType.PROJECT,
        {
          title: "Original Title",
          description: "Test Description",
          status: ResourceStatus.ACTIVE
        }
      );

      const updateData = {
        title: "Updated Title",
      };

      const updateResponse = await manager.update<BaseProjectResource>(
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
      expect(updateResponse.version).toBe((project.version || 0) + 1);
    });

    it("should handle version conflicts", async () => {
      const project = await manager.create<BaseProjectResource>(
        ResourceType.PROJECT,
        {
          title: "Test Project",
          description: "Test Description",
          status: ResourceStatus.ACTIVE
        }
      );

      await expect(
        manager.update<BaseProjectResource>(
          ResourceType.PROJECT,
          project.id,
          { title: "Updated Title" },
          {
            updateOptions: {
              optimisticLock: true,
              expectedVersion: (project.version || 0) + 1
            }
          }
        )
      ).rejects.toThrow(ResourceVersionError);
    });
  });

  describe("Resource Status Management", () => {
    it("should archive and restore resources", async () => {
      const project = await manager.create<BaseProjectResource>(
        ResourceType.PROJECT,
        {
          title: "Test Project",
          description: "Test Description",
          status: ResourceStatus.ACTIVE
        }
      );

      await manager.archive(ResourceType.PROJECT, project.id);
      const archivedProject = await manager.get<BaseProjectResource>(ResourceType.PROJECT, project.id);
      expect(archivedProject.status).toBe(ResourceStatus.ARCHIVED);

      await manager.restore(ResourceType.PROJECT, project.id);
      const restoredProject = await manager.get<BaseProjectResource>(ResourceType.PROJECT, project.id);
      expect(restoredProject.status).toBe(ResourceStatus.ACTIVE);
    });

    it("should soft delete resources", async () => {
      const project = await manager.create<BaseProjectResource>(
        ResourceType.PROJECT,
        {
          title: "Test Project",
          description: "Test Description",
          status: ResourceStatus.ACTIVE
        }
      );

      await manager.delete(ResourceType.PROJECT, project.id);
      const deletedProject = await manager.get<BaseProjectResource>(
        ResourceType.PROJECT,
        project.id
      );

      expect(deletedProject.status).toBe(ResourceStatus.DELETED);
      expect(deletedProject.deletedAt).toBeDefined();
    });
  });

  describe("Resource Events", () => {
    it("should emit events for resource operations", async () => {
      const events: any[] = [];
      manager.on('resource', (event: any) => events.push(event));

      const project = await manager.create<BaseProjectResource>(
        ResourceType.PROJECT,
        {
          title: "Test Project",
          description: "Test Description",
          status: ResourceStatus.ACTIVE
        }
      );

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(ResourceEventType.CREATED);
      expect(events[0].resourceId).toBe(project.id);
      expect(events[0].resourceType).toBe(ResourceType.PROJECT);
    });
  });
});