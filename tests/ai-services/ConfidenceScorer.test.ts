import {
  ConfidenceScorer,
  calculateInputCompleteness,
  getConfidenceTier,
  calculateWeightedScore,
  generateClarifyingQuestions
} from '../../src/services/ai/ConfidenceScorer';
import { DEFAULT_CONFIDENCE_CONFIG } from '../../src/domain/ai-types';

describe('ConfidenceScorer', () => {
  describe('calculateInputCompleteness', () => {
    it('returns 0 for empty input', () => {
      const score = calculateInputCompleteness({});
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('returns higher score for complete input', () => {
      const emptyScore = calculateInputCompleteness({});
      const completeScore = calculateInputCompleteness({
        description: 'A detailed description of over 500 characters. '.repeat(20),
        examples: ['Example 1', 'Example 2', 'Example 3'],
        constraints: ['Constraint 1', 'Constraint 2'],
        context: 'Additional context information that is quite lengthy',
        requirements: ['Req 1', 'Req 2', 'Req 3']
      });

      expect(completeScore).toBeGreaterThan(emptyScore);
      expect(completeScore).toBeGreaterThan(0.5);
    });

    it('increases score with description length', () => {
      const shortScore = calculateInputCompleteness({
        description: 'Short'
      });
      const longScore = calculateInputCompleteness({
        description: 'A much longer description that provides more context and details about the project requirements and goals'.repeat(5)
      });

      expect(longScore).toBeGreaterThan(shortScore);
    });

    it('increases score with examples', () => {
      const noExamples = calculateInputCompleteness({
        description: 'Test'
      });
      const withExamples = calculateInputCompleteness({
        description: 'Test',
        examples: ['Ex1', 'Ex2', 'Ex3', 'Ex4']
      });

      expect(withExamples).toBeGreaterThan(noExamples);
    });

    it('increases score with constraints', () => {
      const noConstraints = calculateInputCompleteness({
        description: 'Test'
      });
      const withConstraints = calculateInputCompleteness({
        description: 'Test',
        constraints: ['C1', 'C2', 'C3']
      });

      expect(withConstraints).toBeGreaterThan(noConstraints);
    });

    it('increases score with context', () => {
      const noContext = calculateInputCompleteness({
        description: 'Test'
      });
      const withContext = calculateInputCompleteness({
        description: 'Test',
        context: 'Additional context information that is quite lengthy and provides more details'
      });

      expect(withContext).toBeGreaterThan(noContext);
    });

    it('increases score with requirements', () => {
      const noReqs = calculateInputCompleteness({
        description: 'Test'
      });
      const withReqs = calculateInputCompleteness({
        description: 'Test',
        requirements: ['R1', 'R2', 'R3', 'R4', 'R5']
      });

      expect(withReqs).toBeGreaterThan(noReqs);
    });
  });

  describe('getConfidenceTier', () => {
    it('returns high for scores >= 70', () => {
      expect(getConfidenceTier(70)).toBe('high');
      expect(getConfidenceTier(85)).toBe('high');
      expect(getConfidenceTier(100)).toBe('high');
    });

    it('returns medium for scores 50-69', () => {
      expect(getConfidenceTier(50)).toBe('medium');
      expect(getConfidenceTier(60)).toBe('medium');
      expect(getConfidenceTier(69)).toBe('medium');
    });

    it('returns low for scores < 50', () => {
      expect(getConfidenceTier(0)).toBe('low');
      expect(getConfidenceTier(25)).toBe('low');
      expect(getConfidenceTier(49)).toBe('low');
    });

    it('respects custom thresholds', () => {
      const customConfig = {
        ...DEFAULT_CONFIDENCE_CONFIG,
        warningThreshold: 80,
        errorThreshold: 60
      };

      expect(getConfidenceTier(75, customConfig)).toBe('medium');
      expect(getConfidenceTier(55, customConfig)).toBe('low');
    });
  });

  describe('calculateWeightedScore', () => {
    it('calculates weighted average of factors', () => {
      const score = calculateWeightedScore({
        inputCompleteness: 0.8,
        aiSelfAssessment: 0.7,
        patternMatch: 0.9
      });

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('respects custom weights', () => {
      const factors = {
        inputCompleteness: 1.0,
        aiSelfAssessment: 0.0,
        patternMatch: 0.0
      };

      const inputOnlyScore = calculateWeightedScore(factors, {
        inputCompleteness: 1.0,
        aiSelfAssessment: 0.0,
        patternMatch: 0.0
      });

      expect(inputOnlyScore).toBe(100);
    });

    it('returns 0-100 range', () => {
      const lowScore = calculateWeightedScore({
        inputCompleteness: 0,
        aiSelfAssessment: 0,
        patternMatch: 0
      });

      const highScore = calculateWeightedScore({
        inputCompleteness: 1,
        aiSelfAssessment: 1,
        patternMatch: 1
      });

      expect(lowScore).toBe(0);
      expect(highScore).toBe(100);
    });

    it('handles partial weights', () => {
      const score = calculateWeightedScore({
        inputCompleteness: 0.5,
        aiSelfAssessment: 0.5,
        patternMatch: 0.5
      }, {
        inputCompleteness: 0.5,
        aiSelfAssessment: 0.3,
        patternMatch: 0.2
      });

      expect(score).toBe(50);
    });
  });

  describe('generateClarifyingQuestions', () => {
    it('generates questions for low input completeness', () => {
      const questions = generateClarifyingQuestions(
        'Features',
        { inputCompleteness: 0.3, aiSelfAssessment: 0.8, patternMatch: 0.7 }
      );

      expect(questions.length).toBeGreaterThan(0);
      expect(questions.some(q => q.toLowerCase().includes('features'))).toBe(true);
    });

    it('generates questions for low pattern match', () => {
      const questions = generateClarifyingQuestions(
        'Architecture',
        { inputCompleteness: 0.8, aiSelfAssessment: 0.7, patternMatch: 0.3 }
      );

      expect(questions.some(q => q.includes('standard') || q.includes('pattern'))).toBe(true);
    });

    it('includes AI uncertain areas as questions', () => {
      const questions = generateClarifyingQuestions(
        'Test',
        { inputCompleteness: 0.5, aiSelfAssessment: 0.5, patternMatch: 0.5 },
        ['What is the deployment target?', 'Which database to use?']
      );

      expect(questions.some(q => q.includes('deployment') || q.includes('database'))).toBe(true);
    });

    it('limits to 5 questions', () => {
      const questions = generateClarifyingQuestions(
        'Test',
        { inputCompleteness: 0.2, aiSelfAssessment: 0.2, patternMatch: 0.2 },
        ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?', 'Q6?', 'Q7?']
      );

      expect(questions.length).toBeLessThanOrEqual(5);
    });

    it('generates no questions for high confidence factors', () => {
      const questions = generateClarifyingQuestions(
        'Test',
        { inputCompleteness: 0.9, aiSelfAssessment: 0.9, patternMatch: 0.9 }
      );

      // Should have minimal questions when all factors are high
      expect(questions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('ConfidenceScorer class', () => {
    let scorer: ConfidenceScorer;

    beforeEach(() => {
      scorer = new ConfidenceScorer();
    });

    describe('calculateSectionConfidence', () => {
      it('returns valid SectionConfidence object', () => {
        const result = scorer.calculateSectionConfidence({
          sectionId: 'overview',
          sectionName: 'Overview',
          inputData: { description: 'Project overview' },
          aiSelfAssessment: 0.75
        });

        expect(result.sectionId).toBe('overview');
        expect(result.sectionName).toBe('Overview');
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(['high', 'medium', 'low']).toContain(result.tier);
        expect(result.factors).toBeDefined();
        expect(typeof result.needsReview).toBe('boolean');
      });

      it('generates clarifying questions for low tier', () => {
        const result = scorer.calculateSectionConfidence({
          sectionId: 'test',
          sectionName: 'Test Section',
          inputData: {},
          aiSelfAssessment: 0.2,
          patternMatchScore: 0.2
        });

        expect(result.tier).toBe('low');
        expect(result.clarifyingQuestions).toBeDefined();
        expect(result.clarifyingQuestions!.length).toBeGreaterThan(0);
      });

      it('marks needsReview for scores below warning threshold', () => {
        const highResult = scorer.calculateSectionConfidence({
          sectionId: 'test',
          sectionName: 'Test',
          inputData: { description: 'Long description '.repeat(50) },
          aiSelfAssessment: 0.9,
          patternMatchScore: 0.9
        });

        const lowResult = scorer.calculateSectionConfidence({
          sectionId: 'test2',
          sectionName: 'Test 2',
          inputData: {},
          aiSelfAssessment: 0.3,
          patternMatchScore: 0.3
        });

        expect(highResult.needsReview).toBe(false);
        expect(lowResult.needsReview).toBe(true);
      });

      it('respects patternMatchScore override', () => {
        const result = scorer.calculateSectionConfidence({
          sectionId: 'test',
          sectionName: 'Test',
          inputData: { description: 'Test' },
          aiSelfAssessment: 0.5,
          patternMatchScore: 1.0
        });

        expect(result.factors.patternMatch).toBe(1.0);
      });

      it('includes reasoning when provided', () => {
        const result = scorer.calculateSectionConfidence({
          sectionId: 'test',
          sectionName: 'Test',
          inputData: { description: 'Test' },
          aiSelfAssessment: 0.5,
          aiReasoning: 'Confidence based on example patterns'
        });

        expect(result.reasoning).toBe('Confidence based on example patterns');
      });
    });

    describe('aggregateConfidence', () => {
      it('calculates overall score from sections', () => {
        const sections = [
          scorer.calculateSectionConfidence({
            sectionId: 's1',
            sectionName: 'Section 1',
            inputData: { description: 'Test' },
            aiSelfAssessment: 0.9
          }),
          scorer.calculateSectionConfidence({
            sectionId: 's2',
            sectionName: 'Section 2',
            inputData: { description: 'Test' },
            aiSelfAssessment: 0.7
          })
        ];

        const result = scorer.aggregateConfidence(sections);

        expect(result.totalSections).toBe(2);
        expect(result.overallScore).toBeGreaterThan(0);
        expect(['high', 'medium', 'low']).toContain(result.overallTier);
      });

      it('identifies low confidence sections', () => {
        const lowSection = scorer.calculateSectionConfidence({
          sectionId: 'low',
          sectionName: 'Low Section',
          inputData: {},
          aiSelfAssessment: 0.2,
          patternMatchScore: 0.2
        });

        const result = scorer.aggregateConfidence([lowSection]);

        expect(result.lowConfidenceSections.length).toBe(1);
        expect(result.lowConfidenceSections[0].sectionId).toBe('low');
      });

      it('returns zeros for empty array', () => {
        const result = scorer.aggregateConfidence([]);

        expect(result.totalSections).toBe(0);
        expect(result.overallScore).toBe(0);
        expect(result.overallTier).toBe('low');
      });

      it('counts sections needing review', () => {
        const sections = [
          scorer.calculateSectionConfidence({
            sectionId: 's1',
            sectionName: 'High',
            inputData: { description: 'Very detailed content '.repeat(30) },
            aiSelfAssessment: 0.9,
            patternMatchScore: 0.9
          }),
          scorer.calculateSectionConfidence({
            sectionId: 's2',
            sectionName: 'Low',
            inputData: {},
            aiSelfAssessment: 0.2,
            patternMatchScore: 0.2
          })
        ];

        const result = scorer.aggregateConfidence(sections);
        expect(result.sectionsNeedingReview).toBeGreaterThanOrEqual(1);
      });
    });

    describe('configuration', () => {
      it('allows custom config via constructor', () => {
        const customScorer = new ConfidenceScorer({
          warningThreshold: 80,
          errorThreshold: 60
        });

        expect(customScorer.getConfig().warningThreshold).toBe(80);
        expect(customScorer.getConfig().errorThreshold).toBe(60);
      });

      it('allows updating config', () => {
        scorer.updateConfig({ warningThreshold: 90 });
        expect(scorer.getConfig().warningThreshold).toBe(90);
      });

      it('preserves other config values when updating', () => {
        const original = scorer.getConfig().errorThreshold;
        scorer.updateConfig({ warningThreshold: 90 });
        expect(scorer.getConfig().errorThreshold).toBe(original);
      });
    });
  });
});
