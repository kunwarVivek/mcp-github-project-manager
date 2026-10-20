// Barrel re-export — preserves backward compatibility for all schema consumers

export * from "./agent-orchestration-tools";
// Re-exports from standalone tool modules
export { addFeatureTool, executeAddFeature } from "./ai-tasks/AddFeatureTool";
export {
  analyzeTaskComplexityTool,
  executeAnalyzeTaskComplexity,
} from "./ai-tasks/AnalyzeTaskComplexityTool";
export {
  createTraceabilityMatrixTool,
  executeCreateTraceabilityMatrix,
} from "./ai-tasks/CreateTraceabilityMatrixTool";
export { enhancePRDTool, executeEnhancePRD } from "./ai-tasks/EnhancePRDTool";
export { executeExpandTask, expandTaskTool } from "./ai-tasks/ExpandTaskTool";
export { executeGeneratePRD, generatePRDTool } from "./ai-tasks/GeneratePRDTool";
export { executeGetNextTask, getNextTaskTool } from "./ai-tasks/GetNextTaskTool";
export { executeParsePRD, parsePRDTool } from "./ai-tasks/ParsePRDTool";
// Compound tool schemas (16 aggregated tools for MCP exposure)
export * from "./compound/compound-schemas";
export {
  executeFilterProjectItems,
  executeSearchIssuesAdvanced,
  executeUpdateItemPosition,
  filterProjectItemsTool,
  searchIssuesAdvancedTool,
  updateItemPositionTool,
} from "./project-advanced-tools";
export {
  closeProjectTool,
  convertDraftIssueTool,
  executeCloseProject,
  executeConvertDraftIssue,
  executeReopenProject,
  reopenProjectTool,
} from "./project-lifecycle-tools";
export {
  executeLinkProjectToRepository,
  executeLinkProjectToTeam,
  executeListLinkedRepositories,
  executeListLinkedTeams,
  executeUnlinkProjectFromRepository,
  executeUnlinkProjectFromTeam,
  linkProjectToRepositoryTool,
  linkProjectToTeamTool,
  listLinkedRepositoriesTool,
  listLinkedTeamsTool,
  unlinkProjectFromRepositoryTool,
  unlinkProjectFromTeamTool,
} from "./project-linking-tools";
export {
  copyProjectFromTemplateTool,
  executeCopyProjectFromTemplate,
  executeListOrganizationTemplates,
  executeMarkProjectAsTemplate,
  executeUnmarkProjectAsTemplate,
  listOrganizationTemplatesTool,
  markProjectAsTemplateTool,
  unmarkProjectAsTemplateTool,
} from "./project-template-tools";
export * from "./schemas/ai-automation-tool-schemas";
export * from "./schemas/automation-iteration-tool-schemas";
export * from "./schemas/core-tool-schemas";
export * from "./schemas/event-tool-schemas";
export * from "./schemas/issue-tool-schemas";
export * from "./schemas/pr-tool-schemas";
export * from "./schemas/sprint-milestone-tool-schemas";
export {
  createStatusUpdateTool,
  executeCreateStatusUpdate,
  executeGetStatusUpdate,
  executeListStatusUpdates,
  getStatusUpdateTool,
  listStatusUpdatesTool,
} from "./status-update-tools";
export {
  addSubIssueTool,
  executeAddSubIssue,
  executeGetParentIssue,
  executeListSubIssues,
  executeRemoveSubIssue,
  executeReprioritizeSubIssue,
  getParentIssueTool,
  listSubIssuesTool,
  removeSubIssueTool,
  reprioritizeSubIssueTool,
} from "./sub-issue-tools";
