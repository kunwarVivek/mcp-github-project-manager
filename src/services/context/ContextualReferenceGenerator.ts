import { generateObject } from 'ai';
import { AIServiceFactory } from '../ai/AIServiceFactory';
import {
  ContextualReferences,
  PRDSectionReference,
  RelatedFeature,
  TechnicalSpecReference,
  CodeExample,
  ExternalReference
} from '../../domain/task-context-schemas';
import { AITask, PRDDocument, FeatureRequirement } from '../../domain/ai-types';
import { CONTEXT_GENERATION_CONFIGS, formatContextPrompt } from '../ai/prompts/ContextGenerationPrompts';

/**
 * Generates contextual references for tasks (FR-4: Contextual References System)
 *
 * Provides comprehensive reference materials including:
 * - Relevant PRD sections with explanations
 * - Related features and user stories
 * - Technical specifications and API references
 * - Code examples and implementation patterns
 * - External documentation and resources
 */
export class ContextualReferenceGenerator {
  private aiFactory: AIServiceFactory;

  constructor() {
    this.aiFactory = AIServiceFactory.getInstance();
  }

  /**
   * Generate complete contextual references for a task
   */
  async generateReferences(
    task: AITask,
    prd: PRDDocument | string,
    features?: FeatureRequirement[]
  ): Promise<ContextualReferences | null> {
    try {
      const model = this.aiFactory.getBestAvailableModel();
      if (!model) {
        // Fallback to manual extraction if no AI available
        return this.generateBasicReferences(task, prd, features);
      }

      const prdContent = typeof prd === 'string' ? prd : JSON.stringify(prd, null, 2);
      const config = CONTEXT_GENERATION_CONFIGS.contextualReferences;

      const prompt = formatContextPrompt(config.userPrompt, {
        prdContent,
        taskTitle: task.title,
        taskDescription: task.description
      });

      const result = await generateObject({
        model,
        system: config.systemPrompt,
        prompt,
        schema: config.schema,
        maxTokens: config.maxTokens,
        temperature: config.temperature
      });

      return result.object as ContextualReferences;

    } catch (error) {
      process.stderr.write(`Error generating contextual references: ${error instanceof Error ? error.message : String(error)}\n`);
      // Fallback to basic references
      return this.generateBasicReferences(task, prd, features);
    }
  }

  /**
   * Generate basic contextual references without AI (fallback)
   */
  private generateBasicReferences(
    task: AITask,
    prd: PRDDocument | string,
    features?: FeatureRequirement[]
  ): ContextualReferences {
    const prdObj = typeof prd === 'object' ? prd : null;

    return {
      prdSections: this.extractPRDSections(task, prdObj),
      relatedFeatures: this.identifyRelatedFeatures(task, features || []),
      technicalSpecs: this.extractTechnicalSpecs(task, prdObj),
      codeExamples: this.generateBasicCodeExamples(task),
      externalReferences: this.suggestExternalReferences(task)
    };
  }

  /**
   * Extract relevant PRD sections for the task
   */
  private extractPRDSections(
    task: AITask,
    prd: PRDDocument | null
  ): PRDSectionReference[] {
    if (!prd) {
      return [{
        section: 'Overview',
        content: 'PRD content not available',
        relevance: 'Task is part of the overall project requirements',
        importance: 'medium' as const
      }];
    }

    const sections: PRDSectionReference[] = [];

    // Extract objectives section
    if (prd.objectives && prd.objectives.length > 0) {
      const relevantObjectives = prd.objectives.slice(0, 3).join(', ');
      sections.push({
        section: 'Business Objectives',
        content: relevantObjectives,
        relevance: 'This task supports the overall business objectives of the project',
        importance: 'high' as const
      });
    }

    // Extract success metrics
    if (prd.successMetrics && prd.successMetrics.length > 0) {
      const metrics = prd.successMetrics.slice(0, 3).join(', ');
      sections.push({
        section: 'Success Metrics',
        content: metrics,
        relevance: 'Task completion contributes to these measurable success criteria',
        importance: 'high' as const
      });
    }

    // Extract technical requirements if available
    if (prd.technicalRequirements) {
      sections.push({
        section: 'Technical Requirements',
        content: JSON.stringify(prd.technicalRequirements, null, 2).substring(0, 500),
        relevance: 'Technical constraints and requirements applicable to this task',
        importance: 'critical' as const
      });
    }

    return sections;
  }

