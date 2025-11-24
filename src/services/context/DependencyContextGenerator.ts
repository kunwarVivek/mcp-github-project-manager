import { generateObject } from 'ai';
import { AIServiceFactory } from '../ai/AIServiceFactory';
import {
  DependencyContext,
  Dependency
} from '../../domain/task-context-schemas';
import { AITask, EnhancedTaskDependency } from '../../domain/ai-types';
import { z } from 'zod';

/**
 * Schema for AI-generated dependency context
 */
const DependencyContextGenerationSchema = z.object({
  dependencies: z.array(z.object({
    dependencyId: z.string(),
    dependencyTitle: z.string(),
    dependencyType: z.enum(['blocks', 'required_by', 'relates_to', 'implements']),
    rationale: z.string().min(20),
    providedBy: z.string().min(10),
    integrationGuidance: z.string().min(20),
    interfaces: z.array(z.string()),
    canRunInParallel: z.boolean()
  })),
  parallelOpportunities: z.array(z.object({
    taskIds: z.array(z.string()).min(2),
    reason: z.string().min(20),
    considerations: z.array(z.string())
  })),
  criticalPath: z.array(z.string()),
  estimatedUnblockDate: z.string().optional()
});

/**
 * Generates enhanced dependency context for tasks (FR-6: Dependency Context Enhancement)
 *
 * Provides comprehensive dependency information including:
 * - Explanation of why dependencies exist
 * - What dependent tasks provide
 * - Integration guidance and interfaces
 * - Opportunities for parallel work
 */
export class DependencyContextGenerator {
  private aiFactory: AIServiceFactory;

  constructor() {
    this.aiFactory = AIServiceFactory.getInstance();
  }

  /**
   * Generate complete dependency context for a task
   */
  async generateDependencyContext(
    task: AITask,
    allTasks: AITask[],
    dependencies?: EnhancedTaskDependency[]
  ): Promise<DependencyContext | null> {
    try {
      const model = this.aiFactory.getBestAvailableModel();
      if (!model) {
        // Fallback to manual dependency analysis
        return this.generateBasicDependencyContext(task, allTasks, dependencies);
      }

      const prompt = this.buildDependencyPrompt(task, allTasks, dependencies);

      const result = await generateObject({
        model,
        system: this.getSystemPrompt(),
        prompt,
        schema: DependencyContextGenerationSchema,
        maxTokens: 1500,
        temperature: 0.3
      });

      return result.object as DependencyContext;

    } catch (error) {
      process.stderr.write(`Error generating dependency context: ${error instanceof Error ? error.message : String(error)}\n`);
      // Fallback to basic analysis
      return this.generateBasicDependencyContext(task, allTasks, dependencies);
    }
  }

  /**
   * Generate basic dependency context without AI (fallback)
   */
  private generateBasicDependencyContext(
    task: AITask,
    allTasks: AITask[],
    dependencies?: EnhancedTaskDependency[]
  ): DependencyContext {
    const deps: Dependency[] = [];
    const taskDeps = dependencies || task.dependencies || [];

    // Process each dependency
    for (const dep of taskDeps) {
      const depTask = allTasks.find(t => t.id === dep.id || t.title === dep.id);

      if (depTask) {
        deps.push({
          dependencyId: depTask.id || dep.id,
          dependencyTitle: depTask.title,
          dependencyType: this.determineDependencyType(task, depTask),
          rationale: this.generateDependencyRationale(task, depTask),
          providedBy: this.identifyWhatIsProvided(depTask),
          integrationGuidance: this.generateIntegrationGuidance(task, depTask),
          interfaces: this.identifyInterfaces(task, depTask),
          canRunInParallel: this.canRunInParallel(task, depTask)
        });
      } else {
        // Dependency task not found, create basic entry
        deps.push({
          dependencyId: dep.id,
          dependencyTitle: dep.id,
          dependencyType: 'blocks' as const,
          rationale: dep.description || 'This task depends on completion of another task',
          providedBy: 'Required functionality or data',
          integrationGuidance: 'Integrate with the completed dependency',
          interfaces: [],
          canRunInParallel: false
        });
      }
    }

    // Identify parallel opportunities
    const parallelOpportunities = this.identifyParallelOpportunities(task, allTasks, deps);

    // Determine critical path
    const criticalPath = this.determineCriticalPath(task, allTasks, deps);

    return {
      dependencies: deps,
      parallelOpportunities,
      criticalPath,
      estimatedUnblockDate: this.estimateUnblockDate(deps)
    };
  }

  /**
   * Determine the type of dependency relationship
   */
  private determineDependencyType(
    task: AITask,
    depTask: AITask
  ): 'blocks' | 'required_by' | 'relates_to' | 'implements' {
    const taskText = `${task.title} ${task.description}`.toLowerCase();
    const depText = `${depTask.title} ${depTask.description}`.toLowerCase();

    // Check if dependency implements something this task uses
    if (depText.includes('implement') && taskText.includes('use')) {
      return 'implements';
    }

    // Check if dependency sets up infrastructure
    if (depText.includes('setup') || depText.includes('configure') || depText.includes('infrastructure')) {
      return 'blocks';
    }

    // Check if tasks are related but not blocking
    if (taskText.includes(depTask.title.toLowerCase()) || depText.includes(task.title.toLowerCase())) {
      return 'relates_to';
    }

    // Default to blocking dependency
    return 'blocks';
  }

