#!/usr/bin/env node

// Migration script: Jest → Vitest
// Replaces @jest/globals imports with vitest, jest.fn → vi.fn, jest.mock → vi.mock

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function findTestFiles(dir) {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules' && entry !== 'build') {
        results.push(...findTestFiles(full));
      } else if (entry.endsWith('.test.ts') || entry.endsWith('.spec.ts') || entry.endsWith('.e2e.ts')) {
        results.push(full);
      }
    }
  } catch (e) {}
  return results;
}

const files = [...findTestFiles('src/__tests__'), ...findTestFiles('tests')];
let totalFiles = 0;
let totalChanges = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  const original = content;
  let changes = 0;

  // 1. Replace @jest/globals import with vitest
  // Pattern: import { describe, it, expect, beforeEach, jest } from '@jest/globals';
  content = content.replace(
    /import\s*\{([^}]*)\}\s*from\s*['"]@jest\/globals['"]\s*;/g,
    (match, imports) => {
      // Replace 'jest' with 'vi' in the import list
      const newImports = imports
        .split(',')
        .map(i => i.trim())
        .map(i => i === 'jest' ? 'vi' : i)
        .filter(i => i.length > 0);
      changes++;
      return `import { ${newImports.join(', ')} } from 'vitest';`;
    }
  );

  // 2. Replace jest.fn() with vi.fn()
  const jestFnBefore = (content.match(/jest\.fn\(/g) || []).length;
  content = content.replace(/\bjest\.fn\(/g, 'vi.fn(');
  changes += jestFnBefore;

  // 3. Replace jest.mock() with vi.mock()
  const jestMockBefore = (content.match(/jest\.mock\(/g) || []).length;
  content = content.replace(/\bjest\.mock\(/g, 'vi.mock(');
  changes += jestMockBefore;

  // 4. Replace jest.spyOn() with vi.spyOn()
  const jestSpyBefore = (content.match(/jest\.spyOn\(/g) || []).length;
  content = content.replace(/\bjest\.spyOn\(/g, 'vi.spyOn(');
  changes += jestSpyBefore;

  // 5. Replace jest.clearAllMocks() with vi.clearAllMocks()
  content = content.replace(/\bjest\.clearAllMocks\(\)/g, 'vi.clearAllMocks()');
  content = content.replace(/\bjest\.resetAllMocks\(\)/g, 'vi.resetAllMocks()');
  content = content.replace(/\bjest\.restoreAllMocks\(\)/g, 'vi.restoreAllMocks()');

  // 6. Replace jest.Mocked<T> with Mocked<T> from vitest
  content = content.replace(/\bjest\.Mocked</g, 'Mocked<');
  content = content.replace(/\bjest\.MockedClass</g, 'MockedClass<');
  content = content.replace(/\bjest\.MockedFunction</g, 'MockedFunction<');

  // 7. Add Mocked import if needed
  if (content.includes('Mocked<') || content.includes('MockedClass<') || content.includes('MockedFunction<')) {
    // Check if Mocked is already imported from vitest
    if (!content.includes("Mocked") || !content.match(/import.*Mocked.*from\s*['"]vitest['"]/)) {
      // Add Mocked to the vitest import
      content = content.replace(
        /import\s*\{([^}]*)\}\s*from\s*['"]vitest['"]\s*;/g,
        (match, imports) => {
          if (!imports.includes('Mocked')) {
            return `import { ${imports.trim()}, Mocked, MockedClass, MockedFunction } from 'vitest';`;
          }
          return match;
        }
      );
    }
  }

  if (content !== original) {
    writeFileSync(file, content);
    totalFiles++;
    totalChanges += changes;
    console.log(`Migrated: ${file} (${changes} changes)`);
  }
}

console.log(`\nMigration complete: ${totalFiles} files updated, ${totalChanges} total changes`);
