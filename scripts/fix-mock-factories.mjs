#!/usr/bin/env node

// Fix mock factories for AIServiceFactory and GitHubRepositoryFactory
// These need to provide all methods that the tests expect

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

// AIServiceFactory mock with all methods
const aiServiceFactoryMock = `vi.mock('$PATH', () => {
  const mockInstance = {
    getModel: vi.fn(),
    getMainModel: vi.fn(),
    getFallbackModel: vi.fn(),
    getPRDModel: vi.fn(),
    getResearchModel: vi.fn(),
    getBestAvailableModel: vi.fn(),
    isAIAvailable: vi.fn(),
    getConfiguration: vi.fn(),
    validateConfiguration: vi.fn(),
  };
  return {
    AIServiceFactory: {
      getInstance: vi.fn().mockReturnValue(mockInstance),
      instance: undefined,
    },
  };
});`;

// GitHubRepositoryFactory mock with all methods
const githubRepoFactoryMock = `vi.mock('$PATH', () => {
  return {
    GitHubRepositoryFactory: vi.fn().mockImplementation(() => ({
      createIssueRepository: vi.fn(),
      createMilestoneRepository: vi.fn(),
      createProjectRepository: vi.fn(),
      createSprintRepository: vi.fn(),
      createAutomationRuleRepository: vi.fn(),
      createSubIssueRepository: vi.fn(),
      createStatusUpdateRepository: vi.fn(),
      getOctokit: vi.fn(),
      getConfig: vi.fn(),
      graphql: vi.fn(),
    })),
  };
});`;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  const original = content;

  // Fix AIServiceFactory mock factories
  // Pattern: vi.mock('...', () => ({ AIServiceFactory: { getInstance: vi.fn() } }));
  content = content.replace(
    /vi\.mock\('([^']*AIServiceFactory[^']*)',\s*\(\)\s*=>\s*\(\{\s*AIServiceFactory:\s*\{\s*getInstance:\s*vi\.fn\(\),?\s*\},?\s*\}\)\);/g,
    (match, path) => aiServiceFactoryMock.replace(/\$PATH/g, path)
  );

  // Also fix multi-line patterns
  content = content.replace(
    /vi\.mock\('([^']*AIServiceFactory[^']*)',\s*\(\)\s*=>\s*\(\{[\s\S]*?getInstance:\s*vi\.fn\(\)[\s\S]*?\}\)\);/g,
    (match, path) => aiServiceFactoryMock.replace(/\$PATH/g, path)
  );

  // Fix GitHubRepositoryFactory mock factories
  // Pattern: vi.mock('...', () => ({ GitHubRepositoryFactory: vi.fn() }));
  content = content.replace(
    /vi\.mock\('([^']*GitHubRepositoryFactory[^']*)',\s*\(\)\s*=>\s*\(\{\s*GitHubRepositoryFactory:\s*vi\.fn\(\)[^}]*\}\)\);/g,
    (match, path) => githubRepoFactoryMock.replace(/\$PATH/g, path)
  );

  // Also fix multi-line patterns
  content = content.replace(
    /vi\.mock\('([^']*GitHubRepositoryFactory[^']*)',\s*\(\)\s*=>\s*\(\{[\s\S]*?GitHubRepositoryFactory:[\s\S]*?\}\)\);/g,
    (match, path) => githubRepoFactoryMock.replace(/\$PATH/g, path)
  );

  if (content !== original) {
    writeFileSync(file, content);
    totalFiles++;
    console.log(`Fixed: ${file}`);
  }
}

console.log(`\nFixed ${totalFiles} files`);
