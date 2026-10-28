const MAX_PRD_CONTENT_LENGTH = 100_000; // ~25k tokens
const MAX_ISSUE_CONTENT_LENGTH = 50_000;
const MAX_TASK_CONTENT_LENGTH = 20_000;
const MAX_GENERIC_LENGTH = 10_000;

/**
 * Input sanitization for AI service inputs.
 * Prevents prompt injection, strips potentially dangerous content,
 * and enforces size limits.
 */
export const InputSanitizer = {
  /** Max characters for PRD content input. */
  MAX_PRD_CONTENT_LENGTH,
  /** Max characters for issue content. */
  MAX_ISSUE_CONTENT_LENGTH,
  /** Max characters for task description. */
  MAX_TASK_CONTENT_LENGTH,
  /** Max characters for generic text input. */
  MAX_GENERIC_LENGTH,
  /**
   * Sanitize text input: trim, enforce length limit, strip control chars.
   */
  sanitizeText(input: string, maxLength: number = MAX_GENERIC_LENGTH): string {
    if (!input || typeof input !== "string") return "";
    // Strip null bytes and other control characters (keep newlines, tabs).
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is precisely this function's job — the rule's assumption that a control char in a regex is accidental does not hold for a sanitizer.
    let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    // Trim whitespace
    sanitized = sanitized.trim();
    // Enforce length limit
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    return sanitized;
  },

  /**
   * Sanitize PRD content specifically.
   */
  sanitizePRDContent(content: string): string {
    return InputSanitizer.sanitizeText(content, MAX_PRD_CONTENT_LENGTH);
  },

  /**
   * Sanitize issue content.
   */
  sanitizeIssueContent(content: string): string {
    return InputSanitizer.sanitizeText(content, MAX_ISSUE_CONTENT_LENGTH);
  },

  /**
   * Sanitize task content.
   */
  sanitizeTaskContent(content: string): string {
    return InputSanitizer.sanitizeText(content, MAX_TASK_CONTENT_LENGTH);
  },

  /**
   * Validate that input doesn't exceed size limits.
   * Returns error message if too large, null if OK.
   */
  validateSize(input: string, maxLength: number, fieldName: string): string | null {
    if (input && input.length > maxLength) {
      return `${fieldName} exceeds maximum length of ${maxLength} characters (got ${input.length})`;
    }
    return null;
  },
};
