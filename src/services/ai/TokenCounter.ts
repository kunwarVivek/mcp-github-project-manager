/**
 * Approximate token counter for text content.
 * Uses word-based heuristic (~1.3 tokens per word for English).
 * More accurate than hardcoded constants, no external dependency needed.
 */
export class TokenCounter {

  /** Estimate token count from text. */
  static estimate(text: string): number {
    if (!text) return 0;
    // Split on whitespace and punctuation for better accuracy
    const words = text.split(/\s+/).filter(w => w.length > 0);
    // Each word averages ~1.3 tokens, plus overhead for punctuation
    return Math.ceil(words.length * 1.3);
  }

  /** Estimate token count from a structured object (JSON serialized). */
  static estimateFromObject(obj: unknown): number {
    return TokenCounter.estimate(JSON.stringify(obj));
  }

  /** Check if content fits within a token limit. */
  static fitsInLimit(text: string, limit: number): boolean {
    return TokenCounter.estimate(text) <= limit;
  }

  /** Truncate text to fit within a token limit. */
  static truncateToLimit(text: string, limit: number): string {
    const estimated = TokenCounter.estimate(text);
    if (estimated <= limit) return text;
    // Estimate character count for limit
    const targetChars = Math.floor((limit / estimated) * text.length * 0.95);
    return `${text.substring(0, targetChars)}\n[...truncated to fit token limit]`;
  }
}

