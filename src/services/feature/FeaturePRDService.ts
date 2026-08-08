import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { ILogger, Logger } from '../../infrastructure/logger';

import {
  FeatureAdditionRequest,
  FeatureRequirement,
  PRDDocument,
  TaskPriority
} from '../../domain/ai-types.js';
import { safeCall } from '../utils/safeCall';
import { FeatureAnalysisService } from './FeatureAnalysisService.js';

/**
 * Manages adding features to PRD documents.
 *
 * Extracted from FeatureManagementService (SRP decomposition).
 * Responsibility: analyse a feature request, create a FeatureRequirement,
 * merge it into a PRD, and assess impact on existing features.
 */
export class FeaturePRDService {
  private readonly logger: ILogger;

  /**
   * @param analysisService - Injected feature-analysis service.
   *   Falls back to a new instance when omitted (backward-compatible mode).
   * @param logger - Logger instance for diagnostics. When omitted, defaults to
   *   the global singleton via `Logger.getInstance()`.
   */
  constructor(
    private readonly analysisService: FeatureAnalysisService = new FeatureAnalysisService(),
    logger?: ILogger
  ) {
    this.logger = logger ?? Logger.getInstance();
  }

  /**
   * Analyse a feature request, then merge it into the target PRD.
   */
  async addFeatureToPRD(params: {
    featureRequest: FeatureAdditionRequest;
    targetPRD: PRDDocument;
    autoApprove?: boolean;
  }): Promise<{
    updatedPRD: PRDDocument;
    newFeature: FeatureRequirement;
    impactAssessment: string;
  }> {
    return safeCall(async () => {
      // Analyse the request
      const analysis = await this.analysisService.analyzeFeatureRequest({
        featureIdea: params.featureRequest.featureIdea,
        description: params.featureRequest.description,
        existingPRD: params.targetPRD,
        businessJustification: params.featureRequest.businessJustification,
        targetUsers: params.featureRequest.targetUsers,
        requestedBy: params.featureRequest.requestedBy
      });

      if (!params.autoApprove && analysis.recommendation !== 'approve') {
        this.logger.error(`Feature request not approved: ${analysis.recommendation}`);
        throw new Error(`Feature request not approved: ${analysis.analysis}`);
      }

      // Build the new feature requirement
      const newFeature: FeatureRequirement = {
        id: uuidv4(),
        title: params.featureRequest.featureIdea,
        description: params.featureRequest.description,
        priority: analysis.priority,
        userStories: [
          `As a user, I want ${params.featureRequest.featureIdea.toLowerCase()} so that I can achieve my goals more effectively`
        ],
        acceptanceCriteria: [
          'Feature is implemented according to specifications',
          'Feature integrates seamlessly with existing functionality',
          'Feature passes all quality gates'
        ],
        estimatedComplexity: analysis.complexity,
        dependencies: analysis.dependencies
      };

      // Merge into PRD
      const updatedPRD: PRDDocument = {
        ...params.targetPRD,
        features: [...params.targetPRD.features, newFeature],
        updatedAt: new Date().toISOString(),
        version: this.incrementVersion(params.targetPRD.version)
      };

      const impactAssessment = this.assessFeatureImpact({
        newFeature,
        existingFeatures: params.targetPRD.features,
        systemContext: params.targetPRD.technicalRequirements
      });

      return { updatedPRD, newFeature, impactAssessment };
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  incrementVersion(version: string): string {
    const parts = version.split('.');
    if (parts.length === 3) {
      const minor = parseInt(parts[1]) + 1;
      return `${parts[0]}.${minor}.0`;
    }
    return version;
  }

  assessFeatureImpact(params: {
    newFeature: FeatureRequirement;
    existingFeatures: FeatureRequirement[];
    systemContext: any;
  }): string {
    return `Adding ${params.newFeature.title} will require integration with ${params.existingFeatures.length} existing features.`;
  }
}
