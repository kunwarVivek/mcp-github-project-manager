import {
  parseResourceStatus,
  toStatusString,
  isActiveStatus,
  isClosedStatus,
  filterByStatus,
  registerStatusMapping,
  getRegisteredStatusMappings,
} from '../../../../domain/utils/StatusParser';
import { ResourceStatus } from '../../../../domain/resource-types';

describe('StatusParser', () => {
  describe('parseResourceStatus', () => {
    describe('issue resource type (default)', () => {
      it('should parse "open" to ACTIVE', () => {
        expect(parseResourceStatus('open')).toBe(ResourceStatus.ACTIVE);
      });

      it('should parse "closed" to CLOSED', () => {
        expect(parseResourceStatus('closed')).toBe(ResourceStatus.CLOSED);
      });

      it('should parse "OPEN" (case-insensitive) to ACTIVE', () => {
        expect(parseResourceStatus('OPEN')).toBe(ResourceStatus.ACTIVE);
      });

      it('should parse "CLOSED" (case-insensitive) to CLOSED', () => {
        expect(parseResourceStatus('CLOSED')).toBe(ResourceStatus.CLOSED);
      });

      it('should throw for unknown status', () => {
        expect(() => parseResourceStatus('unknown')).toThrow("Unknown status 'unknown'");
      });
    });

    describe('project resource type', () => {
      it('should parse "active" to ACTIVE', () => {
        expect(parseResourceStatus('active', 'project')).toBe(ResourceStatus.ACTIVE);
      });

      it('should parse "closed" to CLOSED', () => {
        expect(parseResourceStatus('closed', 'project')).toBe(ResourceStatus.CLOSED);
      });

      it('should parse "ACTIVE" (case-insensitive) to ACTIVE', () => {
        expect(parseResourceStatus('ACTIVE', 'project')).toBe(ResourceStatus.ACTIVE);
      });
    });

    describe('milestone resource type', () => {
      it('should parse "open" to ACTIVE', () => {
        expect(parseResourceStatus('open', 'milestone')).toBe(ResourceStatus.ACTIVE);
      });

      it('should parse "closed" to CLOSED', () => {
        expect(parseResourceStatus('closed', 'milestone')).toBe(ResourceStatus.CLOSED);
      });
    });

    describe('sprint resource type', () => {
      it('should parse "planned" to PLANNED', () => {
        expect(parseResourceStatus('planned', 'sprint')).toBe(ResourceStatus.PLANNED);
      });

      it('should parse "active" to ACTIVE', () => {
        expect(parseResourceStatus('active', 'sprint')).toBe(ResourceStatus.ACTIVE);
      });

      it('should parse "completed" to CLOSED (completed maps to closed)', () => {
        expect(parseResourceStatus('completed', 'sprint')).toBe(ResourceStatus.CLOSED);
      });
    });

    describe('githubIssue resource type', () => {
      it('should parse "OPEN" to ACTIVE', () => {
        expect(parseResourceStatus('OPEN', 'githubIssue')).toBe(ResourceStatus.ACTIVE);
      });

      it('should parse "CLOSED" to CLOSED', () => {
        expect(parseResourceStatus('CLOSED', 'githubIssue')).toBe(ResourceStatus.CLOSED);
      });
    });

    describe('githubMilestone resource type', () => {
      it('should parse "open" to ACTIVE', () => {
        expect(parseResourceStatus('open', 'githubMilestone')).toBe(ResourceStatus.ACTIVE);
      });

      it('should parse "closed" to CLOSED', () => {
        expect(parseResourceStatus('closed', 'githubMilestone')).toBe(ResourceStatus.CLOSED);
      });
    });

    describe('unknown resource type (fallback to issue)', () => {
      it('should parse using issue mapping for unknown type', () => {
        expect(parseResourceStatus('open', 'unknown')).toBe(ResourceStatus.ACTIVE);
        expect(parseResourceStatus('closed', 'unknown')).toBe(ResourceStatus.CLOSED);
      });
    });
  });

  describe('toStatusString', () => {
    describe('issue resource type (default)', () => {
      it('should convert ACTIVE to "open"', () => {
        expect(toStatusString(ResourceStatus.ACTIVE)).toBe('open');
      });

      it('should convert CLOSED to "closed"', () => {
        expect(toStatusString(ResourceStatus.CLOSED)).toBe('closed');
      });

      it('should convert COMPLETED to "closed"', () => {
        expect(toStatusString(ResourceStatus.COMPLETED)).toBe('closed');
      });

      it('should convert IN_PROGRESS to "open"', () => {
        expect(toStatusString(ResourceStatus.IN_PROGRESS)).toBe('open');
      });

      it('should convert DELETED to "closed"', () => {
        expect(toStatusString(ResourceStatus.DELETED)).toBe('closed');
      });

      it('should convert ARCHIVED to "closed"', () => {
        expect(toStatusString(ResourceStatus.ARCHIVED)).toBe('closed');
      });
    });

    describe('project resource type', () => {
      it('should convert ACTIVE to "active"', () => {
        expect(toStatusString(ResourceStatus.ACTIVE, 'project')).toBe('active');
      });

      it('should convert CLOSED to "closed"', () => {
        expect(toStatusString(ResourceStatus.CLOSED, 'project')).toBe('closed');
      });
    });

    describe('sprint resource type', () => {
      it('should convert PLANNED to "planned"', () => {
        expect(toStatusString(ResourceStatus.PLANNED, 'sprint')).toBe('planned');
      });

      it('should convert ACTIVE to "active"', () => {
        expect(toStatusString(ResourceStatus.ACTIVE, 'sprint')).toBe('active');
      });

      it('should convert COMPLETED to "completed"', () => {
        expect(toStatusString(ResourceStatus.COMPLETED, 'sprint')).toBe('completed');
      });

      it('should convert CLOSED to "completed"', () => {
        expect(toStatusString(ResourceStatus.CLOSED, 'sprint')).toBe('completed');
      });
    });

    describe('githubIssue resource type', () => {
      it('should convert ACTIVE to "OPEN"', () => {
        expect(toStatusString(ResourceStatus.ACTIVE, 'githubIssue')).toBe('OPEN');
      });

      it('should convert CLOSED to "CLOSED"', () => {
        expect(toStatusString(ResourceStatus.CLOSED, 'githubIssue')).toBe('CLOSED');
      });
    });

    describe('githubMilestone resource type', () => {
      it('should convert ACTIVE to "open"', () => {
        expect(toStatusString(ResourceStatus.ACTIVE, 'githubMilestone')).toBe('open');
      });

      it('should convert CLOSED to "closed"', () => {
        expect(toStatusString(ResourceStatus.CLOSED, 'githubMilestone')).toBe('closed');
      });
    });
  });

  describe('isActiveStatus', () => {
    it('should return true for "open" issue status', () => {
      expect(isActiveStatus('open')).toBe(true);
    });

    it('should return true for "active" project status', () => {
      expect(isActiveStatus('active', 'project')).toBe(true);
    });

    it('should return false for "closed"', () => {
      expect(isActiveStatus('closed')).toBe(false);
    });

    it('should return true for "OPEN" (case-insensitive)', () => {
      expect(isActiveStatus('OPEN')).toBe(true);
    });
  });

  describe('isClosedStatus', () => {
    it('should return true for "closed"', () => {
      expect(isClosedStatus('closed')).toBe(true);
    });

    it('should return true for "completed" sprint status', () => {
      expect(isClosedStatus('completed', 'sprint')).toBe(true);
    });

    it('should return false for "open"', () => {
      expect(isClosedStatus('open')).toBe(false);
    });

    it('should return true for "CLOSED" (case-insensitive)', () => {
      expect(isClosedStatus('CLOSED')).toBe(true);
    });
  });

  describe('filterByStatus', () => {
    const mockResources = [
      { id: '1', status: ResourceStatus.ACTIVE, name: 'Active 1' },
      { id: '2', status: ResourceStatus.CLOSED, name: 'Closed 1' },
      { id: '3', status: ResourceStatus.ACTIVE, name: 'Active 2' },
      { id: '4', status: ResourceStatus.COMPLETED, name: 'Completed 1' },
    ];

    it('should return all resources when status is "all"', () => {
      expect(filterByStatus(mockResources, 'all')).toHaveLength(4);
    });

    it('should filter by "open" status (ACTIVE)', () => {
      const result = filterByStatus(mockResources, 'open');
      expect(result).toHaveLength(2);
      expect(result.every(r => r.status === ResourceStatus.ACTIVE)).toBe(true);
    });

    it('should filter by "closed" status', () => {
      const result = filterByStatus(mockResources, 'closed');
      expect(result).toHaveLength(1); // Only CLOSED matches
      expect(result.every(r => r.status === ResourceStatus.CLOSED)).toBe(true);
    });

    it('should handle resources with optional status field', () => {
      const resourcesWithOptional = [
        { id: '1', status: ResourceStatus.ACTIVE },
        { id: '2' }, // no status
        { id: '3', status: ResourceStatus.CLOSED },
      ];
      const result = filterByStatus(resourcesWithOptional, 'open');
      expect(result).toHaveLength(1);
    });
  });

  describe('registerStatusMapping', () => {
    it('should allow registering custom status mapping', () => {
      registerStatusMapping('custom', {
        active: 'enabled',
        closed: 'disabled',
      });

      const mappings = getRegisteredStatusMappings();
      expect(mappings.custom).toBeDefined();
      expect(mappings.custom.active).toBe('enabled');
      expect(mappings.custom.closed).toBe('disabled');
    });

    it('should parse using custom mapping', () => {
      registerStatusMapping('custom2', {
        active: 'on',
        closed: 'off',
      });

      expect(parseResourceStatus('on', 'custom2')).toBe(ResourceStatus.ACTIVE);
      expect(parseResourceStatus('off', 'custom2')).toBe(ResourceStatus.CLOSED);
    });
  });

  describe('getRegisteredStatusMappings', () => {
    it('should return a copy of mappings (not the original)', () => {
      const mappings1 = getRegisteredStatusMappings();
      const mappings2 = getRegisteredStatusMappings();
      expect(mappings1).not.toBe(mappings2); // different object references
      expect(mappings1).toEqual(mappings2); // same content
    });

    it('should include default mappings', () => {
      const mappings = getRegisteredStatusMappings();
      expect(mappings.issue).toBeDefined();
      expect(mappings.project).toBeDefined();
      expect(mappings.milestone).toBeDefined();
      expect(mappings.sprint).toBeDefined();
      expect(mappings.githubIssue).toBeDefined();
      expect(mappings.githubMilestone).toBeDefined();
    });
  });

  describe('round-trip consistency', () => {
    it('should maintain consistency between parse and toStatusString for issues', () => {
      const original = 'open';
      const parsed = parseResourceStatus(original, 'issue');
      const converted = toStatusString(parsed, 'issue');
      expect(converted).toBe(original);
    });

    it('should maintain consistency between parse and toStatusString for projects', () => {
      const original = 'active';
      const parsed = parseResourceStatus(original, 'project');
      const converted = toStatusString(parsed, 'project');
      expect(converted).toBe(original);
    });

    it('should maintain consistency between parse and toStatusString for sprints', () => {
      // Note: 'completed' maps to CLOSED, which converts back to 'completed' for sprints
      const testCases = [
        { input: 'planned', expected: 'planned' },
        { input: 'active', expected: 'active' },
        { input: 'completed', expected: 'completed' },
      ];
      testCases.forEach(({ input, expected }) => {
        const parsed = parseResourceStatus(input, 'sprint');
        const converted = toStatusString(parsed, 'sprint');
        expect(converted).toBe(expected);
      });
    });

    it('should maintain consistency for GitHub issue states', () => {
      const original = 'OPEN';
      const parsed = parseResourceStatus(original, 'githubIssue');
      const converted = toStatusString(parsed, 'githubIssue');
      expect(converted).toBe(original);
    });

    it('should maintain consistency for GitHub milestone states', () => {
      const original = 'open';
      const parsed = parseResourceStatus(original, 'githubMilestone');
      const converted = toStatusString(parsed, 'githubMilestone');
      expect(converted).toBe(original);
    });
  });
});
