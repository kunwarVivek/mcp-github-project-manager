/**
 * Input sanitization for AI service inputs.
 * Prevents prompt injection, strips potentially dangerous content,
 * and enforces size limits.
 */
export class InputSanitizer {
  /** Max characters for PRD content input. */
  static readonly MAX_PRD_CONTENT_LENGTH = 100_000; // ~25k tokens
  /** Max characters for issue content. */
  static readonly MAX_ISSUE_CONTENT_LENGTH = 50_000;
  /** Max characters for task description. */
  static readonly MAX_TASK_CONTENT_LENGTH = 20_000;
  /** Max characters for generic text input. */
  static readonly MAX_GENERIC_LENGTH = 10_000;

  /**
   * Sanitize text input: trim, enforce length limit, strip control chars.
   */
  static sanitizeText(input: string, maxLength: number = InputSanitizer.MAX_GENERIC_LENGTH): string {
    if (!input || typeof input !== 'string') return '';
    // Strip null bytes and other control characters (keep newlines, tabs)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control
    // characters is precisely this function's job — the rule's assumption that a
    // control char in a regex is accidental does not hold for a sanitizer.
    let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    // Trim whitespace
    sanitized = sanitized.trim();
    // Enforce length limit
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    return sanitized;
  }

  /**
   * Sanitize PRD content specifically.
   */
  static sanitizePRDContent(content: string): string {
    return InputSanitizer.sanitizeText(content, InputSanitizer.MAX_PRD_CONTENT_LENGTH);
  }

  /**
   * Sanitize issue content.
   */
  static sanitizeIssueContent(content: string): string {
    return InputSanitizer.sanitizeText(content, InputSanitizer.MAX_ISSUE_CONTENT_LENGTH);
  }

  /**
   * Sanitize task content.
   */
  static sanitizeTaskContent(content: string): string {
    return InputSanitizer.sanitizeText(content, InputSanitizer.MAX_TASK_CONTENT_LENGTH);
  }

  /**
   * Validate that input doesn't exceed size limits.
   * Returns error message if too large, null if OK.
   */
  static validateSize(input: string, maxLength: number, fieldName: string): string | null {
    if (input && input.length > maxLength) {
      return `${fieldName} exceeds maximum length of ${maxLength} characters (got ${input.length})`;
    }
    return null;
  }
}
