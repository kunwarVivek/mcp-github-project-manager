/**
 * Approximate token counter for text content.
 * Uses word-based heuristic (~1.3 tokens per word for English).
 * More accurate than hardcoded constants, no external dependency needed.
 */
export const TokenCounter = {
  /** Estimate token count from text. */
  estimate(text: string): number {
    if (!text) return 0;
    // Split on whitespace and punctuation for better accuracy
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    // Each word averages ~1.3 tokens, plus overhead for punctuation
    return Math.ceil(words.length * 1.3);
  },

  /** Estimate token count from a structured object (JSON serialized). */
  estimateFromObject(obj: unknown): number {
    return TokenCounter.estimate(JSON.stringify(obj));
  },

  /** Check if content fits within a token limit. */
  fitsInLimit(text: string, limit: number): boolean {
    return TokenCounter.estimate(text) <= limit;
  },

  /** Truncate text to fit within a token limit. */
  truncateToLimit(text: string, limit: number): string {
    const estimated = TokenCounter.estimate(text);
    if (estimated <= limit) return text;
    // Estimate character count for limit
    const targetChars = Math.floor((limit / estimated) * text.length * 0.95);
    return `${text.substring(0, targetChars)}\n[...truncated to fit token limit]`;
  },

  /**
   * Total tokens from provider-reported usage, or undefined when none is reported.
   * Accepts a plain number, the legacy flat shape (`inputTokens: number`) and the
   * ai@7 shape (`inputTokens: { total }`, `outputTokens: { total }`).
   */
  fromUsage(usage: unknown): number | undefined {
    const asCount = (value: unknown): number | undefined => {
      if (typeof value === "number") {
        return Number.isFinite(value) && value >= 0 ? value : undefined;
      }
      if (value && typeof value === "object" && "total" in value) return asCount(value.total);
      return undefined;
    };
    if (!usage || typeof usage !== "object") return asCount(usage);
    const input = "inputTokens" in usage ? asCount(usage.inputTokens) : undefined;
    const output = "outputTokens" in usage ? asCount(usage.outputTokens) : undefined;
    if (input !== undefined || output !== undefined) return (input ?? 0) + (output ?? 0);
    if ("totalTokens" in usage) return asCount(usage.totalTokens);
    return asCount(usage);
  },
};
