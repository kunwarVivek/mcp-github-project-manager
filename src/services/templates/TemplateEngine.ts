import Handlebars from 'handlebars';
import { ParsedTemplate, TemplateSection } from '../../domain/template-types';
import { TemplateParser } from './TemplateParser';

/**
 * Handlebars-based template engine for PRD and task templates
 */
export class TemplateEngine {
  private parser: TemplateParser;
  private compiledCache: Map<string, HandlebarsTemplateDelegate<unknown>>;

  constructor() {
    this.parser = new TemplateParser();
    this.compiledCache = new Map();
    this.registerHelpers();
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // Safe iteration helper
    Handlebars.registerHelper('each_safe', function(
      this: unknown,
      context: unknown[],
      options: Handlebars.HelperOptions
    ) {
      if (!context || !Array.isArray(context)) {
        return '';
      }
      return context.map((item, index) => {
        const itemObj = typeof item === 'object' && item !== null ? item : { value: item };
        return options.fn({ ...(itemObj as Record<string, unknown>), '@index': index, '@first': index === 0, '@last': index === context.length - 1 });
      }).join('');
    });

    // Conditional with default
    Handlebars.registerHelper('default', function(value: unknown, defaultValue: unknown) {
      return value !== undefined && value !== null && value !== '' ? value : defaultValue;
    });

    // Format as list
    Handlebars.registerHelper('list', function(items: string[]) {
      if (!items || !Array.isArray(items)) return '';
      return items.map(item => `- ${item}`).join('\n');
    });

    // Format as numbered list
    Handlebars.registerHelper('numbered_list', function(items: string[]) {
      if (!items || !Array.isArray(items)) return '';
      return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
    });

    // Join array with separator
    Handlebars.registerHelper('join', function(items: string[], separator: string) {
      if (!items || !Array.isArray(items)) return '';
      return items.join(typeof separator === 'string' ? separator : ', ');
    });

    // Conditional section - only render if value exists and is non-empty
    Handlebars.registerHelper('section_if', function(
      this: unknown,
      condition: unknown,
      options: Handlebars.HelperOptions
    ) {
      const isEmpty = condition === undefined ||
        condition === null ||
        condition === '' ||
        (Array.isArray(condition) && condition.length === 0);

      return isEmpty ? '' : options.fn(this);
    });
  }

  /**
   * Parse template content
   */
  parse(content: string, name?: string): ParsedTemplate {
    return this.parser.parse(content, name);
  }

  /**
   * Compile template for repeated use
   */
  compile(template: string | ParsedTemplate): HandlebarsTemplateDelegate<unknown> {
    const content = typeof template === 'string' ? template : template.rawContent;
    const cacheKey = content.substring(0, 200);

    if (this.compiledCache.has(cacheKey)) {
      return this.compiledCache.get(cacheKey)!;
    }

    try {
      const compiled = Handlebars.compile(content);
      this.compiledCache.set(cacheKey, compiled);
      return compiled;
    } catch (error) {
      throw new Error(`Template compilation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Render template with data
   */
  render(template: string | ParsedTemplate, data: Record<string, unknown>): string {
    const compiled = this.compile(template);
    try {
      return compiled(data);
    } catch (error) {
      throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Pre-validate template syntax without rendering
   */
  validateSyntax(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      Handlebars.precompile(template);
    } catch (error) {
      errors.push(`Syntax error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Check for unclosed tags
    const openTags = (template.match(/\{\{#/g) || []).length;
    const closeTags = (template.match(/\{\{\//g) || []).length;
    if (openTags !== closeTags) {
      errors.push(`Mismatched block tags: ${openTags} opening, ${closeTags} closing`);
    }

    // Check for empty placeholders
    if (/\{\{\s*\}\}/.test(template)) {
      errors.push('Empty placeholder found: {{}}');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get required placeholders that have no default value
   */
  getRequiredPlaceholders(template: ParsedTemplate): string[] {
    return template.sections
      .filter(s => s.required && !s.defaultValue)
      .map(s => s.id);
  }

  /**
   * Create a preview with sample data
   */
  preview(template: string | ParsedTemplate, partialData?: Record<string, unknown>): string {
    const parsed = typeof template === 'string' ? this.parse(template) : template;

    // Generate sample data for missing placeholders
    const sampleData: Record<string, unknown> = { ...partialData };

    for (const placeholder of parsed.placeholders) {
      if (sampleData[placeholder] === undefined) {
        sampleData[placeholder] = `[${placeholder}]`;
      }
    }

    return this.render(parsed, sampleData);
  }

  /**
   * Clear compiled template cache
   */
  clearCache(): void {
    this.compiledCache.clear();
  }
}
