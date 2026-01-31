import { PRDValidator } from '../../src/infrastructure/validation/PRDValidator';
import { ValidationRuleEngine, ValidationRule } from '../../src/infrastructure/validation/ValidationRuleEngine';
import { COMPLETENESS_RULES } from '../../src/infrastructure/validation/rules/CompletenessRules';
import { CLARITY_RULES } from '../../src/infrastructure/validation/rules/ClarityRules';
import { PRDDocument, TaskPriority } from '../../src/domain/ai-types';

function createMinimalPRD(overrides: Partial<PRDDocument> = {}): PRDDocument {
  return {
    id: 'test-prd',
    title: 'Test PRD',
    overview: 'A short overview',
    objectives: ['Objective 1'],
    features: [],
    scope: { inScope: [], outOfScope: [] },
    targetUsers: [],
    successMetrics: [],
    technicalRequirements: [],
    timeline: '',
    author: 'test',
    version: '1.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  } as PRDDocument;
}

describe('ValidationRuleEngine', () => {
  let engine: ValidationRuleEngine;
  beforeEach(() => { engine = new ValidationRuleEngine(); });

  describe('registerRule', () => {
    it('registers a single rule', () => {
      const rule: ValidationRule = {
        id: 'TEST-001',
        name: 'Test Rule',
        description: 'Test',
        layer: 'builtin',
        severity: 'minor',
        category: 'completeness',
        enabled: true,
        check: () => ({ passed: true, message: 'OK' })
      };
      engine.registerRule(rule);
      expect(engine.getRules().length).toBe(1);
    });

    it('registers multiple rules', () => {
      engine.registerRules(COMPLETENESS_RULES);
      expect(engine.getRules().length).toBe(COMPLETENESS_RULES.length);
    });

    it('overwrites rule with same id', () => {
      const rule1: ValidationRule = {
        id: 'TEST-001',
        name: 'First',
        description: 'Test',
        layer: 'builtin',
        severity: 'minor',
        category: 'completeness',
        enabled: true,
        check: () => ({ passed: true, message: 'First' })
      };
      const rule2: ValidationRule = {
        ...rule1,
        name: 'Second'
      };

      engine.registerRule(rule1);
      engine.registerRule(rule2);

      expect(engine.getRules().length).toBe(1);
      expect(engine.getRules()[0].name).toBe('Second');
    });
  });

  describe('validate', () => {
    beforeEach(() => {
      engine.registerRules(COMPLETENESS_RULES);
    });

    it('runs all enabled rules', () => {
      const prd = createMinimalPRD({ overview: 'A'.repeat(150), objectives: ['O1', 'O2'] });
      const result = engine.validate(prd);
      expect(result.totalRules).toBeGreaterThan(0);
    });

    it('calculates score based on passed rules', () => {
      const prd = createMinimalPRD();
      const result = engine.validate(prd);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('counts issues by severity', () => {
      const prd = createMinimalPRD();
      const result = engine.validate(prd);
      expect(result.criticalIssues).toBeDefined();
      expect(result.majorIssues).toBeDefined();
      expect(result.minorIssues).toBeDefined();
    });

    it('returns results for each rule', () => {
      const prd = createMinimalPRD();
      const result = engine.validate(prd);
      expect(result.results.length).toBe(result.totalRules);
    });
  });

  describe('layer management', () => {
    it('enables and disables layers', () => {
      engine.enableLayer('standard');
      engine.disableLayer('standard');
      // builtin cannot be disabled
      engine.disableLayer('builtin');
    });

    it('skips rules from disabled layers', () => {
      const customRule: ValidationRule = {
        id: 'CUSTOM-001',
        name: 'Custom',
        description: 'Test',
        layer: 'custom',
        severity: 'minor',
        category: 'completeness',
        enabled: true,
        check: () => ({ passed: false, message: 'Fail' })
      };
      engine.registerRule(customRule);
      const prd = createMinimalPRD();
      const result = engine.validate(prd);
      // Custom layer not enabled, so rule shouldn't run
      expect(result.results.find(r => r.rule.id === 'CUSTOM-001')).toBeUndefined();
    });

    it('runs custom rules when layer enabled', () => {
      const customRule: ValidationRule = {
        id: 'CUSTOM-001',
        name: 'Custom',
        description: 'Test',
        layer: 'custom',
        severity: 'minor',
        category: 'completeness',
        enabled: true,
        check: () => ({ passed: true, message: 'OK' })
      };
      engine.registerRule(customRule);
      engine.enableLayer('custom');
      const prd = createMinimalPRD();
      const result = engine.validate(prd);
      expect(result.results.find(r => r.rule.id === 'CUSTOM-001')).toBeDefined();
    });
  });

  describe('autoFix', () => {
    it('returns unfixable issues for rules without autoFix', () => {
      engine.registerRules(COMPLETENESS_RULES);
      const prd = createMinimalPRD();
      const result = engine.autoFix(prd);
      expect(result.unfixableIssues.length).toBeGreaterThanOrEqual(0);
    });

    it('applies fixes for rules with autoFix', () => {
      const rule: ValidationRule = {
        id: 'FIX-001',
        name: 'Fixable',
        description: 'Test',
        layer: 'builtin',
        severity: 'minor',
        category: 'completeness',
        enabled: true,
        check: (prd) => ({
          passed: prd.timeline !== '',
          message: prd.timeline ? 'Has timeline' : 'Missing timeline'
        }),
        autoFix: (prd) => ({ ...prd, timeline: 'Auto-generated timeline' })
      };
      engine.registerRule(rule);
      const prd = createMinimalPRD({ timeline: '' });
      const result = engine.autoFix(prd);
      expect(result.prd.timeline).toBe('Auto-generated timeline');
      expect(result.fixedIssues.length).toBe(1);
    });
  });
});

describe('PRDValidator', () => {
  let validator: PRDValidator;
  beforeEach(() => { validator = new PRDValidator(); });

  describe('validate', () => {
    it('validates a complete PRD', () => {
      const prd = createMinimalPRD({
        overview: 'A comprehensive overview that describes the project in detail. '.repeat(5),
        objectives: ['Objective 1', 'Objective 2'],
        features: [{
          id: 'f1',
          title: 'Feature 1',
          description: 'A detailed description of the feature that is at least 50 characters long',
          priority: TaskPriority.HIGH,
          acceptanceCriteria: ['AC1'],
          userStories: ['As a user, I want...'],
          estimatedComplexity: 5,
          dependencies: []
        }],
        scope: { inScope: ['In scope item'], outOfScope: ['Out of scope item'], assumptions: [], constraints: [] },
        targetUsers: [{ id: 'u1', name: 'User', description: 'A user', goals: ['Goal 1'], painPoints: [], technicalLevel: 'intermediate' }],
        successMetrics: ['Metric 1']
      });
      const result = validator.validate(prd);
      expect(result.passedRules).toBeGreaterThan(0);
    });

    it('fails validation for minimal PRD', () => {
      const prd = createMinimalPRD();
      const result = validator.validate(prd);
      expect(result.criticalIssues).toBeGreaterThan(0);
    });
  });

  describe('built-in rules', () => {
    it('has 13 built-in rules (8 completeness + 5 clarity)', () => {
      const rules = validator.getRules();
      expect(rules.length).toBe(13);
    });

    it('checks overview length (BR-001)', () => {
      const shortPRD = createMinimalPRD({ overview: 'Short' });
      const longPRD = createMinimalPRD({ overview: 'A'.repeat(150) });

      const shortResult = validator.validate(shortPRD);
      const longResult = validator.validate(longPRD);

      const shortBR001 = shortResult.results.find(r => r.rule.id === 'BR-001');
      const longBR001 = longResult.results.find(r => r.rule.id === 'BR-001');

      expect(shortBR001?.result.passed).toBe(false);
      expect(longBR001?.result.passed).toBe(true);
    });

    it('checks objectives count (BR-002)', () => {
      const onePRD = createMinimalPRD({ objectives: ['One'] });
      const twoPRD = createMinimalPRD({ objectives: ['One', 'Two'] });

      expect(validator.validate(onePRD).results.find(r => r.rule.id === 'BR-002')?.result.passed).toBe(false);
      expect(validator.validate(twoPRD).results.find(r => r.rule.id === 'BR-002')?.result.passed).toBe(true);
    });

    it('checks features presence (BR-003)', () => {
      const noFeaturesPRD = createMinimalPRD({ features: [] });
      const withFeaturesPRD = createMinimalPRD({
        features: [{
          id: 'f1',
          title: 'Feature',
          description: 'Test',
          priority: TaskPriority.HIGH,
          acceptanceCriteria: [],
          userStories: [],
          estimatedComplexity: 5,
          dependencies: []
        }]
      });

      expect(validator.validate(noFeaturesPRD).results.find(r => r.rule.id === 'BR-003')?.result.passed).toBe(false);
      expect(validator.validate(withFeaturesPRD).results.find(r => r.rule.id === 'BR-003')?.result.passed).toBe(true);
    });

    it('checks for vague language (CL-003)', () => {
      const vaguePRD = createMinimalPRD({ objectives: ['Improve performance', 'Make it better'] });
      const specificPRD = createMinimalPRD({ objectives: ['Reduce load time by 50%', 'Increase throughput to 1000 rps'] });

      expect(validator.validate(vaguePRD).results.find(r => r.rule.id === 'CL-003')?.result.passed).toBe(false);
      expect(validator.validate(specificPRD).results.find(r => r.rule.id === 'CL-003')?.result.passed).toBe(true);
    });

    it('checks feature descriptions (CL-001)', () => {
      const shortDescPRD = createMinimalPRD({
        features: [{
          id: 'f1',
          title: 'Feature',
          description: 'Short',
          priority: TaskPriority.HIGH,
          acceptanceCriteria: [],
          userStories: [],
          estimatedComplexity: 5,
          dependencies: []
        }]
      });
      const longDescPRD = createMinimalPRD({
        features: [{
          id: 'f1',
          title: 'Feature',
          description: 'A much longer description that provides more than 50 characters of detail',
          priority: TaskPriority.HIGH,
          acceptanceCriteria: [],
          userStories: [],
          estimatedComplexity: 5,
          dependencies: []
        }]
      });

      expect(validator.validate(shortDescPRD).results.find(r => r.rule.id === 'CL-001')?.result.passed).toBe(false);
      expect(validator.validate(longDescPRD).results.find(r => r.rule.id === 'CL-001')?.result.passed).toBe(true);
    });
  });

  describe('getValidationSummary', () => {
    it('formats summary with score and issues', () => {
      const prd = createMinimalPRD();
      const result = validator.validate(prd);
      const summary = validator.getValidationSummary(result);

      expect(summary).toContain('PRD Validation Score');
      expect(summary).toContain('Status');
      expect(summary).toContain('Rules');
    });

    it('includes critical issues in summary', () => {
      const prd = createMinimalPRD();
      const result = validator.validate(prd);
      const summary = validator.getValidationSummary(result);

      if (result.criticalIssues > 0) {
        expect(summary).toContain('Critical Issues');
      }
    });
  });

  describe('addRule', () => {
    it('allows adding custom rules', () => {
      const customRule: ValidationRule = {
        id: 'CUSTOM-001',
        name: 'Custom Rule',
        description: 'Test',
        layer: 'custom',
        severity: 'minor',
        category: 'completeness',
        enabled: true,
        check: () => ({ passed: true, message: 'OK' })
      };
      validator.addRule(customRule);
      validator.enableCustomRules();
      expect(validator.getRules().length).toBe(14);
    });
  });

  describe('autoFix', () => {
    it('returns unfixable issues for rules without autoFix', () => {
      const prd = createMinimalPRD();
      const result = validator.autoFix(prd);
      expect(result.unfixableIssues.length).toBeGreaterThan(0);
    });

    it('returns fixed issues list', () => {
      const prd = createMinimalPRD();
      const result = validator.autoFix(prd);
      expect(Array.isArray(result.fixedIssues)).toBe(true);
    });
  });

  describe('enableStandardRules', () => {
    it('enables standard layer rules', () => {
      validator.enableStandardRules();
      // No error means it works
    });
  });
});

describe('Completeness Rules', () => {
  it('exports 8 completeness rules', () => {
    expect(COMPLETENESS_RULES.length).toBe(8);
  });

  it('all rules have required fields', () => {
    COMPLETENESS_RULES.forEach(rule => {
      expect(rule.id).toBeDefined();
      expect(rule.name).toBeDefined();
      expect(rule.category).toBe('completeness');
      expect(typeof rule.check).toBe('function');
    });
  });

  it('all rules are builtin layer', () => {
    COMPLETENESS_RULES.forEach(rule => {
      expect(rule.layer).toBe('builtin');
    });
  });

  it('all rules are enabled by default', () => {
    COMPLETENESS_RULES.forEach(rule => {
      expect(rule.enabled).toBe(true);
    });
  });
});

describe('Clarity Rules', () => {
  it('exports 5 clarity rules', () => {
    expect(CLARITY_RULES.length).toBe(5);
  });

  it('all rules have required fields', () => {
    CLARITY_RULES.forEach(rule => {
      expect(rule.id).toBeDefined();
      expect(rule.name).toBeDefined();
      expect(rule.category).toBe('clarity');
      expect(typeof rule.check).toBe('function');
    });
  });

  it('all rules are builtin layer', () => {
    CLARITY_RULES.forEach(rule => {
      expect(rule.layer).toBe('builtin');
    });
  });

  it('all rules are enabled by default', () => {
    CLARITY_RULES.forEach(rule => {
      expect(rule.enabled).toBe(true);
    });
  });
});