  /**
   * Identify features related to this task
   */
  private identifyRelatedFeatures(
    task: AITask,
    features: FeatureRequirement[]
  ): RelatedFeature[] {
    const relatedFeatures: RelatedFeature[] = [];
    const taskTitleLower = task.title.toLowerCase();
    const taskDescLower = task.description.toLowerCase();

    for (const feature of features) {
      const featureTitleLower = feature.title.toLowerCase();

      // Check if task title or description mentions the feature
      if (taskTitleLower.includes(featureTitleLower) ||
          taskDescLower.includes(featureTitleLower)) {

        relatedFeatures.push({
          featureId: feature.id || `feature-${features.indexOf(feature)}`,
          title: feature.title,
          relationship: 'implements' as const,
          context: `This task implements part of the "${feature.title}" feature`
        });
      }
    }

    // If no direct relationships found, link to parent feature
    if (relatedFeatures.length === 0 && features.length > 0) {
      const parentFeature = features[0];
      relatedFeatures.push({
        featureId: parentFeature.id || 'feature-0',
        title: parentFeature.title,
        relationship: 'depends_on' as const,
        context: 'This task is related to the overall feature set'
      });
    }

    return relatedFeatures;
  }

  /**
   * Extract technical specification references
   */
  private extractTechnicalSpecs(
    task: AITask,
    prd: PRDDocument | null
  ): TechnicalSpecReference[] {
    const specs: TechnicalSpecReference[] = [];

    // Detect common technical patterns in task
    const taskText = `${task.title} ${task.description}`.toLowerCase();

    if (taskText.includes('api') || taskText.includes('endpoint') || taskText.includes('rest')) {
      specs.push({
        type: 'api_spec' as const,
        title: 'API Specification',
        description: 'RESTful API design and endpoint specifications',
        relevantSections: ['Authentication', 'Request/Response Format', 'Error Handling'],
        url: undefined
      });
    }

    if (taskText.includes('database') || taskText.includes('schema') || taskText.includes('model')) {
      specs.push({
        type: 'data_model' as const,
        title: 'Data Model Specification',
        description: 'Database schema and data model design',
        relevantSections: ['Entity Relationships', 'Schema Design', 'Migrations'],
        url: undefined
      });
    }

    if (taskText.includes('ui') || taskText.includes('component') || taskText.includes('interface')) {
      specs.push({
        type: 'design_system' as const,
        title: 'Design System',
        description: 'UI component library and design patterns',
        relevantSections: ['Component Guidelines', 'Styling Standards', 'Accessibility'],
        url: undefined
      });
    }

    if (taskText.includes('architecture') || taskText.includes('service') || taskText.includes('system')) {
      specs.push({
        type: 'architecture_doc' as const,
        title: 'System Architecture',
        description: 'Overall system architecture and design patterns',
        relevantSections: ['Service Architecture', 'Integration Patterns', 'Data Flow'],
        url: undefined
      });
    }

    return specs;
  }

