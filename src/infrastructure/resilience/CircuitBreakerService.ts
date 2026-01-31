/**
 * CircuitBreakerService - Wraps Cockatiel circuit breaker for resilient operations.
 *
 * Provides protection against cascading failures by tracking consecutive failures
 * and opening the circuit to prevent additional requests when a threshold is reached.
 *
 * States:
 * - closed: Normal operation, requests pass through
 * - open: Circuit tripped, requests fail fast
 * - half-open: Testing if service has recovered
 */

import {
  circuitBreaker,
  ConsecutiveBreaker,
  handleAll,
  CircuitState,
  type CircuitBreakerPolicy,
} from 'cockatiel';

/**
 * Configuration options for the circuit breaker
 */
export interface CircuitBreakerConfig {
  /**
   * Time in milliseconds before the circuit breaker transitions from open to half-open.
   * Default: 30000 (30 seconds)
   */
  halfOpenAfter?: number;

  /**
   * Number of consecutive failures before the circuit opens.
   * Default: 5
   */
  consecutiveFailures?: number;
}

/**
 * Circuit breaker state type
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * CircuitBreakerService wraps Cockatiel's circuit breaker with state tracking
 * and logging for observability.
 */
export class CircuitBreakerService {
  private readonly circuitBreaker: CircuitBreakerPolicy;
  private currentState: CircuitBreakerState = 'closed';
  private readonly name: string;

  /**
   * Creates a new CircuitBreakerService.
   *
   * @param name - Identifier for logging and monitoring
   * @param config - Optional configuration for circuit breaker behavior
   */
  constructor(name: string, config?: CircuitBreakerConfig) {
    this.name = name;
    const halfOpenAfter = config?.halfOpenAfter ?? 30000;
    const consecutiveFailures = config?.consecutiveFailures ?? 5;

    // Create the circuit breaker with consecutive failure tracking
    this.circuitBreaker = circuitBreaker(handleAll, {
      halfOpenAfter,
      breaker: new ConsecutiveBreaker(consecutiveFailures),
    });

    // Track state changes for observability
    this.circuitBreaker.onStateChange((state: CircuitState) => {
      this.currentState = this.mapCircuitState(state);
      process.stderr.write(
        `[CircuitBreaker:${this.name}] State: ${this.currentState}\n`
      );
    });
  }

  /**
   * Execute an operation through the circuit breaker.
   *
   * If the circuit is open, the operation will fail fast without executing.
   * If the circuit is closed or half-open, the operation will be executed
   * and its success/failure will be tracked.
   *
   * @param fn - The async operation to execute
   * @returns The result of the operation
   * @throws The error from the operation if it fails, or a circuit open error
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.execute(fn);
  }

  /**
   * Get the current state of the circuit breaker.
   *
   * @returns The current circuit state
   */
  getState(): CircuitBreakerState {
    return this.currentState;
  }

  /**
   * Check if the circuit is currently open (blocking requests).
   *
   * @returns true if the circuit is open
   */
  isOpen(): boolean {
    return this.currentState === 'open';
  }

  /**
   * Map Cockatiel's CircuitState enum to our string literal type.
   */
  private mapCircuitState(state: CircuitState): CircuitBreakerState {
    switch (state) {
      case CircuitState.Closed:
        return 'closed';
      case CircuitState.Open:
        return 'open';
      case CircuitState.HalfOpen:
        return 'half-open';
      default:
        return 'closed';
    }
  }
}
