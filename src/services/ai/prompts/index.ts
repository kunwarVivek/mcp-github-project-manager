import { registerConfidencePrompts } from "./ConfidencePrompts";
import { registerContextPrompts } from "./ContextGenerationPrompts";
import { registerFeaturePrompts } from "./FeatureAdditionPrompts";
import { registerIssuePrompts } from "./IssueIntelligencePrompts";
import { registerPRDPrompts } from "./PRDGenerationPrompts";
import { PromptRegistry } from "./PromptRegistry";
import { registerRoadmapPrompts } from "./RoadmapPrompts";
import { registerSprintPrompts } from "./SprintPlanningPrompts";
import { registerTaskPrompts } from "./TaskGenerationPrompts";

/** Build a registry holding every built-in prompt at its current version. */
export function createDefaultPromptRegistry(): PromptRegistry {
  const registry = new PromptRegistry();
  registerPRDPrompts(registry);
  registerTaskPrompts(registry);
  registerFeaturePrompts(registry);
  registerContextPrompts(registry);
  registerConfidencePrompts(registry);
  registerIssuePrompts(registry);
  registerSprintPrompts(registry);
  registerRoadmapPrompts(registry);
  return registry;
}

/** Shared registry the AI services render their prompts from. */
export const defaultPromptRegistry = createDefaultPromptRegistry();

export type { PromptVariables, PromptVersion } from "./PromptRegistry";
export { PromptNotFoundError, PromptRegistry, PromptVariableError } from "./PromptRegistry";
