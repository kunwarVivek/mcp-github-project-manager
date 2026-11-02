import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ResourceType, type SyncMetadata } from "../../../domain/resource-types";
import type { ILogger } from "../../../infrastructure/logger";
import {
  GitHubStateSyncService,
  type SyncMetadataStore,
  type SyncResourceCache,
} from "../../../services/GitHubStateSyncService";
import { partialFake } from "../../helpers/aiFakes";
import { asFactory } from "../../helpers/mockTypes";

const MINUTE = 60 * 1000;

interface RepoFake {
  findById: Mock;
  findAll: Mock;
}

function metadata(
  resourceType: ResourceType,
  resourceId: string,
  syncedAt: string | undefined
): SyncMetadata {
  return {
    resourceId,
    resourceType,
    lastModified: "2024-01-01T00:00:00.000Z",
    version: 1,
    syncedAt: syncedAt as string,
  };
}

describe("GitHubStateSyncService", () => {
  let stored: SyncMetadata[];
  let saved: SyncMetadata[];
  let cacheEntries: Map<string, unknown>;
  let issueRepo: RepoFake;
  let projectRepo: RepoFake;
  let milestoneRepo: RepoFake;
  let sprintRepo: RepoFake;
  let service: GitHubStateSyncService;

  const cacheKey = (type: ResourceType, id: string) => `${type}:${id}`;

  beforeEach(() => {
    stored = [];
    saved = [];
    cacheEntries = new Map();
    issueRepo = { findById: vi.fn(), findAll: vi.fn() };
    projectRepo = { findById: vi.fn(), findAll: vi.fn() };
    milestoneRepo = { findById: vi.fn(), findAll: vi.fn() };
    sprintRepo = { findById: vi.fn(), findAll: vi.fn() };

    const cache = partialFake<SyncResourceCache>({
      get: (async (type: ResourceType, id: string) =>
        cacheEntries.get(cacheKey(type, id)) ?? null) as SyncResourceCache["get"],
      set: vi.fn(async (type: ResourceType, id: string, value: unknown) => {
        cacheEntries.set(cacheKey(type, id), value);
      }),
    });
    const persistence = partialFake<SyncMetadataStore>({
      loadMetadata: vi.fn(async () => stored),
      saveMetadata: vi.fn(async (entry: SyncMetadata) => {
        saved.push(entry);
      }),
    });
    const factory = asFactory({
      createIssueRepository: () => issueRepo,
      createProjectRepository: () => projectRepo,
      createMilestoneRepository: () => milestoneRepo,
      createSprintRepository: () => sprintRepo,
    });
    const logger = partialFake<ILogger>({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    });

    service = new GitHubStateSyncService(factory, cache, persistence, logger);
  });

  describe("performInitialSync", () => {
    it("succeeds with nothing to sync and records the sync time", async () => {
      const result = await service.performInitialSync();

      expect(result).toMatchObject({
        success: true,
        syncedResources: 0,
        skippedResources: 0,
        errors: [],
      });
      expect(service.getSyncStatus().inProgress).toBe(false);
      expect(service.getSyncStatus().lastSyncTime).toBeInstanceOf(Date);
    });

    it("re-fetches a resource whose last sync is older than five minutes", async () => {
      const staleAt = new Date(Date.now() - 10 * MINUTE).toISOString();
      stored = [metadata(ResourceType.ISSUE, "42", staleAt)];
      cacheEntries.set(cacheKey(ResourceType.ISSUE, "42"), { id: 42, title: "old" });
      issueRepo.findById.mockResolvedValue({
        id: 42,
        title: "new",
        updatedAt: "2024-06-01T00:00:00.000Z",
        version: 3,
      });

      const result = await service.performInitialSync();

      expect(issueRepo.findById).toHaveBeenCalledWith("42");
      expect(cacheEntries.get(cacheKey(ResourceType.ISSUE, "42"))).toMatchObject({ title: "new" });
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        resourceId: "42",
        resourceType: ResourceType.ISSUE,
        lastModified: "2024-06-01T00:00:00.000Z",
        version: 3,
      });
      expect(Date.now() - new Date(saved[0].syncedAt).getTime()).toBeLessThan(MINUTE);
      expect(result).toMatchObject({ success: true, syncedResources: 1, skippedResources: 0 });
    });

    it("skips a cached resource that was synced within five minutes", async () => {
      const freshAt = new Date(Date.now() - MINUTE).toISOString();
      stored = [metadata(ResourceType.PROJECT, "p1", freshAt)];
      cacheEntries.set(cacheKey(ResourceType.PROJECT, "p1"), { id: "p1" });

      const result = await service.performInitialSync();

      expect(projectRepo.findById).not.toHaveBeenCalled();
      expect(saved).toEqual([]);
      expect(result).toMatchObject({ success: true, syncedResources: 0, skippedResources: 1 });
    });

    it("keys milestones and issues by the id returned from the repository", async () => {
      stored = [
        metadata(ResourceType.MILESTONE, "7", undefined),
        metadata(ResourceType.ISSUE, "9", undefined),
      ];
      milestoneRepo.findById.mockResolvedValue({ id: 7 });
      issueRepo.findById.mockResolvedValue({ id: 9 });

      await service.performInitialSync();

      expect(cacheEntries.has(cacheKey(ResourceType.MILESTONE, "7"))).toBe(true);
      expect(cacheEntries.has(cacheKey(ResourceType.ISSUE, "9"))).toBe(true);
    });

    it("does not cache or record metadata for a resource the repository no longer has", async () => {
      stored = [metadata(ResourceType.ISSUE, "gone", undefined)];
      issueRepo.findById.mockResolvedValue(null);

      const result = await service.performInitialSync();

      expect(cacheEntries.size).toBe(0);
      expect(saved).toEqual([]);
      expect(result.success).toBe(true);
    });

    it("keeps syncing the other resources when one resource fails to load", async () => {
      stored = [
        metadata(ResourceType.ISSUE, "1", undefined),
        metadata(ResourceType.ISSUE, "2", undefined),
      ];
      issueRepo.findById.mockImplementation(async (id: string) => {
        if (id === "1") throw new Error("boom");
        return { id: Number(id) };
      });

      const result = await service.performInitialSync();

      expect(result).toMatchObject({ success: true, syncedResources: 1 });
      expect(cacheEntries.has(cacheKey(ResourceType.ISSUE, "2"))).toBe(true);
      expect(cacheEntries.has(cacheKey(ResourceType.ISSUE, "1"))).toBe(false);
    });

    it("keeps syncing other resource types when every resource of one type fails", async () => {
      stored = [
        metadata(ResourceType.PROJECT, "p1", undefined),
        metadata(ResourceType.ISSUE, "1", undefined),
      ];
      projectRepo.findById.mockRejectedValue(new Error("project api down"));
      issueRepo.findById.mockResolvedValue({ id: 1 });

      const result = await service.performInitialSync();

      expect(result.success).toBe(true);
      expect(result.syncedResources).toBe(1);
      expect(cacheEntries.has(cacheKey(ResourceType.ISSUE, "1"))).toBe(true);
    });

    it("reports a timeout as a failed sync and releases the in-progress flag", async () => {
      stored = [metadata(ResourceType.ISSUE, "1", undefined)];
      issueRepo.findById.mockReturnValue(new Promise(() => {}));

      const result = await service.performInitialSync(20);

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Sync timeout exceeded");
      expect(service.getSyncStatus().inProgress).toBe(false);
      expect(service.getSyncStatus().lastSyncTime).toBeUndefined();
    });

    it("rejects a second sync while one is already running", async () => {
      let release: (value: SyncMetadata[]) => void = () => {};
      const blocked = new Promise<SyncMetadata[]>((resolve) => {
        release = resolve;
      });
      const blockedService = new GitHubStateSyncService(
        asFactory({}),
        partialFake<SyncResourceCache>({ get: vi.fn(), set: vi.fn() }),
        partialFake<SyncMetadataStore>({
          loadMetadata: vi.fn(() => blocked),
          saveMetadata: vi.fn(),
        }),
        partialFake<ILogger>({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
      );

      const first = blockedService.performInitialSync();
      expect(blockedService.getSyncStatus().inProgress).toBe(true);
      await expect(blockedService.performInitialSync()).rejects.toThrow("Sync already in progress");

      release([]);
      await first;
      expect(blockedService.getSyncStatus().inProgress).toBe(false);
    });
  });

  describe("syncResourceType", () => {
    it("force-syncs every project and records metadata for each", async () => {
      projectRepo.findAll.mockResolvedValue([
        { id: "p1", updatedAt: "2024-02-01T00:00:00.000Z" },
        { id: "p2" },
      ]);

      await service.syncResourceType(ResourceType.PROJECT, true);

      expect(cacheEntries.has(cacheKey(ResourceType.PROJECT, "p1"))).toBe(true);
      expect(cacheEntries.has(cacheKey(ResourceType.PROJECT, "p2"))).toBe(true);
      expect(saved.map((m) => m.resourceId)).toEqual(["p1", "p2"]);
      expect(saved[0].lastModified).toBe("2024-02-01T00:00:00.000Z");
      expect(saved[1].version).toBe(1);
    });

    it("incrementally syncs only stale metadata of the requested type", async () => {
      const staleAt = new Date(Date.now() - 10 * MINUTE).toISOString();
      stored = [
        metadata(ResourceType.MILESTONE, "3", staleAt),
        metadata(ResourceType.ISSUE, "4", staleAt),
      ];
      milestoneRepo.findById.mockResolvedValue({ id: 3 });

      await service.syncResourceType(ResourceType.MILESTONE);

      expect(milestoneRepo.findById).toHaveBeenCalledWith("3");
      expect(issueRepo.findById).not.toHaveBeenCalled();
    });

    it("rethrows when the repository fails during a forced sync", async () => {
      issueRepo.findAll.mockRejectedValue(new Error("rate limited"));

      await expect(service.syncResourceType(ResourceType.ISSUE, true)).rejects.toThrow(
        "rate limited"
      );
    });
  });
});