  /**
   * Generate rationale for why dependency exists
   */
  private generateDependencyRationale(task: AITask, depTask: AITask): string {
    const depText = depTask.title.toLowerCase();

    if (depText.includes('setup') || depText.includes('infrastructure')) {
      return `${task.title} requires the infrastructure and setup provided by "${depTask.title}" to be completed first`;
    }

    if (depText.includes('api') || depText.includes('endpoint')) {
      return `${task.title} depends on the API endpoints created by "${depTask.title}" to function properly`;
    }

    if (depText.includes('model') || depText.includes('schema') || depText.includes('database')) {
      return `${task.title} requires the data model and schema defined in "${depTask.title}" to be in place`;
    }

    if (depText.includes('component') || depText.includes('ui')) {
      return `${task.title} builds upon the UI components created in "${depTask.title}"`;
    }

    return `${task.title} depends on "${depTask.title}" being completed to provide necessary functionality`;
  }

  /**
   * Identify what the dependency provides
   */
  private identifyWhatIsProvided(depTask: AITask): string {
    const taskText = `${depTask.title} ${depTask.description}`.toLowerCase();

    if (taskText.includes('setup') || taskText.includes('configure')) {
      return 'Configured environment and infrastructure setup';
    }

    if (taskText.includes('api') || taskText.includes('endpoint')) {
      return 'RESTful API endpoints and data access layer';
    }

    if (taskText.includes('model') || taskText.includes('schema')) {
      return 'Data models, schemas, and database structure';
    }

    if (taskText.includes('component') || taskText.includes('ui')) {
      return 'Reusable UI components and interface elements';
    }

    if (taskText.includes('auth') || taskText.includes('authentication')) {
      return 'Authentication and authorization functionality';
    }

    if (taskText.includes('service') || taskText.includes('business logic')) {
      return 'Business logic and service layer functionality';
    }

    return `Functionality implemented in: ${depTask.title}`;
  }

  /**
   * Generate integration guidance
   */
  private generateIntegrationGuidance(task: AITask, depTask: AITask): string {
    const depText = depTask.title.toLowerCase();

    if (depText.includes('api')) {
      return 'Import the API client and use the provided endpoints. Ensure proper error handling and authentication.';
    }

    if (depText.includes('component')) {
      return 'Import the component from the shared component library. Follow the component API and props interface.';
    }

    if (depText.includes('service')) {
      return 'Inject the service through dependency injection. Use the service interface for type safety.';
    }

    if (depText.includes('model') || depText.includes('schema')) {
      return 'Import the model types and use them for type safety. Follow the defined schema structure.';
    }

    return `Integrate with ${depTask.title} by importing and using the provided interfaces and implementations.`;
  }

  /**
   * Identify integration interfaces
   */
  private identifyInterfaces(task: AITask, depTask: AITask): string[] {
    const interfaces: string[] = [];
    const depText = `${depTask.title} ${depTask.description}`.toLowerCase();

    if (depText.includes('api')) {
      interfaces.push('REST API endpoints', 'Request/Response DTOs', 'Error handling');
    }

    if (depText.includes('component')) {
      interfaces.push('Component props interface', 'Event handlers', 'Styling props');
    }

    if (depText.includes('service')) {
      interfaces.push('Service interface', 'Method signatures', 'Return types');
    }

    if (depText.includes('model') || depText.includes('schema')) {
      interfaces.push('Entity interfaces', 'DTO types', 'Validation schemas');
    }

    if (depText.includes('database')) {
      interfaces.push('Repository interface', 'Query methods', 'Transaction handling');
    }

    return interfaces.length > 0 ? interfaces : ['Standard integration interface'];
  }

  /**
   * Determine if tasks can run in parallel
   */
  private canRunInParallel(task: AITask, depTask: AITask): boolean {
    // If dependency is blocking, cannot run in parallel
    const depType = this.determineDependencyType(task, depTask);
    if (depType === 'blocks' || depType === 'implements') {
      return false;
    }

    // If tasks are just related, they might be able to run in parallel
    if (depType === 'relates_to') {
      return true;
    }

    return false;
  }

