import { PRDDocument } from '../../domain/ai-types';
import { ValidationRuleEngine, ValidationResults, ValidationRule } from './ValidationRuleEngine';
import { COMPLETENESS_RULES } from './rules/CompletenessRules';
import { CLARITY_RULES } from './rules/ClarityRules';

/**
 * PRD-specific validator with built-in rules
 */
export class PRDValidator {
  private ruleEngine: ValidationRuleEngine;

  constructor() {
    this.ruleEngine = new ValidationRuleEngine();

    // Register all built-in rules
    this.ruleEngine.registerRules(COMPLETENESS_RULES);
    this.ruleEngine.registerRules(CLARITY_RULES);
  }

  /**
   * Validate a PRD document
   */
  validate(prd: PRDDocument): ValidationResults {
    return this.ruleEngine.validate(prd);
  }

  /**
   * Get validation summary for display
   */
  getValidationSummary(results: ValidationResults): string {
    const lines: string[] = [];

    lines.push(`PRD Validation Score: ${results.score}/100`);
    lines.push(`Status: ${results.valid ? 'VALID' : 'INVALID'}`);
    lines.push('');
    lines.push(`Rules: ${results.passedRules}/${results.totalRules} passed`);

    if (results.criticalIssues > 0) {
      lines.push(`Critical Issues: ${results.criticalIssues}`);
    }
    if (results.majorIssues > 0) {
      lines.push(`Major Issues: ${results.majorIssues}`);
    }
    if (results.minorIssues > 0) {
      lines.push(`Minor Issues: ${results.minorIssues}`);
    }

    lines.push('');
    lines.push('Issues:');

    const failedResults = results.results.filter(r => !r.result.passed);
    for (const { rule, result } of failedResults) {
      lines.push(`  [${rule.severity.toUpperCase()}] ${rule.name}`);
      lines.push(`    ${result.message}`);
      if (result.suggestedFix) {
        lines.push(`    Fix: ${result.suggestedFix}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Add custom validation rule
   */
  addRule(rule: ValidationRule): void {
    this.ruleEngine.registerRule(rule);
  }

  /**
   * Enable standard rules (optional industry standards)
   */
  enableStandardRules(): void {
    this.ruleEngine.enableLayer('standard');
  }

  /**
   * Enable custom rules
   */
  enableCustomRules(): void {
    this.ruleEngine.enableLayer('custom');
  }

  /**
   * Auto-fix issues where possible
   */
  autoFix(prd: PRDDocument): {
    prd: PRDDocument;
    fixedIssues: string[];
    unfixableIssues: string[];
  } {
    return this.ruleEngine.autoFix(prd);
  }

  /**
   * Get all registered rules
   */
  getRules(): ValidationRule[] {
    return this.ruleEngine.getRules();
  }
}
