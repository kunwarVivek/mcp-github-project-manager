import { generateObject } from 'ai';
import { AIServiceFactory } from '../ai/AIServiceFactory';
import { CodeExample } from '../../domain/task-context-schemas';
import { AITask } from '../../domain/ai-types';
import { z } from 'zod';

/**
 * Schema for AI-generated code examples
 */
const CodeExamplesSchema = z.object({
  examples: z.array(z.object({
    title: z.string().min(3),
    description: z.string().min(10),
    language: z.string(),
    snippet: z.string().min(20),
    explanation: z.string().min(20),
    source: z.string()
  })).min(1).max(5)
});

/**
 * Generates relevant code examples for tasks
 *
 * Provides pattern-based code examples including:
 * - Technology stack-specific examples
 * - Implementation patterns
 * - Best practice demonstrations
 * - Syntax-correct code snippets
 */
export class CodeExampleGenerator {
  private aiFactory: AIServiceFactory;
  private exampleTemplates: Map<string, CodeExample[]>;

  constructor() {
    this.aiFactory = AIServiceFactory.getInstance();
    this.exampleTemplates = this.initializeTemplates();
  }

  /**
   * Generate code examples for a task
   */
  async generateExamples(
    task: AITask,
    technicalContext?: any,
    maxExamples: number = 3
  ): Promise<CodeExample[]> {
    try {
      const model = this.aiFactory.getBestAvailableModel();
      if (!model) {
        // Fallback to template-based examples
        return this.generateTemplateExamples(task, maxExamples);
      }

      const prompt = this.buildCodeExamplePrompt(task, technicalContext);

      const result = await generateObject({
        model,
        system: this.getSystemPrompt(),
        prompt,
        schema: CodeExamplesSchema,
        maxTokens: 2000,
        temperature: 0.4
      });

      return result.object.examples.slice(0, maxExamples) as CodeExample[];

    } catch (error) {
      process.stderr.write(`Error generating code examples: ${error instanceof Error ? error.message : String(error)}\n`);
      // Fallback to templates
      return this.generateTemplateExamples(task, maxExamples);
    }
  }

  /**
   * Generate examples based on predefined templates
   */
  private generateTemplateExamples(task: AITask, maxExamples: number): CodeExample[] {
    const taskText = `${task.title} ${task.description}`.toLowerCase();
    const examples: CodeExample[] = [];

    // Match against template categories
    for (const [category, templates] of this.exampleTemplates.entries()) {
      if (taskText.includes(category)) {
        examples.push(...templates);
      }
    }

    // If no specific matches, provide generic examples
    if (examples.length === 0) {
      examples.push(...this.getGenericExamples(task));
    }

    return examples.slice(0, maxExamples);
  }

