/**
 * Public tools whose actions spend server-side AI tokens. Single source for
 * the budget gate (ToolDispatcher) and AI-degradation reporting
 * (compound executors).
 */
export const AI_SPENDING_TOOL_NAMES = ["ai_generate", "ai_analyze", "ai_plan"] as const;

const AI_SPENDING_TOOL_SET: ReadonlySet<string> = new Set(AI_SPENDING_TOOL_NAMES);

export function isAiSpendingTool(toolName: string): boolean {
  return AI_SPENDING_TOOL_SET.has(toolName);
}
