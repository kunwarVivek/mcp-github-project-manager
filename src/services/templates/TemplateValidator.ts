import { ParsedTemplate, TemplateValidationResult, TemplateSection } from '../../domain/template-types';
import { TemplateParser, extractPlaceholders } from './TemplateParser';
import { TemplateEngine } from './TemplateEngine';

/**
 * Recommended sections for PRD templates
 */
const RECOMMENDED_PRD_SECTIONS = [
  'overview',
  'objectives',
  'features',
  'scope',
  'timeline',
  'users',
  'requirements',
  'success'
];

/**
 * Recommended sections for task templates
 */
const RECOMMENDED_TASK_SECTIONS = [
  'title',
  'description',
  'acceptance',
  'dependencies',
  'effort',
  'priority'
];

/**
 * Template validator with syntax, coverage, and best practice checks
 */
export class TemplateValidator {
  private parser: TemplateParser;
  private engine: TemplateEngine;

  constructor() {
    this.parser = new TemplateParser();
    this.engine = new TemplateEngine();
  }

  /**
   * Validate template syntax
   */
  validateSyntax(templateContent: string): {
    valid: boolean;
    errors: string[];
  } {
    return this.engine.validateSyntax(templateContent);
  }

  /**
   * Validate template coverage against recommended sections
   */
  validateCoverage(
    template: ParsedTemplate,
    templateType: 'prd' | 'task' = 'prd'
  ): {
    covered: string[];
    missing: string[];
    extra: string[];
    coveragePercent: number;
  } {
    const recommended = templateType === 'prd'
      ? RECOMMENDED_PRD_SECTIONS
      : RECOMMENDED_TASK_SECTIONS;

    const templateSectionNames = template.sections.map(s =>
      s.name.toLowerCase().replace(/[^a-z]/g, '')
    );

    // Also check placeholders
    const templatePlaceholders = template.placeholders.map(p =>
      p.toLowerCase().replace(/[^a-z]/g, '')
    );

    const allTemplateTerms = [...templateSectionNames, ...templatePlaceholders];

    const covered: string[] = [];
    const missing: string[] = [];

    for (const rec of recommended) {
      const found = allTemplateTerms.some(term =>
        term.includes(rec) || rec.includes(term)
      );

      if (found) {
        covered.push(rec);
      } else {
        missing.push(rec);
      }
    }

    // Find sections that aren't in recommended (not necessarily bad)
    const extra = template.sections
      .map(s => s.name)
      .filter(name => {
        const normalized = name.toLowerCase().replace(/[^a-z]/g, '');
        return !recommended.some(rec =>
          normalized.includes(rec) || rec.includes(normalized)
        );
      });

    const coveragePercent = Math.round((covered.length / recommended.length) * 100);

    return { covered, missing, extra, coveragePercent };
  }

  /**
   * Validate section requirements
   */
  validateSectionRequirements(sections: TemplateSection[]): {
    valid: boolean;
    issues: Array<{ section: string; issue: string; severity: 'error' | 'warning' }>;
  } {
    const issues: Array<{ section: string; issue: string; severity: 'error' | 'warning' }> = [];

    for (const section of sections) {
      // Check for empty names
      if (!section.name || section.name.trim().length === 0) {
        issues.push({
          section: section.id,
          issue: 'Section has no name',
          severity: 'error'
        });
      }

      // Check for very long min lengths
      if (section.minLength && section.minLength > 10000) {
        issues.push({
          section: section.name,
          issue: 'Minimum length is excessively high (>10000)',
          severity: 'warning'
        });
      }

      // Check for max < min
      if (section.minLength && section.maxLength && section.maxLength < section.minLength) {
        issues.push({
          section: section.name,
          issue: 'Maximum length is less than minimum length',
          severity: 'error'
        });
      }
    }

    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues
    };
  }

  /**
   * Full template validation
   */
  validate(
    templateContent: string,
    templateType: 'prd' | 'task' = 'prd',
    templateName?: string
  ): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Syntax validation
    const syntaxResult = this.validateSyntax(templateContent);
    if (!syntaxResult.valid) {
      errors.push(...syntaxResult.errors);
    }

    // 2. Parse template
    let template: ParsedTemplate;
    try {
      template = this.parser.parse(templateContent, templateName);
    } catch (e) {
      errors.push(`Parse error: ${e instanceof Error ? e.message : String(e)}`);
      return {
        valid: false,
        errors,
        warnings,
        placeholders: [],
        missingSections: []
      };
    }

    // 3. Coverage validation
    const coverage = this.validateCoverage(template, templateType);
    if (coverage.missing.length > 0) {
      warnings.push(
        `Missing recommended sections: ${coverage.missing.join(', ')}. ` +
        `Coverage: ${coverage.coveragePercent}%`
      );
    }

    // 4. Section requirements validation
    const sectionValidation = this.validateSectionRequirements(template.sections);
    for (const issue of sectionValidation.issues) {
      if (issue.severity === 'error') {
        errors.push(`${issue.section}: ${issue.issue}`);
      } else {
        warnings.push(`${issue.section}: ${issue.issue}`);
      }
    }

    // 5. Placeholder validation
    const placeholders = extractPlaceholders(templateContent);

    // Check for duplicate placeholders with different casings
    const normalizedPlaceholders = new Map<string, string[]>();
    for (const p of placeholders) {
      const normalized = p.toLowerCase();
      if (!normalizedPlaceholders.has(normalized)) {
        normalizedPlaceholders.set(normalized, []);
      }
      normalizedPlaceholders.get(normalized)!.push(p);
    }

    for (const [normalized, variants] of normalizedPlaceholders) {
      if (variants.length > 1) {
        warnings.push(
          `Placeholder '${normalized}' has multiple casings: ${variants.join(', ')}. ` +
          'This may cause confusion.'
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      placeholders,
      missingSections: coverage.missing
    };
  }

  /**
   * Generate sample data for template preview
   */
  generateSampleData(template: ParsedTemplate): Record<string, unknown> {
    const sampleData: Record<string, unknown> = {};

    for (const section of template.sections) {
      if (section.defaultValue) {
        sampleData[section.id] = section.defaultValue;
      } else {
        // Generate placeholder content based on section type
        const name = section.name.toLowerCase();

        if (name.includes('list') || name.includes('features') || name.includes('objectives')) {
          sampleData[section.id] = ['Example item 1', 'Example item 2', 'Example item 3'];
        } else if (name.includes('date') || name.includes('timeline')) {
          sampleData[section.id] = new Date().toISOString().split('T')[0];
        } else if (name.includes('number') || name.includes('count') || name.includes('effort')) {
          sampleData[section.id] = 5;
        } else {
          sampleData[section.id] = `Sample ${section.name} content`;
        }
      }
    }

    return sampleData;
  }
}
