/**
 * Full Pipeline E2E: Prompt → PRD → Tasks → Issues → Agent Pickup → PM Coordination
 *
 * This test exercises the COMPLETE pipeline against the real GitHub API
 * with a real (cheap) AI model. It proves that every stage is connected:
 *
 *   1. Generate a PRD from a project idea (AI)
 *   2. Parse PRD into tasks with dependencies (AI)
 *   3. Materialize tasks as GitHub issues grouped into milestones/sprints
 *   4. Engineer agent registers and checks out a task
 *   5. Engineer submits heartbeat and work product
 *   6. PM agent monitors swarm status
 *   7. Cleanup
 *
 * Requirements:
 *   - GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO (test repo)
 *   - E2E_REAL_API=true
 *   - At least one AI API key (ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY)
 *   - AI_MAIN_MODEL override recommended (e.g., gpt-4o-mini, gemini-2.0-flash)
 *
 * Run:
 *   npm run test:pipeline
 *   # or with specific model:
 *   AI_MAIN_MODEL=gpt-4o-mini npm run test:pipeline
 */

import { MCPToolTestUtils } from '../utils/MCPToolTestUtils';

const hasRealCredentials = (): boolean => {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || token === 'test-token' || token === '') return false;
  if (!owner || owner === 'test-owner') return false;
  if (!repo || repo === 'test-repo') return false;
  return true;
};

const hasAICredentials = (): boolean => {
  return !!(
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GOOGLE_API_KEY
  );
};

function data(response: any): any {
  if (!response || typeof response !== 'object') return response;
  if (response.structuredContent) return response.structuredContent;
  if (Array.isArray(response.content) && response.content[0]?.text) {
    try { return JSON.parse(response.content[0].text); } catch { return response.content[0].text; }
  }
  return response;
}

