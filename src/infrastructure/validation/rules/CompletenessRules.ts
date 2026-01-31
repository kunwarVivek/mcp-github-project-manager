import { ValidationRule } from '../ValidationRuleEngine';
import { PRDDocument } from '../../../domain/ai-types';

/**
 * Built-in completeness validation rules
 */
export const COMPLETENESS_RULES: ValidationRule[] = [
  {
    id: 'BR-001',
    name: 'Overview Required',
    description: 'PRD must have an overview of at least 100 characters',
    layer: 'builtin',
    severity: 'critical',
    category: 'completeness',
    enabled: true,
    check: (prd: PRDDocument) => {
      const hasOverview = !!(prd.overview && prd.overview.length >= 100);
      return {
        passed: hasOverview,
        message: hasOverview
          ? 'PRD has adequate overview'
          : `PRD overview is ${prd.overview?.length || 0} characters (minimum 100)`,
        location: 'overview',
        suggestedFix: 'Expand the overview with project goals, context, and value proposition'
      };
    },
    autoFix: undefined // Can't auto-fix - needs human input
  },

  {
    id: 'BR-002',
    name: 'Objectives Defined',
    description: 'PRD must have at least 2 clear objectives',
    layer: 'builtin',
    severity: 'critical',
    category: 'completeness',
    enabled: true,
    check: (prd: PRDDocument) => {
      const objectiveCount = prd.objectives?.length || 0;
      const hasEnough = objectiveCount >= 2;
      return {
        passed: hasEnough,
        message: hasEnough
          ? `PRD has ${objectiveCount} objectives`
          : `PRD has only ${objectiveCount} objectives (minimum 2)`,
        location: 'objectives',
        suggestedFix: 'Add clear, measurable objectives for the project'
      };
    }
  },

  {
    id: 'BR-003',
    name: 'Features Listed',
    description: 'PRD must have at least 1 feature requirement',
    layer: 'builtin',
    severity: 'critical',
    category: 'completeness',
    enabled: true,
    check: (prd: PRDDocument) => {
      const featureCount = prd.features?.length || 0;
      const hasFeatures = featureCount >= 1;
      return {
        passed: hasFeatures,
        message: hasFeatures
          ? `PRD has ${featureCount} features`
          : 'PRD has no features defined',
        location: 'features',
        suggestedFix: 'Add at least one feature with clear acceptance criteria'
      };
    }
  },

  {
    id: 'BR-004',
    name: 'Success Metrics Defined',
    description: 'PRD should have measurable success metrics',
    layer: 'builtin',
    severity: 'major',
    category: 'completeness',
    enabled: true,
    check: (prd: PRDDocument) => {
      const metricsCount = prd.successMetrics?.length || 0;
      const hasMetrics = metricsCount >= 1;
      return {
        passed: hasMetrics,
        message: hasMetrics
          ? `PRD has ${metricsCount} success metrics`
          : 'PRD has no success metrics',
        location: 'successMetrics',
        suggestedFix: 'Add measurable success criteria (e.g., "95% uptime", "< 2s response time")'
      };
    }
  },

  {
    id: 'BR-005',
    name: 'Target Users Identified',
    description: 'PRD should identify target user personas',
    layer: 'builtin',
    severity: 'major',
    category: 'completeness',
    enabled: true,
    check: (prd: PRDDocument) => {
      const userCount = prd.targetUsers?.length || 0;
      const hasUsers = userCount >= 1;
      return {
        passed: hasUsers,
        message: hasUsers
          ? `PRD identifies ${userCount} user persona(s)`
          : 'PRD has no target users defined',
        location: 'targetUsers',
        suggestedFix: 'Add user personas with goals, pain points, and technical level'
      };
    }
  },

  {
    id: 'BR-006',
    name: 'Timeline Specified',
    description: 'PRD should include a timeline or schedule',
    layer: 'builtin',
    severity: 'minor',
    category: 'completeness',
    enabled: true,
    check: (prd: PRDDocument) => {
      const hasTimeline = !!(prd.timeline && prd.timeline.length > 10);
      return {
        passed: hasTimeline,
        message: hasTimeline
          ? 'PRD has timeline specified'
          : 'PRD has no timeline or schedule',
        location: 'timeline',
        suggestedFix: 'Add project timeline with key milestones'
      };
    }
  },

  {
    id: 'BR-007',
    name: 'Scope Boundaries Defined',
    description: 'PRD should clearly define what is in and out of scope',
    layer: 'builtin',
    severity: 'major',
    category: 'completeness',
    enabled: true,
    check: (prd: PRDDocument) => {
      const hasInScope = !!(prd.scope?.inScope && prd.scope.inScope.length > 0);
      const hasOutOfScope = !!(prd.scope?.outOfScope && prd.scope.outOfScope.length > 0);
      const passed = hasInScope && hasOutOfScope;
      return {
        passed,
        message: passed
          ? 'PRD has clear scope boundaries'
          : `PRD scope incomplete: ${!hasInScope ? 'missing in-scope items' : ''} ${!hasOutOfScope ? 'missing out-of-scope items' : ''}`,
        location: 'scope',
        suggestedFix: 'Define both in-scope and out-of-scope items explicitly'
      };
    }
  },

  {
    id: 'BR-008',
    name: 'Technical Requirements Present',
    description: 'PRD should include technical requirements',
    layer: 'builtin',
    severity: 'minor',
    category: 'completeness',
    enabled: true,
    check: (prd: PRDDocument) => {
      const techReqCount = prd.technicalRequirements?.length || 0;
      const hasTechReqs = techReqCount >= 1;
      return {
        passed: hasTechReqs,
        message: hasTechReqs
          ? `PRD has ${techReqCount} technical requirements`
          : 'PRD has no technical requirements',
        location: 'technicalRequirements',
        suggestedFix: 'Add technical requirements for performance, security, scalability'
      };
    }
  }
];
