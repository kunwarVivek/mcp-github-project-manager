import { AITaskProcessor } from './ai/AITaskProcessor';
import {
  PRDDocument,
  FeatureRequirement,
  UserPersona,
  ProjectScope,
  TechnicalRequirement,
  PRDDocumentSchema
} from '../domain/ai-types';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

/**
 * Service for generating and managing Product Requirements Documents (PRDs)
 */
export class PRDGenerationService {
  private aiProcessor: AITaskProcessor;

  constructor() {
    this.aiProcessor = new AITaskProcessor();
  }

  /**
   * Generate a comprehensive PRD from a project idea
   */
  async generatePRDFromIdea(params: {
    projectIdea: string;
    projectName: string;
    targetUsers?: string[];
    timeline?: string;
    complexity?: 'low' | 'medium' | 'high';
    author: string;
    stakeholders?: string[];
  }): Promise<PRDDocument> {
    try {
      // Validate input
      if (!params.projectIdea.trim()) {
        throw new Error('Project idea is required');
      }

      if (!params.projectName.trim()) {
        throw new Error('Project name is required');
      }

      // Generate PRD using AI
      const generatedPRD = await this.aiProcessor.generatePRDFromIdea({
        projectIdea: params.projectIdea,
        targetUsers: params.targetUsers?.join(', '),
        timeline: params.timeline,
        complexity: params.complexity
      });

      // Enhance with provided metadata
      const enhancedPRD: PRDDocument = {
        ...generatedPRD,
        title: params.projectName,
        author: params.author,
        stakeholders: params.stakeholders || [],
        version: '1.0.0'
      };

      // Validate the generated PRD
      const validatedPRD = PRDDocumentSchema.parse(enhancedPRD);

      return validatedPRD;
    } catch (error) {
      process.stderr.write(`Error generating PRD from idea: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to generate PRD: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhance an existing PRD with AI assistance
   */
  async enhancePRD(params: {
    currentPRD: PRDDocument | string;
    enhancementType: 'comprehensive' | 'technical' | 'user_focused' | 'business_focused';
    focusAreas?: string[];
    includeResearch?: boolean;
  }): Promise<PRDDocument> {
    try {
      const currentPRDContent = typeof params.currentPRD === 'string'
        ? params.currentPRD
        : JSON.stringify(params.currentPRD, null, 2);

      const enhancedPRD = await this.aiProcessor.enhancePRD({
        currentPRD: currentPRDContent,
        enhancementType: params.enhancementType,
        focusAreas: params.focusAreas
      });

      // If we started with a PRD object, preserve some original metadata
      if (typeof params.currentPRD === 'object') {
        enhancedPRD.id = params.currentPRD.id;
        enhancedPRD.createdAt = params.currentPRD.createdAt;
        enhancedPRD.author = params.currentPRD.author;
        enhancedPRD.version = this.incrementVersion(params.currentPRD.version);
      }

      return PRDDocumentSchema.parse(enhancedPRD);
    } catch (error) {
      process.stderr.write(`Error enhancing PRD: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to enhance PRD: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract and analyze features from a PRD
   */
  async extractFeaturesFromPRD(prd: PRDDocument | string): Promise<FeatureRequirement[]> {
    try {
      const prdContent = typeof prd === 'string'
        ? prd
        : JSON.stringify(prd, null, 2);

      const features = await this.aiProcessor.extractFeaturesFromPRD(prdContent);

      // Validate and enhance features
      return features.map(feature => ({
        ...feature,
        id: feature.id || uuidv4()
      }));
    } catch (error) {
      process.stderr.write(`Error extracting features from PRD: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to extract features: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate PRD completeness and quality
   */
  async validatePRDCompleteness(prd: PRDDocument): Promise<{
    isComplete: boolean;
    score: number; // 0-100
    missingElements: string[];
    recommendations: string[];
    qualityIssues: string[];
  }> {
    try {
      // Basic validation using schema
      const validationResult = PRDDocumentSchema.safeParse(prd);

      if (!validationResult.success) {
        return {
          isComplete: false,
          score: 0,
          missingElements: validationResult.error.errors.map(e => e.message),
          recommendations: ['Fix schema validation errors'],
          qualityIssues: ['PRD does not match required structure']
        };
      }

      // Content-based validation
      const contentScore = this.calculateContentScore(prd);
      const missingElements = this.identifyMissingElements(prd);
      const recommendations = this.generateRecommendations(prd, missingElements);

      return {
        isComplete: contentScore >= 80 && missingElements.length === 0,
        score: contentScore,
        missingElements,
        recommendations,
        qualityIssues: this.identifyQualityIssues(prd)
      };
    } catch (error) {
      process.stderr.write(`Error validating PRD completeness: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to validate PRD: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate user stories from PRD features
   */
  async generateUserStoriesFromFeatures(features: FeatureRequirement[]): Promise<{
    [featureId: string]: {
      userStories: string[];
      acceptanceCriteria: string[];
    }
  }> {
    try {
      const userStoriesMap: { [featureId: string]: { userStories: string[]; acceptanceCriteria: string[] } } = {};

      for (const feature of features) {
        // For now, use the existing user stories and acceptance criteria
        // In a full implementation, you'd call AI to generate more comprehensive stories
        userStoriesMap[feature.id] = {
          userStories: feature.userStories,
          acceptanceCriteria: feature.acceptanceCriteria
        };
      }

      return userStoriesMap;
    } catch (error) {
      process.stderr.write(`Error generating user stories: ${error instanceof Error ? error.message : String(error)}\n`);
      throw new Error(`Failed to generate user stories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a PRD template for a specific industry or project type
   */
  createPRDTemplate(type: 'web_app' | 'mobile_app' | 'api' | 'saas' | 'ecommerce'): Partial<PRDDocument> {
    const baseTemplate = {
      id: uuidv4(),
      version: '1.0.0',
      aiGenerated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [type],
      stakeholders: [],
      milestones: [],
      successMetrics: []
    };

    switch (type) {
      case 'web_app':
        return {
          ...baseTemplate,
          title: 'Web Application PRD Template',
          overview: 'Template for web application development projects',
          objectives: [
            'Create responsive web application',
            'Ensure cross-browser compatibility',
            'Implement user authentication',
            'Provide intuitive user experience'
          ],
          technicalRequirements: [
            {
              id: uuidv4(),
              category: 'performance',
              requirement: 'Page load time under 3 seconds',
              rationale: 'User experience and SEO requirements',
              priority: 'high' as any
            },
            {
              id: uuidv4(),
              category: 'security',
              requirement: 'HTTPS encryption for all communications',
              rationale: 'Data security and privacy compliance',
              priority: 'critical' as any
            }
          ]
        };

      case 'mobile_app':
        return {
          ...baseTemplate,
          title: 'Mobile Application PRD Template',
          overview: 'Template for mobile application development projects',
          objectives: [
            'Create native or cross-platform mobile app',
            'Ensure optimal performance on mobile devices',
            'Implement offline functionality',
            'Provide seamless user experience'
          ]
        };

      case 'api':
        return {
          ...baseTemplate,
          title: 'API Development PRD Template',
          overview: 'Template for API development projects',
          objectives: [
            'Create RESTful API endpoints',
            'Ensure proper authentication and authorization',
            'Implement comprehensive error handling',
            'Provide clear API documentation'
          ]
        };

      default:
        return baseTemplate;
    }
  }

  /**
   * Calculate content completeness score
   */
  private calculateContentScore(prd: PRDDocument): number {
    let score = 0;
    const maxScore = 100;

    // Overview and objectives (20 points)
    if (prd.overview && prd.overview.length > 50) score += 10;
    if (prd.objectives && prd.objectives.length > 0) score += 10;

    // User analysis (20 points)
    if (prd.targetUsers && prd.targetUsers.length > 0) score += 10;
    if (prd.userJourney && prd.userJourney.length > 50) score += 10;

    // Features (30 points)
    if (prd.features && prd.features.length > 0) score += 15;
    if (prd.features && prd.features.some(f => f.userStories.length > 0)) score += 15;

    // Technical requirements (15 points)
    if (prd.technicalRequirements && prd.technicalRequirements.length > 0) score += 15;

    // Project planning (15 points)
    if (prd.timeline && prd.timeline.length > 0) score += 5;
    if (prd.milestones && prd.milestones.length > 0) score += 5;
    if (prd.successMetrics && prd.successMetrics.length > 0) score += 5;

    return Math.min(score, maxScore);
  }

  /**
   * Identify missing elements in PRD
   */
  private identifyMissingElements(prd: PRDDocument): string[] {
    const missing: string[] = [];

    if (!prd.overview || prd.overview.length < 50) {
      missing.push('Detailed project overview');
    }

    if (!prd.targetUsers || prd.targetUsers.length === 0) {
      missing.push('User personas');
    }

    if (!prd.features || prd.features.length === 0) {
      missing.push('Feature requirements');
    }

    if (!prd.technicalRequirements || prd.technicalRequirements.length === 0) {
      missing.push('Technical requirements');
    }

    if (!prd.successMetrics || prd.successMetrics.length === 0) {
      missing.push('Success metrics and KPIs');
    }

    return missing;
  }

  /**
   * Generate recommendations for PRD improvement
   */
  private generateRecommendations(prd: PRDDocument, missingElements: string[]): string[] {
    const recommendations: string[] = [];

    if (missingElements.includes('User personas')) {
      recommendations.push('Add detailed user personas with goals, pain points, and technical levels');
    }

    if (missingElements.includes('Feature requirements')) {
      recommendations.push('Define specific features with user stories and acceptance criteria');
    }

    if (prd.features && prd.features.some(f => !f.userStories || f.userStories.length === 0)) {
      recommendations.push('Add user stories for all features');
    }

    if (missingElements.includes('Success metrics and KPIs')) {
      recommendations.push('Define measurable success criteria and key performance indicators');
    }

    return recommendations;
  }

  /**
   * Identify quality issues in PRD
   */
  private identifyQualityIssues(prd: PRDDocument): string[] {
    const issues: string[] = [];

    // Check for vague or unclear descriptions
    if (prd.overview && prd.overview.length < 100) {
      issues.push('Project overview is too brief and may lack important details');
    }

    // Check for missing priorities
    if (prd.features && prd.features.some(f => !f.priority)) {
      issues.push('Some features are missing priority levels');
    }

    // Check for missing complexity estimates
    if (prd.features && prd.features.some(f => !f.estimatedComplexity)) {
      issues.push('Some features are missing complexity estimates');
    }

    return issues;
  }

  /**
   * Increment version number
   */
  private incrementVersion(currentVersion: string): string {
    const parts = currentVersion.split('.');
    if (parts.length === 3) {
      const patch = parseInt(parts[2]) + 1;
      return `${parts[0]}.${parts[1]}.${patch}`;
    }
    return currentVersion;
  }
}
