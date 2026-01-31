/**
 * AIResiliencePolicy - Composed resilience policy for AI service calls.
 *
 * Combines multiple resilience patterns in the correct order:
 * 1. Fallback (outer) - Catches all failures and provides fallback response
 * 2. Retry - Retries failed operations with exponential backoff
 * 3. Circuit Breaker - Prevents cascading failures
 * 4. Timeout (inner) - Ensures operations complete within time limit
 *
 * The composition order matters: fallback catches retry failures,
 * retry wraps circuit breaker calls, circuit breaker wraps timeouts.
 */

import {
  wrap,
  retry,
  timeout,
  fallback,
  handleAll,
  ExponentialBackoff,
  TaskCancelledError,
  TimeoutStrategy,
} from 'cockatiel';
import { CircuitBreakerService, type CircuitBreakerState } from './CircuitBreakerService.js';

/**
 * Configuration options for AI resilience policy
 */
export interface AIResilienceConfig {
  /**
   * Maximum number of retry attempts.
   * Default: 3
   */
  maxRetries?: number;

  /**
   * Timeout in milliseconds for each operation.
   * Default: 30000 (30 seconds)
   */
  timeoutMs?: number;

  /**
   * Time in milliseconds before circuit transitions from open to half-open.
   * Default: 30000 (30 seconds)
   */
  halfOpenAfterMs?: number;

  /**
   * Number of consecutive failures before circuit opens.
   * Default: 5
   */
  consecutiveFailures?: number;
}

/**
 * Result returned when AI service is degraded/unavailable
 */
export interface DegradedResult {
  /**
   * Indicates this is a degraded fallback response
   */
  degraded: true;

  /**
   * Human-readable message about the degradation
   */
  message: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<AIResilienceConfig> = {
  maxRetries: 3,
  timeoutMs: 30000,
  halfOpenAfterMs: 30000,
  consecutiveFailures: 5,
};

/**
 * AIResiliencePolicy provides fault-tolerant execution for AI service calls.
 *
 * Wraps operations with:
 * - Timeout: Ensures operations don't hang indefinitely
 * - Circuit Breaker: Prevents repeated calls to failing services
 * - Retry: Automatically retries transient failures
 * - Fallback: Provides graceful degradation when all else fails
 *
 * @example
 * ```typescript
 * const policy = new AIResiliencePolicy({ maxRetries: 2, timeoutMs: 5000 });
 *
 * const result = await policy.execute(
 *   () => aiService.generateText(prompt),
 *   () => ({ degraded: true, message: 'AI unavailable, using cached response' })
 * );
 *
 * if ('degraded' in result) {
 *   console.log('Fallback used:', result.message);
 * } else {
 *   console.log('AI response:', result);
 * }
 * ```
 */
export class AIResiliencePolicy {
  private readonly circuitBreaker: CircuitBreakerService;
  private readonly config: Required<AIResilienceConfig>;
  private readonly timeoutPolicy: ReturnType<typeof timeout>;
  private readonly retryPolicy: ReturnType<typeof retry>;

  /**
   * Creates a new AIResiliencePolicy.
   *
   * @param config - Optional configuration for resilience behavior
   */
  constructor(config?: AIResilienceConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create circuit breaker for AI calls
    this.circuitBreaker = new CircuitBreakerService('AI', {
      halfOpenAfter: this.config.halfOpenAfterMs,
      consecutiveFailures: this.config.consecutiveFailures,
    });

    // Create timeout policy (Cooperative strategy to allow graceful cancellation)
    this.timeoutPolicy = timeout(this.config.timeoutMs, TimeoutStrategy.Cooperative);

    // Create retry policy with exponential backoff
    this.retryPolicy = retry(handleAll, {
      maxAttempts: this.config.maxRetries,
      backoff: new ExponentialBackoff(),
    });

    process.stderr.write(
      `[AIResiliencePolicy] Initialized with: maxRetries=${this.config.maxRetries}, ` +
      `timeoutMs=${this.config.timeoutMs}, consecutiveFailures=${this.config.consecutiveFailures}\n`
    );
  }

  /**
   * Execute an operation with full resilience protection.
   *
   * The operation is wrapped with (from outer to inner):
   * 1. Fallback - catches all failures
   * 2. Retry - retries with exponential backoff
   * 3. Circuit Breaker - prevents cascading failures
   * 4. Timeout - ensures timely completion
   *
   * @param operation - The async operation to execute
   * @param fallbackFn - Optional function to provide fallback response
   * @returns The operation result, or a DegradedResult if fallback is used
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallbackFn?: () => T | DegradedResult
  ): Promise<T | DegradedResult> {
    // Default fallback
    const defaultFallback = (): DegradedResult => ({
      degraded: true,
      message: 'AI service unavailable',
    });

    // Create fallback policy
    const fallbackPolicy = fallback(handleAll, () => {
      const result = fallbackFn?.() ?? defaultFallback();
      const isDegraded = result !== null &&
        typeof result === 'object' &&
        'degraded' in result;
      process.stderr.write(
        `[AIResiliencePolicy] Fallback triggered: ${
          isDegraded ? (result as DegradedResult).message : 'custom fallback'
        }\n`
      );
      return result;
    });

    // Compose policies: fallback(retry(circuitBreaker(timeout(operation))))
    // Using wrap() to compose in correct order
    const wrappedPolicy = wrap(
      fallbackPolicy,
      this.retryPolicy,
    );

    // Execute with composed policy, circuit breaker, and timeout
    return wrappedPolicy.execute(async () => {
      return this.circuitBreaker.execute(async () => {
        return this.timeoutPolicy.execute(async ({ signal }) => {
          // Check if operation was cancelled due to timeout
          if (signal.aborted) {
            throw new TaskCancelledError('Operation timed out');
          }
          return operation();
        });
      });
    });
  }

  /**
   * Get the current state of the circuit breaker.
   *
   * @returns The current circuit state: 'closed', 'open', or 'half-open'
   */
  getCircuitState(): CircuitBreakerState {
    return this.circuitBreaker.getState();
  }

  /**
   * Check if the circuit is currently open (blocking requests).
   *
   * When the circuit is open, execute() will immediately use the fallback
   * without attempting the operation.
   *
   * @returns true if the circuit is open
   */
  isCircuitOpen(): boolean {
    return this.circuitBreaker.isOpen();
  }

  /**
   * Get the current configuration.
   *
   * @returns The resolved configuration with defaults applied
   */
  getConfig(): Readonly<Required<AIResilienceConfig>> {
    return this.config;
  }
}

/**
 * Create an AIResiliencePolicy instance.
 *
 * Factory function for convenient instantiation.
 *
 * @param config - Optional configuration
 * @returns A new AIResiliencePolicy instance
 *
 * @example
 * ```typescript
 * const policy = createAIResiliencePolicy({ maxRetries: 2 });
 * const result = await policy.execute(() => aiService.call());
 * ```
 */
export function createAIResiliencePolicy(
  config?: AIResilienceConfig
): AIResiliencePolicy {
  return new AIResiliencePolicy(config);
}
