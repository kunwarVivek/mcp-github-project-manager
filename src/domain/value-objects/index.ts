/**
 * Value Objects Module
 *
 * Provides immutable value objects for computed metrics and complex values.
 */

export {
  SprintMetrics,
} from './SprintMetrics';

export {
  MilestoneMetrics,
} from './MilestoneMetrics';

export {
  AgentMetrics,
} from './AgentMetrics';

// Type-only re-exports. Required by `isolatedModules`: these are types, and a
// per-file transpiler (tsx/esbuild/bundlers) would otherwise emit them as real
// runtime imports that fail to resolve.
export type { AgentMetricsConfig } from './AgentMetrics';
export type { MilestoneMetricsConfig } from './MilestoneMetrics';
export type { SprintMetricsConfig } from './SprintMetrics';
