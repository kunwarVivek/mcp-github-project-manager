// Barrel re-export — preserves backward compatibility for all schema consumers
export * from './schemas/core-tool-schemas';
export * from './schemas/issue-tool-schemas';
export * from './schemas/pr-tool-schemas';
export * from './schemas/sprint-milestone-tool-schemas';
export * from './schemas/automation-iteration-tool-schemas';
export * from './schemas/event-tool-schemas';
export * from './schemas/ai-automation-tool-schemas';

// Re-exports from standalone tool modules
export { addFeatureTool, executeAddFeature } from './ai-tasks/AddFeatureTool';
export { generatePRDTool, executeGeneratePRD } from './ai-tasks/GeneratePRDTool';
export { parsePRDTool, executeParsePRD } from './ai-tasks/ParsePRDTool';
export { getNextTaskTool, executeGetNextTask } from './ai-tasks/GetNextTaskTool';
export { analyzeTaskComplexityTool, executeAnalyzeTaskComplexity } from './ai-tasks/AnalyzeTaskComplexityTool';
export { expandTaskTool, executeExpandTask } from './ai-tasks/ExpandTaskTool';
export { enhancePRDTool, executeEnhancePRD } from './ai-tasks/EnhancePRDTool';
export { createTraceabilityMatrixTool, executeCreateTraceabilityMatrix } from './ai-tasks/CreateTraceabilityMatrixTool';
export { createStatusUpdateTool, executeCreateStatusUpdate, listStatusUpdatesTool, executeListStatusUpdates, getStatusUpdateTool, executeGetStatusUpdate } from './status-update-tools';
export { addSubIssueTool, listSubIssuesTool, getParentIssueTool, reprioritizeSubIssueTool, removeSubIssueTool, executeAddSubIssue, executeListSubIssues, executeGetParentIssue, executeReprioritizeSubIssue, executeRemoveSubIssue } from './sub-issue-tools';
export { markProjectAsTemplateTool, unmarkProjectAsTemplateTool, copyProjectFromTemplateTool, listOrganizationTemplatesTool, executeMarkProjectAsTemplate, executeUnmarkProjectAsTemplate, executeCopyProjectFromTemplate, executeListOrganizationTemplates } from './project-template-tools';
export { linkProjectToRepositoryTool, unlinkProjectFromRepositoryTool, linkProjectToTeamTool, unlinkProjectFromTeamTool, listLinkedRepositoriesTool, listLinkedTeamsTool, executeLinkProjectToRepository, executeUnlinkProjectFromRepository, executeLinkProjectToTeam, executeUnlinkProjectFromTeam, executeListLinkedRepositories, executeListLinkedTeams } from './project-linking-tools';
export { closeProjectTool, reopenProjectTool, convertDraftIssueTool, executeCloseProject, executeReopenProject, executeConvertDraftIssue } from './project-lifecycle-tools';
export { updateItemPositionTool, searchIssuesAdvancedTool, filterProjectItemsTool, executeUpdateItemPosition, executeSearchIssuesAdvanced, executeFilterProjectItems } from './project-advanced-tools';

export * from './agent-orchestration-tools';