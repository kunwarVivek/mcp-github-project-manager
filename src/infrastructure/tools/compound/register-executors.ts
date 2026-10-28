import type { ToolRegistry } from "../ToolRegistry";
import {
  executeAgentManage,
  executeAgentWork,
  executeAiAnalyze,
  executeAiGenerate,
  executeAiPlan,
  executeDiscoverTools,
  executeManageAutomation,
  executeManageBranches,
  executeManageEvents,
  executeManageIssues,
  executeManageIterations,
  executeManageLabels,
  executeManageMilestones,
  executeManageProject,
  executeManagePrs,
  executeManageReleases,
  executeManageSprints,
  executeManageStatusUpdates,
  executeManageWorkflows,
  executeSystem,
} from "./compound-executors";

/**
 * Register the executors of the COMPOUND tools — the only tools an MCP client
 * can call.
 *
 * Why this is a separate module: the invariant "every registered executor is
 * a public tool" is only checkable if the registration is reachable from a
 * test without booting the server. `src/index.ts` starts the server as a side
 * effect of being imported, so the registrations live here instead, and
 * `tool-registration.test.ts` calls this function against a fresh registry.
 *
 * The granular (internal) tools stay registered as DEFINITIONS in the
 * registry: they are the compound layer's implementation contract — the
 * compound executors import the same functions directly. What is deliberately
 * absent is an executor registered under a granular name: `dispatchTool`
 * looks executors up by the name the client called, and the client can only
 * call a compound tool, so such an executor could never run.
 */
export function registerCompoundExecutors(r: ToolRegistry): void {
  r.registerExecutor("manage_project", executeManageProject);
  r.registerExecutor("manage_issues", executeManageIssues);
  r.registerExecutor("manage_prs", executeManagePrs);
  r.registerExecutor("manage_milestones", executeManageMilestones);
  r.registerExecutor("manage_sprints", executeManageSprints);
  r.registerExecutor("manage_labels", executeManageLabels);
  r.registerExecutor("manage_automation", executeManageAutomation);
  r.registerExecutor("manage_iterations", executeManageIterations);
  r.registerExecutor("manage_events", executeManageEvents);
  r.registerExecutor("manage_status_updates", executeManageStatusUpdates);
  r.registerExecutor("ai_generate", executeAiGenerate);
  r.registerExecutor("ai_analyze", executeAiAnalyze);
  r.registerExecutor("ai_plan", executeAiPlan);
  r.registerExecutor("agent_work", executeAgentWork);
  r.registerExecutor("agent_manage", executeAgentManage);
  r.registerExecutor("system", executeSystem);
  r.registerExecutor("discover_tools", executeDiscoverTools);
  r.registerExecutor("manage_branches", executeManageBranches);
  r.registerExecutor("manage_releases", executeManageReleases);
  r.registerExecutor("manage_workflows", executeManageWorkflows);
}