  /**
   * Initialize code example templates
   */
  private initializeTemplates(): Map<string, CodeExample[]> {
    const templates = new Map<string, CodeExample[]>();

    // API/Endpoint templates
    templates.set('api', [
      {
        title: 'RESTful API Endpoint with Validation',
        description: 'Complete API endpoint with request validation and error handling',
        language: 'typescript',
        snippet: `import { Router, Request, Response } from 'express';
import { z } from 'zod';

const router = Router();

// Request validation schema
const CreateResourceSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().optional(),
  tags: z.array(z.string()).optional()
});

// POST endpoint
router.post('/api/resources', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const data = CreateResourceSchema.parse(req.body);

    // Create resource
    const resource = await resourceService.create(data);

    // Return created resource
    res.status(201).json({
      success: true,
      data: resource
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;`,
        explanation: 'Complete API endpoint pattern with Zod validation, proper error handling, and TypeScript types',
        source: 'Express.js + Zod Best Practices'
      }
    ]);

    // React Component templates
    templates.set('component', [
      {
        title: 'React Functional Component with Hooks',
        description: 'Modern React component using hooks for state and effects',
        language: 'typescript',
        snippet: `import React, { useState, useEffect } from 'react';

interface TaskItemProps {
  taskId: string;
  initialTitle: string;
  onUpdate: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  taskId,
  initialTitle,
  onUpdate,
  onDelete
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save changes when editing completes
  const handleSave = async () => {
    if (title === initialTitle) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onUpdate(taskId, title);
      setIsEditing(false);
    } catch (err) {
      setError('Failed to save changes');
      setTitle(initialTitle); // Revert on error
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    setLoading(true);
    try {
      await onDelete(taskId);
    } catch (err) {
      setError('Failed to delete task');
      setLoading(false);
    }
  };

  return (
    <div className="task-item">
      {isEditing ? (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          onKeyPress={(e) => e.key === 'Enter' && handleSave()}
          disabled={loading}
          autoFocus
        />
      ) : (
        <span onClick={() => setIsEditing(true)}>{title}</span>
      )}

      <button onClick={handleDelete} disabled={loading}>
        Delete
      </button>

      {error && <div className="error">{error}</div>}
      {loading && <div className="spinner">Loading...</div>}
    </div>
  );
};`,
        explanation: 'React component with state management, async operations, error handling, and user interaction',
        source: 'React Hooks Best Practices'
      }
    ]);

    // Service Layer templates
    templates.set('service', [
      {
        title: 'Service Class with Dependency Injection',
        description: 'Clean service layer with DI and proper error handling',
        language: 'typescript',
        snippet: `import { injectable, inject } from 'tsyringe';
import { ResourceRepository } from './repositories/ResourceRepository';
import { EventEmitter } from './events/EventEmitter';
import { Logger } from './logger';

export interface CreateResourceDto {
  title: string;
  description?: string;
}

export interface UpdateResourceDto {
  title?: string;
  description?: string;
}

@injectable()
export class ResourceService {
  constructor(
    @inject('ResourceRepository') private repository: ResourceRepository,
    @inject('EventEmitter') private events: EventEmitter,
    @inject('Logger') private logger: Logger
  ) {}

  async create(data: CreateResourceDto): Promise<Resource> {
    this.logger.info('Creating resource', { data });

    // Validate input
    this.validateCreateData(data);

    // Create resource
    const resource = await this.repository.create({
      ...data,
      createdAt: new Date().toISOString(),
      status: 'active'
    });

    // Emit event
    this.events.emit('resource.created', { resource });

    this.logger.info('Resource created', { resourceId: resource.id });

    return resource;
  }

  async update(id: string, data: UpdateResourceDto): Promise<Resource> {
    this.logger.info('Updating resource', { id, data });

    // Get existing resource
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new ResourceNotFoundError(id);
    }

    // Update resource
    const updated = await this.repository.update(id, {
      ...data,
      updatedAt: new Date().toISOString()
    });

    // Emit event
    this.events.emit('resource.updated', { resource: updated });

    return updated;
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Deleting resource', { id });

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new ResourceNotFoundError(id);
    }

    await this.repository.delete(id);

    this.events.emit('resource.deleted', { resourceId: id });
  }

  private validateCreateData(data: CreateResourceDto): void {
    if (!data.title || data.title.length < 3) {
      throw new ValidationError('Title must be at least 3 characters');
    }

    if (data.title.length > 100) {
      throw new ValidationError('Title must be less than 100 characters');
    }
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class ResourceNotFoundError extends Error {
  constructor(id: string) {
    super(\`Resource with ID \${id} not found\`);
    this.name = 'ResourceNotFoundError';
  }
}`,
        explanation: 'Service class with dependency injection, validation, event emission, and logging',
        source: 'Clean Architecture + tsyringe'
      }
    ]);

    // Database/Model templates
    templates.set('database', [
      {
        title: 'TypeORM Entity with Relations',
        description: 'Database entity with relationships and validation',
        language: 'typescript',
        snippet: `import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index
} from 'typeorm';
import { IsNotEmpty, IsOptional, Length } from 'class-validator';

@Entity('resources')
@Index(['projectId', 'status'])
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  @IsNotEmpty()
  @Length(3, 100)
  title: string;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  description?: string;

  @Column({ default: 'active' })
  @Index()
  status: string;

  @Column({ name: 'project_id' })
  @Index()
  projectId: string;

  @ManyToOne(() => Project, project => project.resources)
  project: Project;

  @OneToMany(() => Task, task => task.resource)
  tasks: Task[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}`,
        explanation: 'Complete TypeORM entity with validation, relationships, and indexes',
        source: 'TypeORM + class-validator'
      }
    ]);

    // Testing templates
    templates.set('test', [
      {
        title: 'Unit Test with Jest',
        description: 'Complete unit test suite with mocks and assertions',
        language: 'typescript',
        snippet: `import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ResourceService } from './ResourceService';
import { ResourceRepository } from './repositories/ResourceRepository';
import { EventEmitter } from './events/EventEmitter';
import { Logger } from './logger';

describe('ResourceService', () => {
  let service: ResourceService;
  let mockRepository: jest.Mocked<ResourceRepository>;
  let mockEvents: jest.Mocked<EventEmitter>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // Create mocks
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as any;

    mockEvents = {
      emit: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    } as any;

    // Create service instance
    service = new ResourceService(mockRepository, mockEvents, mockLogger);
  });

  describe('create', () => {
    it('should create a resource successfully', async () => {
      const createData = {
        title: 'Test Resource',
        description: 'Test description'
      };

      const expectedResource = {
        id: '123',
        ...createData,
        status: 'active',
        createdAt: expect.any(String)
      };

      mockRepository.create.mockResolvedValue(expectedResource);

      const result = await service.create(createData);

      expect(result).toEqual(expectedResource);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining(createData)
      );
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'resource.created',
        { resource: expectedResource }
      );
    });

    it('should throw ValidationError for invalid title', async () => {
      const invalidData = { title: 'ab' }; // Too short

      await expect(service.create(invalidData))
        .rejects
        .toThrow('Title must be at least 3 characters');

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update existing resource', async () => {
      const existingResource = {
        id: '123',
        title: 'Original',
        status: 'active'
      };

      const updateData = { title: 'Updated' };

      mockRepository.findById.mockResolvedValue(existingResource);
      mockRepository.update.mockResolvedValue({
        ...existingResource,
        ...updateData
      });

      const result = await service.update('123', updateData);

      expect(result.title).toBe('Updated');
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'resource.updated',
        expect.any(Object)
      );
    });

    it('should throw error for non-existent resource', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.update('999', { title: 'Test' }))
        .rejects
        .toThrow('Resource with ID 999 not found');
    });
  });
});`,
        explanation: 'Comprehensive unit tests with mocks, setup, and multiple test cases',
        source: 'Jest Testing Best Practices'
      }
    ]);

    return templates;
  }

