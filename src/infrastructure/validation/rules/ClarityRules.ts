import { ValidationRule } from '../ValidationRuleEngine';
import { PRDDocument, FeatureRequirement } from '../../../domain/ai-types';

/**
 * Built-in clarity validation rules
 */
export const CLARITY_RULES: ValidationRule[] = [
  {
    id: 'CL-001',
    name: 'Feature Descriptions Clear',
    description: 'Each feature should have a description of at least 50 characters',
    layer: 'builtin',
    severity: 'major',
    category: 'clarity',
    enabled: true,
    check: (prd: PRDDocument) => {
      const features = prd.features || [];
      const shortFeatures = features.filter(f => !f.description || f.description.length < 50);

      if (shortFeatures.length === 0) {
        return {
          passed: true,
          message: 'All feature descriptions are adequate'
        };
      }

      return {
        passed: false,
        message: `${shortFeatures.length} feature(s) have descriptions under 50 characters`,
        location: 'features',
        suggestedFix: `Expand descriptions for: ${shortFeatures.map(f => f.title).join(', ')}`,
        affectedSection: 'features'
      };
    }
  },

  {
    id: 'CL-002',
    name: 'Acceptance Criteria Present',
    description: 'Features should have acceptance criteria',
    layer: 'builtin',
    severity: 'major',
    category: 'clarity',
    enabled: true,
    check: (prd: PRDDocument) => {
      const features = prd.features || [];
      const missingCriteria = features.filter(
        f => !f.acceptanceCriteria || f.acceptanceCriteria.length === 0
      );

      if (missingCriteria.length === 0) {
        return {
          passed: true,
          message: 'All features have acceptance criteria'
        };
      }

      return {
        passed: false,
        message: `${missingCriteria.length} feature(s) missing acceptance criteria`,
        location: 'features',
        suggestedFix: `Add acceptance criteria for: ${missingCriteria.map(f => f.title).join(', ')}`,
        affectedSection: 'features'
      };
    }
  },

  {
    id: 'CL-003',
    name: 'No Vague Language in Objectives',
    description: 'Objectives should not use vague words like "improve", "enhance" without metrics',
    layer: 'builtin',
    severity: 'minor',
    category: 'clarity',
    enabled: true,
    check: (prd: PRDDocument) => {
      const vagueWords = ['improve', 'enhance', 'better', 'good', 'fast', 'easy', 'nice'];
      const objectives = prd.objectives || [];

      const vagueObjectives = objectives.filter(obj => {
        const lower = obj.toLowerCase();
        // Check if vague word exists without an accompanying metric
        const hasVague = vagueWords.some(w => lower.includes(w));
        const hasMetric = /\d+%|\d+x|by \d+|to \d+|under \d+|over \d+/.test(obj);
        return hasVague && !hasMetric;
      });

      if (vagueObjectives.length === 0) {
        return {
          passed: true,
          message: 'Objectives are specific and measurable'
        };
      }

      return {
        passed: false,
        message: `${vagueObjectives.length} objective(s) use vague language without metrics`,
        location: 'objectives',
        suggestedFix: 'Add specific metrics (e.g., "improve performance by 50%")',
        affectedSection: 'objectives'
      };
    }
  },

  {
    id: 'CL-004',
    name: 'User Stories Present',
    description: 'Features should have user stories describing use cases',
    layer: 'builtin',
    severity: 'minor',
    category: 'clarity',
    enabled: true,
    check: (prd: PRDDocument) => {
      const features = prd.features || [];
      const missingStories = features.filter(
        f => !f.userStories || f.userStories.length === 0
      );

      if (missingStories.length === 0) {
        return {
          passed: true,
          message: 'All features have user stories'
        };
      }

      return {
        passed: false,
        message: `${missingStories.length} feature(s) missing user stories`,
        location: 'features',
        suggestedFix: `Add "As a [user], I want to [action] so that [benefit]" stories`,
        affectedSection: 'features'
      };
    }
  },

  {
    id: 'CL-005',
    name: 'Persona Goals Defined',
    description: 'User personas should have defined goals',
    layer: 'builtin',
    severity: 'minor',
    category: 'clarity',
    enabled: true,
    check: (prd: PRDDocument) => {
      const users = prd.targetUsers || [];
      const missingGoals = users.filter(u => !u.goals || u.goals.length === 0);

      if (missingGoals.length === 0) {
        return {
          passed: true,
          message: 'All user personas have defined goals'
        };
      }

      return {
        passed: false,
        message: `${missingGoals.length} persona(s) missing goals`,
        location: 'targetUsers',
        suggestedFix: `Add goals for: ${missingGoals.map(u => u.name).join(', ')}`,
        affectedSection: 'targetUsers'
      };
    }
  }
];
