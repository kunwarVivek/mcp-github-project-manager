import { vi } from 'vitest';
import { DomainEventBus } from '../../../../domain/events/DomainEventBus';
import {
  IssueCreatedEvent,
} from '../../../../domain/events/DomainEvent';

describe('DomainEventBus', () => {
  let eventBus: DomainEventBus;

  beforeEach(() => {
    // Create a fresh instance for each test
    DomainEventBus.resetInstance();
    eventBus = DomainEventBus.getInstance();
  });

  afterEach(() => {
    eventBus.clearHistory();
    eventBus.unsubscribeAll();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const instance1 = DomainEventBus.getInstance();
      const instance2 = DomainEventBus.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('subscriptions', () => {
    it('should subscribe to events by name', () => {
      const handler = vi.fn();
      eventBus.subscribeByName('IssueCreated', handler);

      expect(eventBus.getSubscriptionCount('IssueCreated')).toBe(1);
    });

    it('should return unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribeByName('IssueCreated', handler);

      expect(eventBus.getSubscriptionCount('IssueCreated')).toBe(1);

      unsubscribe();

      expect(eventBus.getSubscriptionCount('IssueCreated')).toBe(0);
    });

    it('should subscribe to all events', () => {
      const handler = vi.fn();
      eventBus.subscribeToAll(handler);

      expect(eventBus.getSubscriptionCount('*')).toBe(1);
    });

    it('should unsubscribe all from a specific type', () => {
      eventBus.subscribeByName('IssueCreated', vi.fn());
      eventBus.subscribeByName('IssueCreated', vi.fn());

      expect(eventBus.getSubscriptionCount('IssueCreated')).toBe(2);

      eventBus.unsubscribeAll('IssueCreated');

      expect(eventBus.getSubscriptionCount('IssueCreated')).toBe(0);
    });

    it('should unsubscribe all from all types', () => {
      eventBus.subscribeByName('IssueCreated', vi.fn());
      eventBus.subscribeByName('SprintCreated', vi.fn());

      expect(eventBus.hasSubscriptions()).toBe(true);

      eventBus.unsubscribeAll();

      expect(eventBus.hasSubscriptions()).toBe(false);
    });
  });

  describe('publishing', () => {
    it('should publish events to subscribers', () => {
      const handler = vi.fn();
      eventBus.subscribeByName('IssueCreated', handler);

      const event = IssueCreatedEvent.create({
        issueId: 'issue-1',
        title: 'Test Issue',
        description: 'Description',
      });

      eventBus.publish(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should publish to wildcard subscribers', () => {
      const handler = vi.fn();
      eventBus.subscribeToAll(handler);

      const event = IssueCreatedEvent.create({
        issueId: 'issue-1',
        title: 'Test Issue',
        description: 'Description',
      });

      eventBus.publish(event);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should not publish to other event types', () => {
      const handler = vi.fn();
      eventBus.subscribeByName('SprintCreated', handler);

      const event = IssueCreatedEvent.create({
        issueId: 'issue-1',
        title: 'Test Issue',
        description: 'Description',
      });

      eventBus.publish(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should execute handlers in priority order', () => {
      const callOrder: number[] = [];

      eventBus.subscribeByName('IssueCreated', () => callOrder.push(2), { priority: 2 });
      eventBus.subscribeByName('IssueCreated', () => callOrder.push(1), { priority: 1 });
      eventBus.subscribeByName('IssueCreated', () => callOrder.push(3), { priority: 3 });

      const event = IssueCreatedEvent.create({
        issueId: 'issue-1',
        title: 'Test',
        description: 'Test',
      });

      eventBus.publish(event);

      expect(callOrder).toEqual([1, 2, 3]);
    });

    it('should catch errors when catchErrors is true', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

      eventBus.subscribeByName(
        'IssueCreated',
        () => {
          throw new Error('Handler error');
        },
        { catchErrors: true }
      );

      const event = IssueCreatedEvent.create({
        issueId: 'issue-1',
        title: 'Test',
        description: 'Test',
      });

      // Should not throw
      expect(() => eventBus.publish(event)).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('async publishing', () => {
    it('should await async handlers', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      eventBus.subscribeByNameAsync('IssueCreated', handler);

      const event = IssueCreatedEvent.create({
        issueId: 'issue-1',
        title: 'Test',
        description: 'Test',
      });

      await eventBus.publishAsync(event);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should catch errors in async handlers when catchErrors is true', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

      eventBus.subscribeByNameAsync(
        'IssueCreated',
        async () => {
          throw new Error('Async error');
        },
        { catchErrors: true }
      );

      const event = IssueCreatedEvent.create({
        issueId: 'issue-1',
        title: 'Test',
        description: 'Test',
      });

      // Should not throw when catchErrors is true
      await expect(eventBus.publishAsync(event)).resolves.not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('history', () => {
    it('should record events in history', () => {
      const event = IssueCreatedEvent.create({
        issueId: 'issue-1',
        title: 'Test',
        description: 'Test',
      });

      eventBus.publish(event);

      const history = eventBus.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toBe(event);
    });

    it('should limit history', () => {
      // Publish 5 events
      for (let i = 0; i < 5; i++) {
        eventBus.publish(
          IssueCreatedEvent.create({
            issueId: `issue-${i}`,
            title: `Test ${i}`,
            description: 'Test',
          })
        );
      }

      const history = eventBus.getHistory(3);
      expect(history).toHaveLength(3);
    });

    it('should filter history by aggregate ID', () => {
      eventBus.publish(
        IssueCreatedEvent.create({
          issueId: 'issue-1',
          title: 'Test 1',
          description: 'Test',
        })
      );
      eventBus.publish(
        IssueCreatedEvent.create({
          issueId: 'issue-2',
          title: 'Test 2',
          description: 'Test',
        })
      );
      eventBus.publish(
        IssueCreatedEvent.create({
          issueId: 'issue-1',
          title: 'Test 3',
          description: 'Test',
        })
      );

      const history = eventBus.getHistoryForAggregate('issue-1');
      expect(history).toHaveLength(2);
    });

    it('should clear history', () => {
      eventBus.publish(
        IssueCreatedEvent.create({
          issueId: 'issue-1',
          title: 'Test',
          description: 'Test',
        })
      );

      expect(eventBus.getHistory()).toHaveLength(1);

      eventBus.clearHistory();

      expect(eventBus.getHistory()).toHaveLength(0);
    });

    it('should allow disabling history', () => {
      eventBus.setHistoryEnabled(false);

      eventBus.publish(
        IssueCreatedEvent.create({
          issueId: 'issue-1',
          title: 'Test',
          description: 'Test',
        })
      );

      expect(eventBus.getHistory()).toHaveLength(0);
    });
  });
});
