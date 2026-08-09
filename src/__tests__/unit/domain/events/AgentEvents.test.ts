import {
  AgentRegisteredEvent,
  AgentDeregisteredEvent,
  TaskCheckedOutEvent,
  TaskReleasedEvent,
  TaskCompletedEvent,
  TaskSubmittedForReviewEvent,
  TaskApprovedEvent,
  TaskRejectedEvent,
  AgentHeartbeatEvent,
  TaskReclaimedEvent,
} from '../../../../domain/events/AgentEvents';

describe('Agent Domain Events', () => {
  describe('AgentRegisteredEvent', () => {
    it('should create an agent registered event', () => {
      const event = AgentRegisteredEvent.create({
        agentId: 'agent-1',
        agentName: 'CodeReviewer',
        role: 'reviewer',
        runtime: 'claude-code',
        capabilities: ['typescript', 'testing'],
      });

      expect(event.eventType).toBe('AgentRegistered');
      expect(event.aggregateId).toBe('agent-1');
      expect(event.data.agentName).toBe('CodeReviewer');
      expect(event.data.role).toBe('reviewer');
      expect(event.data.capabilities).toEqual(['typescript', 'testing']);
    });

    it('should create with optional fields', () => {
      const event = AgentRegisteredEvent.create({
        agentId: 'agent-2',
        agentName: 'SubAgent',
        role: 'general',
        parentAgentId: 'agent-1',
      });

      expect(event.data.parentAgentId).toBe('agent-1');
    });
  });

  describe('AgentDeregisteredEvent', () => {
    it('should create an agent deregistered event', () => {
      const event = AgentDeregisteredEvent.create({
        agentId: 'agent-1',
        agentName: 'CodeReviewer',
        reason: 'Budget exhausted',
      });

      expect(event.eventType).toBe('AgentDeregistered');
      expect(event.data.reason).toBe('Budget exhausted');
    });
  });

  describe('TaskCheckedOutEvent', () => {
    it('should create a task checked out event', () => {
      const event = TaskCheckedOutEvent.create({
        agentId: 'agent-1',
        issueNumber: 42,
        issueTitle: 'Fix bug',
        strategy: 'highest_priority',
        selectionRationale: 'Highest priority task',
        milestone: 'v1.0',
        labels: ['bug', 'priority:high'],
        branchSuggestion: 'agent/42-fix-bug',
      });

      expect(event.eventType).toBe('TaskCheckedOut');
      expect(event.data.issueNumber).toBe(42);
      expect(event.data.issueTitle).toBe('Fix bug');
      expect(event.data.strategy).toBe('highest_priority');
      expect(event.data.labels).toEqual(['bug', 'priority:high']);
    });
  });

  describe('TaskReleasedEvent', () => {
    it('should create a task released event', () => {
      const event = TaskReleasedEvent.create({
        agentId: 'agent-1',
        issueNumber: 42,
        reason: 'Agent releasing task',
      });

      expect(event.eventType).toBe('TaskReleased');
      expect(event.data.issueNumber).toBe(42);
      expect(event.data.reason).toBe('Agent releasing task');
    });
  });

  describe('TaskCompletedEvent', () => {
    it('should create a task completed event', () => {
      const event = TaskCompletedEvent.create({
        agentId: 'agent-1',
        issueNumber: 42,
        summary: 'Fixed the bug',
        prNumber: 123,
        closeIssue: true,
      });

      expect(event.eventType).toBe('TaskCompleted');
      expect(event.data.summary).toBe('Fixed the bug');
      expect(event.data.prNumber).toBe(123);
      expect(event.data.closeIssue).toBe(true);
    });

    it('should create with default closeIssue', () => {
      const event = TaskCompletedEvent.create({
        agentId: 'agent-1',
        issueNumber: 42,
        summary: 'Fixed',
      });

      expect(event.data.closeIssue).toBe(true);
    });
  });

  describe('TaskSubmittedForReviewEvent', () => {
    it('should create a task submitted for review event', () => {
      const event = TaskSubmittedForReviewEvent.create({
        agentId: 'agent-1',
        issueNumber: 42,
        summary: 'Ready for review',
      });

      expect(event.eventType).toBe('TaskSubmittedForReview');
      expect(event.data.issueNumber).toBe(42);
      expect(event.data.summary).toBe('Ready for review');
    });
  });

  describe('TaskApprovedEvent', () => {
    it('should create a task approved event', () => {
      const event = TaskApprovedEvent.create({
        issueNumber: 42,
        reviewerId: 'reviewer-1',
        summary: 'LGTM',
      });

      expect(event.eventType).toBe('TaskApproved');
      expect(event.data.issueNumber).toBe(42);
      expect(event.data.reviewerId).toBe('reviewer-1');
      expect(event.data.summary).toBe('LGTM');
    });
  });

  describe('TaskRejectedEvent', () => {
    it('should create a task rejected event', () => {
      const event = TaskRejectedEvent.create({
        issueNumber: 42,
        reviewerId: 'reviewer-1',
        feedback: 'Needs more tests',
      });

      expect(event.eventType).toBe('TaskRejected');
      expect(event.data.feedback).toBe('Needs more tests');
    });
  });

  describe('AgentHeartbeatEvent', () => {
    it('should create an agent heartbeat event', () => {
      const event = AgentHeartbeatEvent.create({
        agentId: 'agent-1',
        status: 'working',
        progress: 50,
        progressSummary: 'Halfway done',
        currentBranch: 'agent/42-fix-bug',
      });

      expect(event.eventType).toBe('AgentHeartbeat');
      expect(event.data.status).toBe('working');
      expect(event.data.progress).toBe(50);
      expect(event.data.currentBranch).toBe('agent/42-fix-bug');
    });
  });

  describe('TaskReclaimedEvent', () => {
    it('should create a task reclaimed event', () => {
      const event = TaskReclaimedEvent.create({
        issueNumber: 42,
        previousAgentId: 'agent-1',
        reason: 'No heartbeat for more than 30 min',
      });

      expect(event.eventType).toBe('TaskReclaimed');
      expect(event.data.previousAgentId).toBe('agent-1');
      expect(event.data.reason).toBe('No heartbeat for more than 30 min');
    });

    it('should create with default reason', () => {
      const event = TaskReclaimedEvent.create({
        issueNumber: 42,
        previousAgentId: 'agent-1',
      });

      expect(event.data.reason).toBe('Heartbeat timeout');
    });
  });

  describe('event serialization', () => {
    it('should serialize to plain object', () => {
      const event = TaskCheckedOutEvent.create({
        agentId: 'agent-1',
        issueNumber: 42,
        issueTitle: 'Fix bug',
        branchSuggestion: 'agent/42-fix-bug',
      });

      const data = event.toData();
      expect(data).toEqual({
        eventId: expect.any(String),
        eventType: 'TaskCheckedOut',
        resourceType: 'issue',
        aggregateId: 'agent-1',
        timestamp: expect.any(String),
        causedBy: 'system',
        data: {
          issueNumber: 42,
          issueTitle: 'Fix bug',
          strategy: 'highest_priority',
          selectionRationale: undefined,
          milestone: undefined,
          labels: [],
          branchSuggestion: 'agent/42-fix-bug',
        },
      });
    });
  });
});
