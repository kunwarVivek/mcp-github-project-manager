import { AgentStore } from "../agent/AgentStore";
import { createGitHubFactory } from "./tool-factory";

/**
 * Process-wide service instances shared by tools, compound executors and index.ts,
 * so every caller sees the same AgentStore (and its cache) instead of building its own.
 */
let agentStore: AgentStore | undefined;

export function getSharedAgentStore(): AgentStore {
  if (!agentStore) {
    agentStore = new AgentStore(createGitHubFactory());
  }
  return agentStore;
}

/** Drop memoized services so tests get a fresh instance. */
export function resetSharedServicesForTests(): void {
  agentStore = undefined;
}
