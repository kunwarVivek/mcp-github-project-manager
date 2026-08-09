#!/usr/bin/env node

// Fix vi.mock() calls to provide explicit mock factories
// Vitest's auto-mocking doesn't work properly for ESM modules with static methods

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

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

// Map of module paths to their mock factories
const mockFactories = {
  'AIServiceFactory': `vi.mock('$PATH', () => ({
  AIServiceFactory: {
    getInstance: vi.fn(),
  },
}));`,
  'AITaskProcessor': `vi.mock('$PATH', () => ({
  AITaskProcessor: vi.fn().mockImplementation(() => ({
    generatePRDFromIdea: vi.fn(),
    enhancePRD: vi.fn(),
    extractFeaturesFromPRD: vi.fn(),
    testConnection: vi.fn(),
  })),
}));`,
  'GitHubRepositoryFactory': `vi.mock('$PATH', () => ({
  GitHubRepositoryFactory: vi.fn().mockImplementation(() => ({
    createIssueRepository: vi.fn(),
    createMilestoneRepository: vi.fn(),
    createProjectRepository: vi.fn(),
    createSprintRepository: vi.fn(),
    createAutomationRuleRepository: vi.fn(),
    createSubIssueRepository: vi.fn(),
    createStatusUpdateRepository: vi.fn(),
  })),
}));`,
  'ProjectManagementService': `vi.mock('$PATH', () => ({
  ProjectManagementService: vi.fn().mockImplementation(() => ({
    listProjectItems: vi.fn(),
    updateProjectItem: vi.fn(),
    createIssue: vi.fn(),
    createAutomationRule: vi.fn(),
  })),
}));`,
  'IssueEnrichmentService': `vi.mock('$PATH', () => ({
  IssueEnrichmentService: vi.fn().mockImplementation(() => ({
    enrichIssue: vi.fn(),
    getEnrichmentContext: vi.fn(),
  })),
}));`,
  'PRDGenerationService': `vi.mock('$PATH', () => ({
  PRDGenerationService: vi.fn().mockImplementation(() => ({
    generatePRDFromIdea: vi.fn(),
    enhancePRD: vi.fn(),
    extractFeaturesFromPRD: vi.fn(),
    validatePRDCompleteness: vi.fn(),
  })),
}));`,
  'TaskGenerationService': `vi.mock('$PATH', () => ({
  TaskGenerationService: vi.fn().mockImplementation(() => ({
    generateTasksFromPRD: vi.fn(),
    generateSubtasks: vi.fn(),
  })),
}));`,
  'FeatureAnalysisService': `vi.mock('$PATH', () => ({
  FeatureAnalysisService: vi.fn().mockImplementation(() => ({
    analyzeFeature: vi.fn(),
    getFeatureContext: vi.fn(),
  })),
}));`,
  'FieldValueService': `vi.mock('$PATH', () => ({
  FieldValueService: vi.fn().mockImplementation(() => ({
    setFieldValue: vi.fn(),
    getFieldValue: vi.fn(),
    listProjectFields: vi.fn(),
  })),
}));`,
  'ProjectTemplateService': `vi.mock('$PATH', () => ({
  ProjectTemplateService: vi.fn().mockImplementation(() => ({
    listProjectFields: vi.fn(),
    getFieldByName: vi.fn(),
  })),
}));`,
  'ProjectLinkingService': `vi.mock('$PATH', () => ({
  ProjectLinkingService: vi.fn().mockImplementation(() => ({
    linkRepository: vi.fn(),
    unlinkRepository: vi.fn(),
    listLinkedRepositories: vi.fn(),
  })),
}));`,
};

const files = [...findTestFiles('src/__tests__'), ...findTestFiles('tests')];
let totalFiles = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  const original = content;

  // Find vi.mock() calls without factory functions
  // Pattern: vi.mock('path/to/module');
  content = content.replace(
    /vi\.mock\('([^']+)'[\s]*\);/g,
    (match, path) => {
      // Check if this module has a known mock factory
      for (const [moduleName, factory] of Object.entries(mockFactories)) {
        if (path.includes(moduleName)) {
          const result = factory.replace(/\$PATH/g, path);
          console.log(`Fixed: ${file} -> ${moduleName}`);
          return result;
        }
      }
      // If no known factory, leave as-is (will be handled by auto-mock)
      return match;
    }
  );

  if (content !== original) {
    writeFileSync(file, content);
    totalFiles++;
  }
}

console.log(`\nFixed ${totalFiles} files`);