  /**
   * Get generic examples for any task
   */
  private getGenericExamples(task: AITask): CodeExample[] {
    return [
      {
        title: 'Error Handling Pattern',
        description: 'Robust error handling with custom error types',
        language: 'typescript',
        snippet: `class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Usage
try {
  const result = await riskyOperation();
  if (!result) {
    throw new AppError('Operation failed', 400);
  }
} catch (error) {
  if (error instanceof AppError && error.isOperational) {
    // Handle known operational errors
    logger.warn(error.message);
    return { error: error.message };
  }
  // Handle unexpected errors
  logger.error('Unexpected error:', error);
  throw error;
}`,
        explanation: 'Custom error classes with proper error handling patterns',
        source: 'Node.js Error Handling Best Practices'
      },
      {
        title: 'Async/Await with Retry Logic',
        description: 'Retry mechanism for failed operations',
        language: 'typescript',
        snippet: `async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve =>
          setTimeout(resolve, delayMs * Math.pow(2, attempt))
        );
      }
    }
  }

  throw new Error(\`Operation failed after \${maxRetries} retries: \${lastError!.message}\`);
}

// Usage
const data = await withRetry(() => fetchDataFromAPI(), 3, 1000);`,
        explanation: 'Retry logic with exponential backoff for resilient operations',
        source: 'Resilience Patterns'
      }
    ];
  }

  /**
   * Build prompt for code example generation
   */
  private buildCodeExamplePrompt(task: AITask, technicalContext?: any): string {
    const techStack = this.detectTechnologyStack(task, technicalContext);

    return `Generate relevant code examples for this development task:

**Task:**
- Title: ${task.title}
- Description: ${task.description}
- Complexity: ${task.complexity}/10

**Technology Stack:** ${techStack.join(', ')}

${technicalContext ? `**Technical Context:**\n${JSON.stringify(technicalContext, null, 2)}` : ''}

Generate 2-3 code examples that:
1. Are directly relevant to implementing this task
2. Use the identified technology stack
3. Follow best practices and patterns
4. Are syntactically correct and executable
5. Include clear explanations

Focus on practical examples that developers can reference during implementation.`;
  }

  /**
   * Detect technology stack from task
   */
  private detectTechnologyStack(task: AITask, technicalContext?: any): string[] {
    const stack: string[] = [];
    const taskText = `${task.title} ${task.description}`.toLowerCase();

    // Programming languages
    if (taskText.includes('typescript') || taskText.includes('.ts')) stack.push('TypeScript');
    if (taskText.includes('javascript') || taskText.includes('.js')) stack.push('JavaScript');
    if (taskText.includes('python')) stack.push('Python');
    if (taskText.includes('java') && !taskText.includes('javascript')) stack.push('Java');

    // Frameworks
    if (taskText.includes('react')) stack.push('React');
    if (taskText.includes('vue')) stack.push('Vue.js');
    if (taskText.includes('angular')) stack.push('Angular');
    if (taskText.includes('express')) stack.push('Express.js');
    if (taskText.includes('fastapi')) stack.push('FastAPI');

    // Databases
    if (taskText.includes('postgres') || taskText.includes('postgresql')) stack.push('PostgreSQL');
    if (taskText.includes('mongodb') || taskText.includes('mongo')) stack.push('MongoDB');
    if (taskText.includes('redis')) stack.push('Redis');

    // Default to common stack if nothing detected
    if (stack.length === 0) {
      stack.push('TypeScript', 'Node.js');
    }

    return stack;
  }

  /**
   * Get system prompt
   */
  private getSystemPrompt(): string {
    return `You are an expert software engineer who excels at providing clear, practical code examples.

Your role is to generate code examples that:
- Are directly relevant to the task
- Follow industry best practices
- Are syntactically correct and executable
- Include proper error handling
- Use appropriate design patterns
- Are well-commented and explained

Focus on providing examples that developers can immediately understand and adapt for their implementation.`;
  }

  /**
   * Check if AI-enhanced examples are available
   */
  isAIAvailable(): boolean {
    return !!this.aiFactory.getBestAvailableModel();
  }
}