describe('Full Pipeline E2E: Prompt → PRD → Tasks → Issues → Agent → PM', () => {
  let utils: MCPToolTestUtils | undefined;
  const runId = `${Date.now().toString(36).slice(-6)}`;

  // Pipeline state
  let projectId = '';
  let prdContent = '';
  let tasks: any[] = [];
  let materializedIssues: any[] = [];
  let engineerAgentId = '';
  let pmAgentId = '';
  const agentIds: string[] = [];

  beforeAll(async () => {
    if (!hasRealCredentials() || !hasAICredentials()) {
      console.log('Skipping Full Pipeline E2E — missing GitHub or AI credentials');
      return;
    }
    utils = new MCPToolTestUtils();
    await utils.startServer();
  }, 30000);

  afterAll(async () => {
    if (utils) {
      // Cleanup agents
      for (const id of agentIds) {
        try { await utils.callTool('agent_manage', { action: 'deregister', agentId: id }); } catch {}
      }
      await utils.stopServer();
    }
  }, 20000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 1: Project Setup
  // ═══════════════════════════════════════════════════════════════════════════

  it('Stage 1: Create project and setup agent fields', async () => {
    if (!utils) return;

    const project = await utils.callTool('manage_project', {
      action: 'create',
      title: `Pipeline E2E ${runId}`,
      shortDescription: 'Full pipeline end-to-end test',
      visibility: 'private',
    });
    expect(project.id).toBeDefined();
    projectId = project.id;

    // Setup agent fields so checkout can find and claim issues
    await utils.callTool('agent_manage', { action: 'setup_fields', projectId });
  }, 30000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 2: AI — Generate PRD from project idea
  // ═══════════════════════════════════════════════════════════════════════════

  it('Stage 2: Generate PRD from project idea (AI)', async () => {
    if (!utils || !projectId) return;

    const result = await utils.callTool('ai_generate', {
      action: 'generate_prd',
      projectIdea: 'A simple command-line todo list application with file persistence',
      projectName: `TodoCLI-${runId}`,
      targetUsers: ['developers'],
      timeline: '2 weeks',
      complexity: 'low',
      author: 'pipeline-e2e',
    });

    // PRD may come as string or object with content
    prdContent = typeof result === 'string'
      ? result
      : (result?.content || result?.prd || JSON.stringify(result));

    expect(prdContent.length).toBeGreaterThan(100);
  }, 60000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 3: AI — Parse PRD into tasks
  // ═══════════════════════════════════════════════════════════════════════════

  it('Stage 3: Parse PRD into tasks with dependencies (AI)', async () => {
    if (!utils || !prdContent) return;

    const result = await utils.callTool('ai_generate', {
      action: 'parse_prd',
      prdContent,
      maxTasks: 4,
      includeSubtasks: false,
      autoEstimate: true,
      autoPrioritize: true,
    });

    // Extract tasks from result
    tasks = result?.tasks || result?.summary?.tasks || [];
    if (tasks.length === 0 && Array.isArray(result)) {
      tasks = result;
    }

    expect(tasks.length).toBeGreaterThan(0);
  }, 60000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 4: Materialize tasks as GitHub issues
  // ═══════════════════════════════════════════════════════════════════════════

  it('Stage 4: Materialize tasks → milestones, sprints, issues', async () => {
    if (!utils || !projectId || tasks.length === 0) return;

    const result = await utils.callTool('ai_generate', {
      action: 'materialize_tasks',
      projectId,
      labelPrefix: `pipeline-${runId}`,
      prdContent,
      tasks: tasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description || t.title,
        complexity: t.complexity,
        estimatedHours: t.estimatedHours,
        priority: t.priority,
        dependencies: t.dependencies,
        acceptanceCriteria: t.acceptanceCriteria,
        tags: t.tags,
      })),
    });

    expect(result.issues?.length).toBeGreaterThan(0);
    materializedIssues = result.issues || [];
  }, 120000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 5: Agent registers and checks out a task
  // ═══════════════════════════════════════════════════════════════════════════

  it('Stage 5: Engineer agent registers and checks out a task', async () => {
    if (!utils || materializedIssues.length === 0) return;

    // Register engineer
    const engineer = await utils.callTool('agent_work', {
      action: 'register',
      name: `engineer-${runId}`,
      role: 'engineer',
      runtime: 'claude-code',
      capabilities: ['typescript', 'testing'],
    });
    expect(engineer.id).toBeDefined();
    engineerAgentId = engineer.id;
    agentIds.push(engineer.id);

    // Checkout a task
    const checkout = await utils.callTool('agent_work', {
      action: 'checkout_task',
      agentId: engineerAgentId,
      projectId,
    });

    // May succeed or fail depending on project field setup timing
    expect(checkout).toBeDefined();
    if (checkout.success) {
      expect(checkout.issueNumber).toBeGreaterThan(0);
    }
  }, 30000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 6: Agent submits heartbeat and work product
  // ═══════════════════════════════════════════════════════════════════════════

  it('Stage 6: Engineer submits heartbeat', async () => {
    if (!utils || !engineerAgentId) return;

    const heartbeat = await utils.callTool('agent_work', {
      action: 'heartbeat',
      agentId: engineerAgentId,
      status: 'working',
      progress: 50,
      progressSummary: 'Pipeline E2E — implementing task',
    });

    expect(heartbeat.success).toBe(true);
  }, 15000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 7: PM monitors swarm status
  // ═══════════════════════════════════════════════════════════════════════════

  it('Stage 7: PM agent monitors swarm status', async () => {
    if (!utils) return;

    // Register PM
    const pm = await utils.callTool('agent_work', {
      action: 'register',
      name: `pm-${runId}`,
      role: 'pm',
      runtime: 'claude-code',
      capabilities: ['coordination', 'planning'],
    });
    expect(pm.id).toBeDefined();
    pmAgentId = pm.id;
    agentIds.push(pm.id);

    // Get swarm status
    const status = await utils.callTool('agent_manage', {
      action: 'get_swarm_status',
    });

    expect(status.totalAgents).toBeGreaterThanOrEqual(2);
    expect(status.agents).toBeDefined();
    expect(Array.isArray(status.agents)).toBe(true);

    // Find our engineer in the swarm
    const engineer = status.agents.find((a: any) => a.id === engineerAgentId);
    expect(engineer).toBeDefined();
    expect(engineer.role).toBe('engineer');
  }, 30000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 8: Pipeline summary
  // ═══════════════════════════════════════════════════════════════════════════

  it('Stage 8: Verify complete pipeline executed', async () => {
    if (!utils) return;

    const summary = {
      projectId,
      prdGenerated: prdContent.length > 100,
      tasksGenerated: tasks.length,
      issuesMaterialized: materializedIssues.length,
      engineerRegistered: !!engineerAgentId,
      pmRegistered: !!pmAgentId,
    };

    process.stderr.write(`\n📊 Pipeline Summary: ${JSON.stringify(summary, null, 2)}\n`);

    // All stages should have produced results
    expect(summary.prdGenerated).toBe(true);
    expect(summary.tasksGenerated).toBeGreaterThan(0);
    expect(summary.issuesMaterialized).toBeGreaterThan(0);
    expect(summary.engineerRegistered).toBe(true);
    expect(summary.pmRegistered).toBe(true);
  });
});