  /**
   * Generate basic code examples based on task type
   */
  private generateBasicCodeExamples(task: AITask): CodeExample[] {
    const examples: CodeExample[] = [];
    const taskText = `${task.title} ${task.description}`.toLowerCase();

    // API endpoint example
    if (taskText.includes('api') || taskText.includes('endpoint')) {
      examples.push({
        title: 'API Endpoint Pattern',
        description: 'Example of a RESTful API endpoint implementation',
        language: 'typescript',
        snippet: `// Example API endpoint structure
router.get('/api/resource/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await service.findById(id);

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});`,
        explanation: 'Standard pattern for RESTful API endpoints with error handling',
        source: 'Best Practices'
      });
    }

    // Component example
    if (taskText.includes('component') || taskText.includes('ui')) {
      examples.push({
        title: 'React Component Pattern',
        description: 'Example of a React functional component',
        language: 'typescript',
        snippet: `import React from 'react';

interface ComponentProps {
  title: string;
  onAction: () => void;
}

export const Component: React.FC<ComponentProps> = ({ title, onAction }) => {
  return (
    <div className="component">
      <h2>{title}</h2>
      <button onClick={onAction}>Action</button>
    </div>
  );
};`,
        explanation: 'Functional component with TypeScript props',
        source: 'React Best Practices'
      });
    }

    // Service layer example
    if (taskText.includes('service') || taskText.includes('business logic')) {
      examples.push({
        title: 'Service Layer Pattern',
        description: 'Example of service class with dependency injection',
        language: 'typescript',
        snippet: `export class ResourceService {
  constructor(private repository: ResourceRepository) {}

  async create(data: CreateResourceDto): Promise<Resource> {
    // Validate input
    this.validateData(data);

    // Create resource
    const resource = await this.repository.create(data);

    // Emit event
    this.eventEmitter.emit('resource.created', resource);

    return resource;
  }

  private validateData(data: CreateResourceDto): void {
    if (!data.title || data.title.length < 3) {
      throw new ValidationError('Title must be at least 3 characters');
    }
  }
}`,
        explanation: 'Service class with validation and event emission',
        source: 'Clean Architecture'
      });
    }

    return examples;
  }

  /**
   * Suggest relevant external references
   */
  private suggestExternalReferences(task: AITask): ExternalReference[] {
    const references: ExternalReference[] = [];
    const taskText = `${task.title} ${task.description}`.toLowerCase();

    // TypeScript references
    if (taskText.includes('typescript') || taskText.includes('type')) {
      references.push({
        type: 'documentation' as const,
        title: 'TypeScript Documentation',
        description: 'Official TypeScript documentation and best practices',
        url: 'https://www.typescriptlang.org/docs/',
        relevance: 'Essential reference for TypeScript type safety and patterns'
      });
    }

    // React references
    if (taskText.includes('react') || taskText.includes('component')) {
      references.push({
        type: 'documentation' as const,
        title: 'React Documentation',
        description: 'Official React documentation and hooks guide',
        url: 'https://react.dev/',
        relevance: 'Comprehensive guide for React components and hooks'
      });
    }

    // Node.js references
    if (taskText.includes('node') || taskText.includes('server') || taskText.includes('api')) {
      references.push({
        type: 'documentation' as const,
        title: 'Node.js Best Practices',
        description: 'Node.js production best practices',
        url: 'https://github.com/goldbergyoni/nodebestpractices',
        relevance: 'Production-ready Node.js patterns and practices'
      });
    }

    // Testing references
    if (taskText.includes('test') || taskText.includes('testing')) {
      references.push({
        type: 'best_practice' as const,
        title: 'Testing Best Practices',
        description: 'Comprehensive testing strategies and patterns',
        url: 'https://martinfowler.com/testing/',
        relevance: 'Essential testing patterns and strategies'
      });
    }

    // Security references
    if (taskText.includes('security') || taskText.includes('auth')) {
      references.push({
        type: 'best_practice' as const,
        title: 'OWASP Top 10',
        description: 'Top 10 security risks and mitigation strategies',
        url: 'https://owasp.org/www-project-top-ten/',
        relevance: 'Critical security considerations for web applications'
      });
    }

    return references;
  }

  /**
   * Check if AI-enhanced references are available
   */
  isAIAvailable(): boolean {
    return !!this.aiFactory.getBestAvailableModel();
  }
}
