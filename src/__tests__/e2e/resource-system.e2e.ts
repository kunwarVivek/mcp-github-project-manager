import { beforeEach, afterEach, describe, expect, it } from '@jest/globals';
import { ResourceManager } from '../../infrastructure/resource/ResourceManager';
import { ResourceCache } from '../../infrastructure/cache/ResourceCache';
import {
  Resource,
  ResourceType,
  ResourceStatus,
  ResourceEventType,
  ResourceNotFoundError,
  ResourceVersionError,
  mapStatus,
  mapType,
} from '../../domain/resource-types';
import type { Project } from '../../domain/types';
import { TestUtils } from '../test-utils';

describe('Resource System E2E', () => {
  let manager: ResourceManager;
  let cache: ResourceCache;
  const events: any[] = [];

  beforeEach(() => {
    manager = ResourceManager.getInstance();
    cache = ResourceCache.getInstance();
    events.length = 0;

    // Subscribe to resource events
    manager.onEvent(async (event) => {
      events.push(event);
    });

    TestUtils.mockCurrentDate();
  });

  afterEach(() => {
    TestUtils.restoreCurrentDate();
  });

  describe('Resource Lifecycle', () => {
    const projectData = TestUtils.createMockProject({
      title: 'Test Project',
      description: 'Test Description',
      status: ResourceStatus.ACTIVE,
    });

    it('should handle complete resource lifecycle with proper responses', async () => {
      // 1. Create Resource
      const created = await manager.create<Project>(ResourceType.PROJECT, projectData);

      expect(created).toMatchObject({
        title: projectData.title,
        type: ResourceType.PROJECT,
        status: ResourceStatus.ACTIVE,
        version: 1,
      });

      // 2. Verify Cache
      const cached = await cache.get<Project>(ResourceType.PROJECT, created.id);
      expect(cached).toEqual(created);

      // 3. Update Resource
      const updateData = {
        title: 'Updated Project',
        description: 'Updated Description',
      };

      const updateResponse = await manager.update<Project>(
        ResourceType.PROJECT,
        created.id,
        updateData
      );

      expect(updateResponse.version).toBe(2);
      expect(updateResponse.title).toBe(updateData.title);

      // 4. Archive Resource
      await manager.archive(ResourceType.PROJECT, created.id);
      const archivedProject = await manager.get<Project>(
        ResourceType.PROJECT,
        created.id,
        { includeDeleted: true }
      );
      expect(archivedProject.status).toBe(ResourceStatus.ARCHIVED);

      // 5. Delete Resource
      await manager.delete(ResourceType.PROJECT, created.id);

      // 6. Verify Deletion
      await expect(
        manager.get(ResourceType.PROJECT, created.id)
      ).rejects.toThrow(ResourceNotFoundError);

      // 7. Verify Events
      expect(events).toHaveLength(4); // create, update, archive, delete
      expect(events.map(e => e.type)).toEqual([
        ResourceEventType.CREATED,
        ResourceEventType.UPDATED,
        ResourceEventType.ARCHIVED,
        ResourceEventType.DELETED,
      ]);
    });

    it('should handle concurrent operations correctly', async () => {
      // 1. Create initial resource
      const project = await manager.create<Project>(ResourceType.PROJECT, projectData);

      // 2. Simulate concurrent updates
      const updates = await Promise.allSettled([
        manager.update<Project>(
          ResourceType.PROJECT,
          project.id,
          {
            title: 'Update 1',
            version: project.version,
          },
          { optimisticLock: true }
        ),
        manager.update<Project>(
          ResourceType.PROJECT,
          project.id,
          {
            title: 'Update 2',
            version: project.version,
          },
          { optimisticLock: true }
        ),
      ]);

      // 3. Verify only one update succeeded
      expect(updates).toContainEqual(
        expect.objectContaining({
          status: 'fulfilled',
        })
      );
      expect(updates).toContainEqual(
        expect.objectContaining({
          status: 'rejected',
        })
      );

      // 4. Verify final state
      const finalProject = await manager.get<Project>(
        ResourceType.PROJECT,
        project.id
      );
      expect(finalProject.version).toBe(2);
      expect(['Update 1', 'Update 2']).toContain(finalProject.title);
    });

    it('should maintain cache consistency', async () => {
      // 1. Create and verify initial cache state
      const project = await manager.create<Project>(
        ResourceType.PROJECT,
        projectData
      );
      
      let cached = await cache.get<Project>(ResourceType.PROJECT, project.id);
      expect(cached).toEqual(project);

      // 2. Update and verify cache update
      const updateData = {
        title: 'Updated Project',
      };

      const updated = await manager.update<Project>(
        ResourceType.PROJECT,
        project.id,
        updateData
      );
      
      cached = await cache.get<Project>(ResourceType.PROJECT, project.id);
      expect(cached).toEqual(updated);

      // 3. Delete and verify cache removal
      await manager.delete(ResourceType.PROJECT, project.id);
      cached = await cache.get<Project>(ResourceType.PROJECT, project.id);
      expect(cached?.status).toBe(ResourceStatus.DELETED);
    });
  });
});