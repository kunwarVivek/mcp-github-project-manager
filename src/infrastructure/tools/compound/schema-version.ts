/**
 * Semver per compound tool's input contract.
 *
 * Bump rules: additive optional fields/enum values => minor; removed or
 * renamed fields, narrowed types, new required fields => major; description-only
 * or cosmetic changes => patch. After bumping, run `npm run schema:snapshot`
 * to refresh src/__tests__/unit/infrastructure/tools/fixtures/compound-schema-snapshot.json.
 */
export const TOOL_SCHEMA_VERSIONS: Record<string, string> = {
  manage_project: "1.0.0",
  manage_issues: "1.0.0",
  manage_prs: "1.0.0",
  manage_milestones: "1.0.0",
  manage_sprints: "1.0.0",
  manage_labels: "1.0.0",
  manage_automation: "1.0.0",
  manage_iterations: "1.0.0",
  manage_events: "1.0.0",
  manage_status_updates: "1.0.0",
  ai_generate: "1.0.0",
  ai_analyze: "1.0.0",
  ai_plan: "1.0.0",
  agent_work: "1.0.0",
  agent_manage: "1.0.0",
  system: "1.0.0",
  discover_tools: "1.0.0",
  manage_branches: "1.0.0",
  manage_releases: "1.0.0",
  manage_workflows: "1.0.0",
  analytics: "1.0.0",
};

export function schemaVersionOf(tool: string): string {
  const version = TOOL_SCHEMA_VERSIONS[tool];
  if (!version) {
    throw new Error(
      `No schema version registered for tool "${tool}". Add it to TOOL_SCHEMA_VERSIONS in schema-version.ts.`
    );
  }
  return version;
}
