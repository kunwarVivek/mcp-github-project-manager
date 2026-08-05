/**
 * Approximate token counter for text content.
 * Uses word-based heuristic (~1.3 tokens per word for English).
 * More accurate than hardcoded constants, no external dependency needed.
 */
export class TokenCounter {
  /** Average characters per token (English text, GPT-family models). */
  private static readonly CHARS_PER_TOKEN = 4;

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

  /** Check if content fits within a token budget. */
  static fitsInBudget(text: string, budget: number): boolean {
    return TokenCounter.estimate(text) <= budget;
  }

  /** Truncate text to fit within a token budget. */
  static truncateToFit(text: string, budget: number): string {
    const estimated = TokenCounter.estimate(text);
    if (estimated <= budget) return text;
    // Estimate character count for budget
    const targetChars = Math.floor((budget / estimated) * text.length * 0.95);
    return text.substring(0, targetChars) + '\n[...truncated to fit token budget]';
  }
}

/**
 * Manages token budget for AI requests.
 */
export class TokenBudgetManager {
  private readonly maxInputTokens: number;
  private readonly maxOutputTokens: number;
  private totalInputTokensUsed = 0;
  private totalOutputTokensUsed = 0;
  private requestCount = 0;

  constructor(options?: { maxInputTokens?: number; maxOutputTokens?: number }) {
    this.maxInputTokens = options?.maxInputTokens ?? 100_000;
    this.maxOutputTokens = options?.maxOutputTokens ?? 16_000;
  }

  /** Check if a request fits within remaining budget. */
  canAfford(estimatedInputTokens: number): boolean {
    return this.totalInputTokensUsed + estimatedInputTokens <= this.maxInputTokens;
  }

  /** Record token usage for a request. */
  recordUsage(inputTokens: number, outputTokens: number): void {
    this.totalInputTokensUsed += inputTokens;
    this.totalOutputTokensUsed += outputTokens;
    this.requestCount++;
  }

  /** Get usage statistics. */
  getStats(): { inputUsed: number; outputUsed: number; inputBudget: number; outputBudget: number; requests: number } {
    return {
      inputUsed: this.totalInputTokensUsed,
      outputUsed: this.totalOutputTokensUsed,
      inputBudget: this.maxInputTokens,
      outputBudget: this.maxOutputTokens,
      requests: this.requestCount,
    };
  }

  /** Reset usage counters. */
  reset(): void {
    this.totalInputTokensUsed = 0;
    this.totalOutputTokensUsed = 0;
    this.requestCount = 0;
  }
}
