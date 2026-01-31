/**
 * CachePersistence - JSON file-based cache persistence.
 *
 * Provides persistence for ResourceCache entries to survive server restarts.
 * Uses atomic writes (write to temp file, then rename) for reliability.
 *
 * Features:
 * - Save cache entries to JSON file
 * - Restore valid (non-expired) entries on startup
 * - Filter out expired entries during restore
 * - Atomic write pattern for data safety
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { existsSync } from 'node:fs';

/**
 * A single cache entry for persistence
 */
export interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
  tags?: string[];
}

/**
 * Snapshot format for persisted cache
 */
export interface CacheSnapshot {
  version: 1;
  timestamp: string;
  entries: Array<{
    key: string;
    value: unknown;
    expiresAt?: number;
    tags?: string[];
  }>;
}

/**
 * CachePersistence handles saving and restoring cache entries to/from disk.
 */
export class CachePersistence {
  private readonly filePath: string;
  private readonly cacheDirectory: string;
  private lastPersistTime: string | undefined;

  /**
   * Creates a new CachePersistence instance.
   *
   * @param cacheDirectory - Directory to store the cache snapshot (default: '.cache')
   */
  constructor(cacheDirectory: string = '.cache') {
    this.cacheDirectory = cacheDirectory;
    this.filePath = path.join(cacheDirectory, 'cache-snapshot.json');
  }

  /**
   * Save cache entries to disk.
   *
   * Uses atomic write pattern: write to temp file, then rename.
   * This prevents data corruption if the process crashes during write.
   *
   * @param entries - Map of cache key to CacheEntry
   */
  async save(entries: Map<string, CacheEntry<unknown>>): Promise<void> {
    try {
      // Ensure cache directory exists
      await fs.mkdir(this.cacheDirectory, { recursive: true });

      // Convert Map to snapshot format
      const snapshot: CacheSnapshot = {
        version: 1,
        timestamp: new Date().toISOString(),
        entries: Array.from(entries.entries()).map(([key, entry]) => ({
          key,
          value: entry.value,
          expiresAt: entry.expiresAt,
          tags: entry.tags,
        })),
      };

      // Atomic write: write to temp file, then rename
      const tempPath = `${this.filePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(snapshot, null, 2), 'utf-8');
      await fs.rename(tempPath, this.filePath);

      this.lastPersistTime = snapshot.timestamp;

      process.stderr.write(
        `[CachePersistence] Saved ${snapshot.entries.length} entries to ${this.filePath}\n`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `[CachePersistence] Failed to save cache: ${message}\n`
      );
      throw error;
    }
  }

  /**
   * Restore cache entries from disk.
   *
   * Filters out expired entries (expiresAt < Date.now()).
   * Returns empty Map on file not found or parse error.
   *
   * @returns Map of cache key to CacheEntry
   */
  async restore(): Promise<Map<string, CacheEntry<unknown>>> {
    const result = new Map<string, CacheEntry<unknown>>();

    try {
      if (!existsSync(this.filePath)) {
        process.stderr.write(
          `[CachePersistence] No snapshot file found at ${this.filePath}\n`
        );
        return result;
      }

      const data = await fs.readFile(this.filePath, 'utf-8');
      const snapshot = JSON.parse(data) as CacheSnapshot;

      // Validate snapshot version
      if (snapshot.version !== 1) {
        process.stderr.write(
          `[CachePersistence] Unknown snapshot version: ${snapshot.version}\n`
        );
        return result;
      }

      const now = Date.now();
      let restored = 0;
      let expired = 0;

      for (const entry of snapshot.entries) {
        // Skip expired entries
        if (entry.expiresAt && entry.expiresAt < now) {
          expired++;
          continue;
        }

        result.set(entry.key, {
          value: entry.value,
          expiresAt: entry.expiresAt,
          tags: entry.tags,
        });
        restored++;
      }

      this.lastPersistTime = snapshot.timestamp;

      process.stderr.write(
        `[CachePersistence] Restored ${restored} entries (${expired} expired) from ${this.filePath}\n`
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(
          `[CachePersistence] Failed to restore cache: ${message}\n`
        );
      }
    }

    return result;
  }

  /**
   * Check if a cache snapshot file exists.
   *
   * @returns true if the snapshot file exists
   */
  async exists(): Promise<boolean> {
    return existsSync(this.filePath);
  }

  /**
   * Get the timestamp of the last successful persist operation.
   *
   * @returns ISO timestamp string or undefined if never persisted
   */
  getLastPersistTime(): string | undefined {
    return this.lastPersistTime;
  }

  /**
   * Get the path to the cache snapshot file.
   *
   * @returns The file path
   */
  getFilePath(): string {
    return this.filePath;
  }
}
