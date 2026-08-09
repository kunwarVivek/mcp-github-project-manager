/**
 * Full Pipeline E2E: Prompt → PRD → Tasks → Issues → PM Assignment → Delivery
 *
 * Exercises the COMPLETE pipeline against the real GitHub API
 * with a real (cheap) AI model. Proves every stage is connected:
 *
 *   1. Create project + setup agent fields
 *   2. Generate PRD from project idea (AI)
 *   3. Parse PRD into tasks with dependencies (AI)
 *   4. Materialize tasks as GitHub issues (milestones + sprints + issues)
 *   5. Register engineer, reviewer, PM agents
 *   6. PM assigns specific task to engineer (assign_task)
 *   7. Engineer heartbeats + submits work product (submit_work_product)
 *   8. Submit for review + reviewer approves (submit_for_review, approve_task)
 *   9. PM verifies swarm status (get_swarm_status)
 *  10. Pipeline summary assertions
 *
 * Requirements:
 *   - GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO (test repo)
 *   - E2E_REAL_API=true
 *   - At least one AI API key (ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY)
 *   - AI_MAIN_MODEL override recommended (e.g., gpt-4o-mini, gemini-2.0-flash)
 *
 * Run:
 *   npm run test:pipeline
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
  let materializedResult: any = {};
  let engineerAgentId = '';
  let reviewerAgentId = '';
  let pmAgentId = '';
  let assignedIssueNumber = 0;
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
    materializedResult = result;
  }, 120000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 5: Register all agents (engineer, reviewer, PM)
  // ═══════════════════════════════════════════════════════════════════════════

  it('Stage 5: Register engineer, reviewer, and PM agents', async () => {
    if (!utils || materializedIssues.length === 0) return;

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

    const reviewer = await utils.callTool('agent_work', {
      action: 'register',
      name: `reviewer-${runId}`,
      role: 'reviewer',
      runtime: 'claude-code',
      capabilities: ['code-review'],
    });
    expect(reviewer.id).toBeDefined();
    reviewerAgentId = reviewer.id;
    agentIds.push(reviewer.id);

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
  }, 30000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 6: PM assigns a specific task to engineer (not self-service checkout)
  // ═══════════════════════════════════════════════════════════════════════════

  it('Stage 6: PM assigns a specific task to engineer via assign_task', async () => {
    if (!utils || !engineerAgentId || !pmAgentId || materializedIssues.length === 0) return;

    assignedIssueNumber = materializedIssues[0].number;

    const assignment = await utils.callTool('agent_manage', {
      action: 'assign_task',
      agentId: engineerAgentId,
      projectId,
      issueNumber: assignedIssueNumber,
    });

    expect(assignment.success).toBe(true);
    expect(assignment.issueNumber).toBe(assignedIssueNumber);
  }, 30000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 7: Engineer works — heartbeat + submit work product
  // ═══════════════════════════════════════════════════════════════════════════

  it('Stage 7: Engineer heartbeats and submits work product', async () => {
    if (!utils || !engineerAgentId || !assignedIssueNumber) return;

    // Heartbeat
    const heartbeat = await utils.callTool('agent_work', {
      action: 'heartbeat',
      agentId: engineerAgentId,
      status: 'working',
      progress: 80,
      progressSummary: 'Implementation complete, writing tests',
    });
    expect(heartbeat.success).toBe(true);

    // Submit work product
    const wp = await utils.callTool('agent_manage', {
      action: 'submit_work_product',
      agentId: engineerAgentId,
      taskId: String(assignedIssueNumber),
      issueNumber: assignedIssueNumber,
      branch: `eng-${runId}/task`,
      filesChanged: ['src/todo.ts', 'src/todo.test.ts'],
      testsPassed: 5,
      testsFailed: 0,
      testsTotal: 5,
      summary: 'Implemented task with full test coverage',
    });
    expect(wp.id).toBeDefined();
  }, 30000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 8: Submit for review and approve
  // ═══════════════════════════════════════════════════════════════════════════

  it('Stage 8: Submit for review and reviewer approves', async () => {
    if (!utils || !engineerAgentId || !reviewerAgentId || !assignedIssueNumber) return;

    const submitted = await utils.callTool('agent_work', {
      action: 'submit_for_review',
      agentId: engineerAgentId,
      taskId: String(assignedIssueNumber),
      summary: 'Ready for review — all tests passing',
    });
    expect(submitted.success).toBe(true);

    const approved = await utils.callTool('agent_work', {
      action: 'approve_task',
      reviewerId: reviewerAgentId,
      taskId: String(assignedIssueNumber),
      summary: 'LGTM — clean implementation',
    });
    expect(approved.success).toBe(true);
  }, 30000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 9: PM verifies swarm status
  // ═══════════════════════════════════════════════════════════════════════════

  it('Stage 9: PM checks swarm status after delivery', async () => {
    if (!utils || !pmAgentId) return;

    const status = await utils.callTool('agent_manage', {
      action: 'get_swarm_status',
    });

    expect(status.totalAgents).toBeGreaterThanOrEqual(3);
    expect(status.agents).toBeDefined();
    expect(Array.isArray(status.agents)).toBe(true);

    // Find our engineer in the swarm
    const engineer = status.agents.find((a: any) => a.id === engineerAgentId);
    expect(engineer).toBeDefined();
  }, 30000);

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 10: Pipeline summary
  // ═══════════════════════════════════════════════════════════════════════════

  it('Stage 10: Verify complete pipeline executed', async () => {
    if (!utils) return;

    const summary = {
      projectId,
      prdGenerated: prdContent.length > 100,
      tasksGenerated: tasks.length,
      issuesMaterialized: materializedIssues.length,
      milestonesCreated: materializedResult.milestones?.length || 0,
      sprintsCreated: materializedResult.sprints?.length || 0,
      pmAssignedTask: assignedIssueNumber > 0,
      engineerRegistered: !!engineerAgentId,
      reviewerRegistered: !!reviewerAgentId,
      pmRegistered: !!pmAgentId,
    };

    process.stderr.write(`\n📊 Pipeline Summary: ${JSON.stringify(summary, null, 2)}\n`);

    expect(summary.prdGenerated).toBe(true);
    expect(summary.tasksGenerated).toBeGreaterThan(0);
    expect(summary.issuesMaterialized).toBeGreaterThan(0);
    expect(summary.milestonesCreated).toBeGreaterThan(0);
    expect(summary.sprintsCreated).toBeGreaterThan(0);
    expect(summary.pmAssignedTask).toBe(true);
    expect(summary.engineerRegistered).toBe(true);
    expect(summary.reviewerRegistered).toBe(true);
    expect(summary.pmRegistered).toBe(true);
  });
});