  /**
   * Identify opportunities for parallel work
   */
  private identifyParallelOpportunities(
    task: AITask,
    allTasks: AITask[],
    dependencies: Dependency[]
  ): Array<{ taskIds: string[]; reason: string; considerations: string[] }> {
    const opportunities: Array<{ taskIds: string[]; reason: string; considerations: string[] }> = [];

    // Find tasks with no dependencies that could run in parallel
    const independentTasks = allTasks.filter(t =>
      t.id !== task.id &&
      (!t.dependencies || t.dependencies.length === 0) &&
      !dependencies.some(d => d.dependencyId === t.id)
    );

    if (independentTasks.length >= 2) {
      opportunities.push({
        taskIds: independentTasks.slice(0, 3).map(t => t.id || t.title),
        reason: 'These tasks have no dependencies and can be worked on simultaneously',
        considerations: [
          'Ensure team members are assigned to different tasks',
          'Coordinate integration points if tasks touch the same modules',
          'Regular sync meetings to ensure consistency'
        ]
      });
    }

    // Find tasks that depend on the same prerequisites
    const sameDepsGroups = this.groupTasksByDependencies(allTasks);
    for (const group of sameDepsGroups) {
      if (group.length >= 2) {
        opportunities.push({
          taskIds: group.map(t => t.id || t.title),
          reason: 'These tasks share the same dependencies and can start together once prerequisites are met',
          considerations: [
            'Wait for shared dependencies to complete',
            'Coordinate to avoid conflicts in shared code areas',
            'Plan integration strategy upfront'
          ]
        });
      }
    }

    return opportunities;
  }

  /**
   * Group tasks by their dependencies
   */
  private groupTasksByDependencies(tasks: AITask[]): AITask[][] {
    const groups: Map<string, AITask[]> = new Map();

    for (const task of tasks) {
      if (task.dependencies && task.dependencies.length > 0) {
        const depKey = task.dependencies.map(d => d.id).sort().join(',');
        const group = groups.get(depKey) || [];
        group.push(task);
        groups.set(depKey, group);
      }
    }

    return Array.from(groups.values()).filter(group => group.length >= 2);
  }

  /**
   * Determine critical path through dependencies
   */
  private determineCriticalPath(
    task: AITask,
    allTasks: AITask[],
    dependencies: Dependency[]
  ): string[] {
    const criticalPath: string[] = [];
    const visited = new Set<string>();

    const traverse = (currentTask: AITask) => {
      if (visited.has(currentTask.id || currentTask.title)) {
        return;
      }

      visited.add(currentTask.id || currentTask.title);
      criticalPath.push(currentTask.id || currentTask.title);

      // Find dependencies of current task
      const taskDeps = dependencies.filter(d => d.dependencyId === (currentTask.id || currentTask.title));
      for (const dep of taskDeps) {
        const depTask = allTasks.find(t => (t.id || t.title) === dep.dependencyId);
        if (depTask && !visited.has(depTask.id || depTask.title)) {
          traverse(depTask);
        }
      }
    };

    traverse(task);
    return criticalPath.reverse(); // Reverse to show dependency order
  }

  /**
   * Estimate when dependencies will be unblocked
   */
  private estimateUnblockDate(dependencies: Dependency[]): string | undefined {
    // If no blocking dependencies, return undefined
    const blockingDeps = dependencies.filter(d => d.dependencyType === 'blocks' && !d.canRunInParallel);

    if (blockingDeps.length === 0) {
      return undefined;
    }

    // Simple estimation: assume dependencies take their average time
    const daysFromNow = blockingDeps.length * 3; // Rough estimate: 3 days per blocking dependency
    const unblockDate = new Date();
    unblockDate.setDate(unblockDate.getDate() + daysFromNow);

    return unblockDate.toISOString();
  }

  /**
   * Build AI prompt for dependency analysis
   */
  private buildDependencyPrompt(
    task: AITask,
    allTasks: AITask[],
    dependencies?: EnhancedTaskDependency[]
  ): string {
    const taskDeps = dependencies || task.dependencies || [];
    const depTasks = taskDeps.map(dep => {
      const t = allTasks.find(at => at.id === dep.id || at.title === dep.id);
      return t ? `- ${t.title}: ${t.description}` : `- ${dep.id}`;
    }).join('\n');

    return `Analyze the dependencies for this task and provide detailed context:

**Current Task:**
- Title: ${task.title}
- Description: ${task.description}
- Priority: ${task.priority}
- Complexity: ${task.complexity}/10

**Dependencies:**
${depTasks || 'No explicit dependencies listed'}

**All Project Tasks:**
${allTasks.map(t => `- ${t.title} (Priority: ${t.priority}, Complexity: ${t.complexity})`).join('\n')}

Provide:
1. For each dependency, explain WHY it exists and WHAT it provides
2. Clear integration guidance for each dependency
3. Identify which dependencies can be worked on in parallel
4. Identify opportunities for parallel work across the project
5. Determine the critical path
6. Estimate when dependencies will be resolved`;
  }

  /**
   * Get system prompt for dependency analysis
   */
  private getSystemPrompt(): string {
    return `You are an expert project manager and software architect specializing in dependency analysis.

Your role is to analyze task dependencies and provide:
- Clear rationale for why each dependency exists
- What each dependency provides to the current task
- Specific integration guidance and interfaces
- Opportunities for parallel work
- Critical path analysis

Focus on helping developers understand:
- WHY dependencies exist (business and technical reasons)
- WHAT dependent tasks must provide
- HOW to integrate with dependencies
- WHEN work can be parallelized

Provide practical, actionable guidance that reduces confusion and accelerates development.`;
  }

  /**
   * Check if AI-enhanced dependency analysis is available
   */
  isAIAvailable(): boolean {
    return !!this.aiFactory.getBestAvailableModel();
  }
}
