/**
 * Unit tests for CachePersistence
 *
 * Tests JSON file-based cache persistence:
 * - Save cache entries to file
 * - Restore entries from file
 * - Filter expired entries on restore
 * - Handle missing files
 * - Atomic write pattern
 */

import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { CachePersistence, type CacheEntry } from '../../../src/infrastructure/cache/CachePersistence.js';

describe('CachePersistence', () => {
  let tempDir: string;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    // Create temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'));
    // Suppress stderr output during tests
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    stderrSpy.mockRestore();
    // Clean up temp directory
    try {
      await fsPromises.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('save()', () => {
    it('saves cache entries to JSON file', async () => {
      const persistence = new CachePersistence(tempDir);
      const entries = new Map<string, CacheEntry<unknown>>();
      entries.set('key1', { value: 'value1' });
      entries.set('key2', { value: { nested: 'data' } });

      await persistence.save(entries);

      const filePath = persistence.getFilePath();
      expect(fs.existsSync(filePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content.version).toBe(1);
      expect(content.entries).toHaveLength(2);
    });

    it('saves entry metadata (expiresAt, tags)', async () => {
      const persistence = new CachePersistence(tempDir);
      const entries = new Map<string, CacheEntry<unknown>>();
      entries.set('key1', {
        value: 'data',
        expiresAt: Date.now() + 60000,
        tags: ['tag1', 'tag2'],
      });

      await persistence.save(entries);

      const content = JSON.parse(fs.readFileSync(persistence.getFilePath(), 'utf-8'));
      expect(content.entries[0].expiresAt).toBeDefined();
      expect(content.entries[0].tags).toEqual(['tag1', 'tag2']);
    });

    it('creates cache directory if it does not exist', async () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir');
      const persistence = new CachePersistence(nestedPath);
      const entries = new Map<string, CacheEntry<unknown>>();
      entries.set('key1', { value: 'value1' });

      await persistence.save(entries);

      expect(fs.existsSync(nestedPath)).toBe(true);
      expect(fs.existsSync(persistence.getFilePath())).toBe(true);
    });

    it('uses atomic write pattern (temp file then rename)', async () => {
      const persistence = new CachePersistence(tempDir);
      const entries = new Map<string, CacheEntry<unknown>>();
      entries.set('key1', { value: 'value1' });

      await persistence.save(entries);

      // Temp file should not exist after completion
      const tempPath = `${persistence.getFilePath()}.tmp`;
      expect(fs.existsSync(tempPath)).toBe(false);
      // Final file should exist
      expect(fs.existsSync(persistence.getFilePath())).toBe(true);
    });

    it('updates lastPersistTime on save', async () => {
      const persistence = new CachePersistence(tempDir);
      expect(persistence.getLastPersistTime()).toBeUndefined();

      const entries = new Map<string, CacheEntry<unknown>>();
      entries.set('key1', { value: 'value1' });
      await persistence.save(entries);

      const lastPersist = persistence.getLastPersistTime();
      expect(lastPersist).toBeDefined();
      expect(new Date(lastPersist!).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('restore()', () => {
    it('restores cache entries from file', async () => {
      const persistence = new CachePersistence(tempDir);

      // Save first
      const original = new Map<string, CacheEntry<unknown>>();
      original.set('key1', { value: 'value1' });
      original.set('key2', { value: { nested: 'data' } });
      await persistence.save(original);

      // Restore
      const restored = await persistence.restore();

      expect(restored.size).toBe(2);
      expect(restored.get('key1')?.value).toBe('value1');
      expect(restored.get('key2')?.value).toEqual({ nested: 'data' });
    });

    it('restores entry metadata', async () => {
      const persistence = new CachePersistence(tempDir);
      const expiresAt = Date.now() + 60000;

      const original = new Map<string, CacheEntry<unknown>>();
      original.set('key1', {
        value: 'data',
        expiresAt,
        tags: ['tag1'],
      });
      await persistence.save(original);

      const restored = await persistence.restore();
      const entry = restored.get('key1');
      expect(entry?.expiresAt).toBe(expiresAt);
      expect(entry?.tags).toEqual(['tag1']);
    });

    it('filters expired entries on restore', async () => {
      const persistence = new CachePersistence(tempDir);
      const now = Date.now();

      const original = new Map<string, CacheEntry<unknown>>();
      original.set('expired', {
        value: 'old',
        expiresAt: now - 1000, // Expired
      });
      original.set('valid', {
        value: 'new',
        expiresAt: now + 60000, // Not expired
      });
      original.set('no-expiry', { value: 'forever' });
      await persistence.save(original);

      const restored = await persistence.restore();

      expect(restored.size).toBe(2);
      expect(restored.has('expired')).toBe(false);
      expect(restored.has('valid')).toBe(true);
      expect(restored.has('no-expiry')).toBe(true);
    });

    it('returns empty map when file does not exist', async () => {
      const persistence = new CachePersistence(path.join(tempDir, 'nonexistent'));
      const restored = await persistence.restore();

      expect(restored).toBeInstanceOf(Map);
      expect(restored.size).toBe(0);
    });

    it('returns empty map on parse error', async () => {
      const cacheDir = path.join(tempDir, 'corrupt');
      await fsPromises.mkdir(cacheDir, { recursive: true });

      // Write invalid JSON
      const filePath = path.join(cacheDir, 'cache-snapshot.json');
      await fsPromises.writeFile(filePath, 'invalid json content', 'utf-8');

      const persistence = new CachePersistence(cacheDir);
      const restored = await persistence.restore();

      expect(restored.size).toBe(0);
    });

    it('returns empty map for unknown version', async () => {
      const cacheDir = path.join(tempDir, 'oldversion');
      await fsPromises.mkdir(cacheDir, { recursive: true });

      // Write unsupported version
      const snapshot = { version: 99, timestamp: new Date().toISOString(), entries: [] };
      const filePath = path.join(cacheDir, 'cache-snapshot.json');
      await fsPromises.writeFile(filePath, JSON.stringify(snapshot), 'utf-8');

      const persistence = new CachePersistence(cacheDir);
      const restored = await persistence.restore();

      expect(restored.size).toBe(0);
    });
  });

  describe('exists()', () => {
    it('returns false when file does not exist', async () => {
      const persistence = new CachePersistence(path.join(tempDir, 'empty'));
      expect(await persistence.exists()).toBe(false);
    });

    it('returns true when file exists', async () => {
      const persistence = new CachePersistence(tempDir);
      const entries = new Map<string, CacheEntry<unknown>>();
      entries.set('key1', { value: 'value1' });
      await persistence.save(entries);

      expect(await persistence.exists()).toBe(true);
    });
  });

  describe('getFilePath()', () => {
    it('returns correct file path', () => {
      const persistence = new CachePersistence('/custom/path');
      expect(persistence.getFilePath()).toBe('/custom/path/cache-snapshot.json');
    });

    it('uses default directory when not specified', () => {
      const persistence = new CachePersistence();
      expect(persistence.getFilePath()).toBe('.cache/cache-snapshot.json');
    });
  });

  describe('logging', () => {
    it('logs save count to stderr', async () => {
      const persistence = new CachePersistence(tempDir);
      const entries = new Map<string, CacheEntry<unknown>>();
      entries.set('key1', { value: 'value1' });
      entries.set('key2', { value: 'value2' });

      await persistence.save(entries);

      const calls = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((c) => c.includes('Saved 2 entries'))).toBe(true);
    });

    it('logs restore count to stderr', async () => {
      const persistence = new CachePersistence(tempDir);
      const entries = new Map<string, CacheEntry<unknown>>();
      entries.set('key1', { value: 'value1' });
      await persistence.save(entries);

      await persistence.restore();

      const calls = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((c) => c.includes('Restored 1 entries'))).toBe(true);
    });

    it('logs when no snapshot file found', async () => {
      const persistence = new CachePersistence(path.join(tempDir, 'empty'));
      await persistence.restore();

      const calls = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((c) => c.includes('No snapshot file found'))).toBe(true);
    });
  });
});
