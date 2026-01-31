import { PRDDocument } from '../../domain/ai-types';

/**
 * Validation rule severity levels
 */
export type ValidationSeverity = 'critical' | 'major' | 'minor';

/**
 * Validation rule categories
 */
export type ValidationCategory = 'completeness' | 'clarity' | 'feasibility' | 'testability' | 'consistency';

/**
 * Validation rule layers
 */
export type ValidationLayer = 'builtin' | 'standard' | 'custom';

/**
 * Result of a single validation check
 */
export interface ValidationCheckResult {
  passed: boolean;
  message: string;
  location?: string;           // Where in the document the issue is
  suggestedFix?: string;       // How to fix the issue
  diff?: {
    before: string;
    after: string;
  };
  affectedSection?: string;
}

/**
 * Validation rule interface
 */
export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  layer: ValidationLayer;
  severity: ValidationSeverity;
  category: ValidationCategory;
  enabled: boolean;
  check: (prd: PRDDocument) => ValidationCheckResult;
  autoFix?: (prd: PRDDocument) => PRDDocument;
}

/**
 * Aggregated validation results
 */
export interface ValidationResults {
  valid: boolean;
  score: number;               // 0-100 quality score
  totalRules: number;
  passedRules: number;
  failedRules: number;
  results: Array<{
    rule: Pick<ValidationRule, 'id' | 'name' | 'severity' | 'category'>;
    result: ValidationCheckResult;
  }>;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
}

/**
 * Validation rule engine with layered rule support
 */
export class ValidationRuleEngine {
  private rules: Map<string, ValidationRule> = new Map();
  private enabledLayers: Set<ValidationLayer> = new Set(['builtin']);

  constructor() {
    // Built-in rules are always enabled by default
    this.enabledLayers.add('builtin');
  }

  /**
   * Register a validation rule
   */
  registerRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Register multiple rules
   */
  registerRules(rules: ValidationRule[]): void {
    for (const rule of rules) {
      this.registerRule(rule);
    }
  }

  /**
   * Enable a validation layer
   */
  enableLayer(layer: ValidationLayer): void {
    this.enabledLayers.add(layer);
  }

  /**
   * Disable a validation layer
   */
  disableLayer(layer: ValidationLayer): void {
    // Can't disable builtin
    if (layer !== 'builtin') {
      this.enabledLayers.delete(layer);
    }
  }

  /**
   * Enable/disable a specific rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Get all registered rules
   */
  getRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules by category
   */
  getRulesByCategory(category: ValidationCategory): ValidationRule[] {
    return this.getRules().filter(r => r.category === category);
  }

  /**
   * Run all enabled rules against a PRD
   */
  validate(prd: PRDDocument): ValidationResults {
    const results: ValidationResults['results'] = [];
    let passedRules = 0;
    let failedRules = 0;
    let criticalIssues = 0;
    let majorIssues = 0;
    let minorIssues = 0;

    for (const rule of this.rules.values()) {
      // Skip disabled rules or rules from disabled layers
      if (!rule.enabled || !this.enabledLayers.has(rule.layer)) {
        continue;
      }

      try {
        const checkResult = rule.check(prd);

        results.push({
          rule: {
            id: rule.id,
            name: rule.name,
            severity: rule.severity,
            category: rule.category
          },
          result: checkResult
        });

        if (checkResult.passed) {
          passedRules++;
        } else {
          failedRules++;

          switch (rule.severity) {
            case 'critical':
              criticalIssues++;
              break;
            case 'major':
              majorIssues++;
              break;
            case 'minor':
              minorIssues++;
              break;
          }
        }
      } catch (error) {
        // Rule execution failed - treat as failed check
        results.push({
          rule: {
            id: rule.id,
            name: rule.name,
            severity: rule.severity,
            category: rule.category
          },
          result: {
            passed: false,
            message: `Rule execution error: ${error instanceof Error ? error.message : String(error)}`
          }
        });
        failedRules++;
        minorIssues++;
      }
    }

    const totalRules = passedRules + failedRules;
    const score = totalRules > 0
      ? Math.round((passedRules / totalRules) * 100 - (criticalIssues * 10) - (majorIssues * 5))
      : 100;

    return {
      valid: criticalIssues === 0,  // Valid if no critical issues
      score: Math.max(0, Math.min(100, score)),
      totalRules,
      passedRules,
      failedRules,
      results,
      criticalIssues,
      majorIssues,
      minorIssues
    };
  }

  /**
   * Auto-fix issues where possible
   */
  autoFix(prd: PRDDocument, ruleIds?: string[]): {
    prd: PRDDocument;
    fixedIssues: string[];
    unfixableIssues: string[];
  } {
    let fixedPrd = { ...prd };
    const fixedIssues: string[] = [];
    const unfixableIssues: string[] = [];

    const rulesToCheck = ruleIds
      ? ruleIds.map(id => this.rules.get(id)).filter((r): r is ValidationRule => r !== undefined)
      : Array.from(this.rules.values());

    for (const rule of rulesToCheck) {
      if (!rule.enabled || !this.enabledLayers.has(rule.layer)) {
        continue;
      }

      const checkResult = rule.check(fixedPrd);

      if (!checkResult.passed) {
        if (rule.autoFix) {
          try {
            fixedPrd = rule.autoFix(fixedPrd);
            fixedIssues.push(rule.id);
          } catch {
            unfixableIssues.push(rule.id);
          }
        } else {
          unfixableIssues.push(rule.id);
        }
      }
    }

    return { prd: fixedPrd, fixedIssues, unfixableIssues };
  }
}
