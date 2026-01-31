import {
  TemplateFormat,
  TemplateSection,
  ParsedTemplate,
  TemplateValidationResult
} from '../../domain/template-types';

/**
 * Detect template format from content
 *
 * Detection rules:
 * 1. If valid JSON with $schema or type="object" -> json-schema
 * 2. If valid JSON with example/sample fields -> example-based
 * 3. If contains {{placeholders}} -> markdown
 * 4. Default -> example-based (treat as example to learn from)
 */
export function detectTemplateFormat(content: string): TemplateFormat {
  const trimmed = content.trim();

  // Try parsing as JSON first
  try {
    const parsed = JSON.parse(trimmed);

    // Check for JSON Schema indicators
    if (parsed.$schema || parsed.type === 'object' || parsed.properties) {
      return 'json-schema';
    }

    // Check for example-based indicators
    if (parsed.example || parsed.sample || parsed.template?.example) {
      return 'example-based';
    }

    // JSON but not schema or example -> treat as example
    return 'example-based';
  } catch {
    // Not JSON - check for markdown placeholders
    if (/\{\{[^}]+\}\}/.test(trimmed)) {
      return 'markdown';
    }

    // Plain text - treat as example
    return 'example-based';
  }
}

/**
 * Extract placeholders from markdown template
 */
export function extractPlaceholders(content: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = [...content.matchAll(regex)];
  const placeholders = matches.map(m => m[1].trim());

  // Deduplicate while preserving order
  return [...new Set(placeholders)];
}

/**
 * Extract sections from markdown template
 * Looks for ## or ### headers with content
 */
export function extractMarkdownSections(content: string): TemplateSection[] {
  const sections: TemplateSection[] = [];
  const lines = content.split('\n');

  let currentSection: Partial<TemplateSection> | null = null;
  let currentContent: string[] = [];
  let sectionIndex = 0;

  for (const line of lines) {
    const headerMatch = line.match(/^(#{2,3})\s+(.+)/);

    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.description = currentContent.join('\n').trim();
        sections.push(currentSection as TemplateSection);
      }

      // Start new section
      const name = headerMatch[2].trim();
      currentSection = {
        id: `section-${sectionIndex++}`,
        name,
        description: '',
        required: !name.toLowerCase().includes('optional'),
        placeholder: extractPlaceholders(name)[0] || name
      };
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Don't forget last section
  if (currentSection) {
    currentSection.description = currentContent.join('\n').trim();
    sections.push(currentSection as TemplateSection);
  }

  return sections;
}

/**
 * Extract sections from JSON Schema
 */
export function extractJsonSchemaSections(schema: Record<string, unknown>): TemplateSection[] {
  const sections: TemplateSection[] = [];
  const properties = (schema.properties || {}) as Record<string, unknown>;
  const required = (schema.required || []) as string[];

  for (const [key, value] of Object.entries(properties)) {
    const prop = value as Record<string, unknown>;
    sections.push({
      id: key,
      name: (prop.title as string) || key,
      description: (prop.description as string) || '',
      required: required.includes(key),
      minLength: prop.minLength as number | undefined,
      maxLength: prop.maxLength as number | undefined,
      defaultValue: prop.default as string | undefined
    });
  }

  return sections;
}

/**
 * Parse template into structured format
 */
export class TemplateParser {
  /**
   * Parse template content into structured format
   */
  parse(content: string, name: string = 'Untitled Template'): ParsedTemplate {
    const format = detectTemplateFormat(content);

    let sections: TemplateSection[] = [];
    let placeholders: string[] = [];
    let description: string | undefined;

    switch (format) {
      case 'markdown':
        sections = extractMarkdownSections(content);
        placeholders = extractPlaceholders(content);
        break;

      case 'json-schema':
        try {
          const schema = JSON.parse(content);
          sections = extractJsonSchemaSections(schema);
          placeholders = sections.map(s => s.id);
          description = schema.description;
        } catch {
          sections = [];
          placeholders = [];
        }
        break;

      case 'example-based':
        // For example-based, we extract structure from the example
        try {
          const example = JSON.parse(content);
          const exampleContent = example.example || example.sample || example;
          sections = this.inferSectionsFromExample(exampleContent);
          placeholders = sections.map(s => s.id);
          description = example.description;
        } catch {
          // Plain text example - minimal structure
          sections = [{
            id: 'content',
            name: 'Content',
            description: 'Main content based on example',
            required: true
          }];
          placeholders = ['content'];
        }
        break;
    }

    return {
      format,
      name,
      description,
      sections,
      placeholders,
      rawContent: content
    };
  }

  /**
   * Infer sections from an example document
   */
  private inferSectionsFromExample(example: unknown): TemplateSection[] {
    if (typeof example !== 'object' || example === null) {
      return [];
    }

    const sections: TemplateSection[] = [];
    const obj = example as Record<string, unknown>;

    for (const [key, value] of Object.entries(obj)) {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      sections.push({
        id: key,
        name: this.formatSectionName(key),
        description: `Section for ${key}. Example: ${valueStr.substring(0, 100)}...`,
        required: true,
        minLength: typeof value === 'string' ? Math.floor(value.length * 0.5) : undefined
      });
    }

    return sections;
  }

  /**
   * Convert camelCase or snake_case to Title Case
   */
  private formatSectionName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\s/, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
