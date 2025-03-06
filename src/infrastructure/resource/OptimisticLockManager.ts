import { ResourceType, ResourceVersionError } from "../../domain/resource-types";

/**
 * Manages optimistic locking for resources to handle concurrent modifications
 */
export class OptimisticLockManager {
  private static instance: OptimisticLockManager;
  private resourceVersions: Map<string, { version: number; lockedAt: number }>;
  private readonly LOCK_TIMEOUT = 5000; // 5 seconds

  private constructor() {
    this.resourceVersions = new Map();
  }

  static getInstance(): OptimisticLockManager {
    if (!OptimisticLockManager.instance) {
      OptimisticLockManager.instance = new OptimisticLockManager();
    }
    return OptimisticLockManager.instance;
  }

  /**
   * Verify version match and acquire lock for a resource update
   */
  async verifyAndLock(
    resourceId: string, 
    type: ResourceType, 
    currentVersion: number, 
    expectedVersion?: number
  ): Promise<void> {
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      throw new ResourceVersionError(
        type,
        resourceId,
        expectedVersion,
        currentVersion
      );
    }

    const now = Date.now();
    const currentLock = this.resourceVersions.get(resourceId);

    // Clear expired locks
    if (currentLock && now - currentLock.lockedAt > this.LOCK_TIMEOUT) {
      this.resourceVersions.delete(resourceId);
    }

    // Set new lock
    this.resourceVersions.set(resourceId, {
      version: currentVersion + 1,
      lockedAt: now,
    });
  }

  /**
   * Release lock for a resource
   */
  releaseLock(resourceId: string): void {
    this.resourceVersions.delete(resourceId);
  }

  /**
   * Get current version for a resource
   */
  getCurrentVersion(resourceId: string): number | undefined {
    const lock = this.resourceVersions.get(resourceId);
    return lock?.version;
  }

  /**
   * Clear all locks
   */
  clearLocks(): void {
    this.resourceVersions.clear();
  }
}