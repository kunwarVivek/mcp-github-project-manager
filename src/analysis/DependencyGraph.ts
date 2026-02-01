import graphlib from 'graphlib';
import type { Graph as GraphType } from 'graphlib';
const { Graph, alg } = graphlib;
import { AITask, TaskDependency } from '../domain/ai-types';
import { extractKeywords, checkKeywordDependency } from './KeywordExtractor';

/**
 * Detected dependency with confidence
 */
export interface DetectedDependency {
  fromTaskId: string;
  toTaskId: string;
  type: 'blocks' | 'depends_on' | 'related_to';
  confidence: number;
  reasoning: string;
  isImplicit: boolean;  // true if auto-detected, false if explicit
}

/**
 * Graph analysis result
 */
export interface GraphAnalysisResult {
  executionOrder: string[];      // Topological sort order
  criticalPath: string[];        // Longest dependency chain
  parallelGroups: string[][];    // Tasks that can run in parallel
  cycles: string[][];            // Detected circular dependencies
  orphanTasks: string[];         // Tasks with no dependencies (entry points)
  leafTasks: string[];           // Tasks nothing depends on (exit points)
}

/**
 * Edge metadata type
 */
interface EdgeMeta {
  type: string;
  confidence: number;
  reasoning: string;
  isImplicit: boolean;
}

/**
 * Graph-based task dependency analysis
 */
export class DependencyGraph {
  private graph: GraphType;
  private tasks: Map<string, AITask>;
  private implicitDependencies: DetectedDependency[] = [];

  constructor() {
    this.graph = new Graph({ directed: true });
    this.tasks = new Map();
  }

  /**
   * Add a task to the graph
   */
  addTask(task: AITask): void {
    this.tasks.set(task.id, task);
    this.graph.setNode(task.id, {
      title: task.title,
      complexity: task.complexity
    });

    // Add explicit dependencies
    for (const dep of task.dependencies || []) {
      this.addDependency(dep.id, task.id, {
        type: dep.type,
        confidence: 1.0,
        reasoning: dep.description || 'Explicitly defined',
        isImplicit: false
      });
    }
  }

  /**
   * Add multiple tasks
   */
  addTasks(tasks: AITask[]): void {
    for (const task of tasks) {
      this.addTask(task);
    }
  }

  /**
   * Add a dependency edge
   */
  addDependency(
    fromId: string,
    toId: string,
    meta: { type: string; confidence: number; reasoning: string; isImplicit: boolean }
  ): void {
    this.graph.setEdge(fromId, toId, meta);

    if (meta.isImplicit) {
      this.implicitDependencies.push({
        fromTaskId: fromId,
        toTaskId: toId,
        type: meta.type as 'blocks' | 'depends_on' | 'related_to',
        confidence: meta.confidence,
        reasoning: meta.reasoning,
        isImplicit: true
      });
    }
  }

  /**
   * Detect implicit dependencies using keyword analysis
   */
  detectImplicitDependencies(confidenceThreshold: number = 0.5): DetectedDependency[] {
    const tasks = Array.from(this.tasks.values());
    const detected: DetectedDependency[] = [];

    for (let i = 0; i < tasks.length; i++) {
      for (let j = 0; j < tasks.length; j++) {
        if (i === j) continue;

        const taskA = tasks[i];
        const taskB = tasks[j];

        // Skip if explicit dependency already exists
        if (this.graph.hasEdge(taskA.id, taskB.id)) continue;

        const keywordsA = extractKeywords(`${taskA.title} ${taskA.description}`);
        const keywordsB = extractKeywords(`${taskB.title} ${taskB.description}`);

        const result = checkKeywordDependency(keywordsA, keywordsB);

        if (result.likely && result.confidence >= confidenceThreshold) {
          const dep: DetectedDependency = {
            fromTaskId: taskA.id,
            toTaskId: taskB.id,
            type: 'depends_on',
            confidence: result.confidence,
            reasoning: result.reason,
            isImplicit: true
          };

          detected.push(dep);

          // Add to graph
          this.addDependency(taskA.id, taskB.id, {
            type: 'depends_on',
            confidence: result.confidence,
            reasoning: result.reason,
            isImplicit: true
          });
        }
      }
    }

    this.implicitDependencies.push(...detected);
    return detected;
  }

  /**
   * Detect circular dependencies
   */
  detectCycles(): string[][] {
    try {
      return alg.findCycles(this.graph);
    } catch {
      return [];
    }
  }

  /**
   * Get topological execution order
   */
  getExecutionOrder(): string[] {
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      throw new Error(`Cannot determine execution order: circular dependencies found in ${cycles.length} cycle(s)`);
    }

    try {
      return alg.topsort(this.graph);
    } catch {
      // If topsort fails, return nodes in arbitrary order
      return this.graph.nodes();
    }
  }

  /**
   * Find the critical path (longest dependency chain)
   */
  getCriticalPath(): string[] {
    const nodes = this.graph.nodes();
    const distances: Map<string, number> = new Map();
    const predecessors: Map<string, string> = new Map();

    // Initialize distances
    for (const node of nodes) {
      distances.set(node, 0);
    }

    // Get topological order
    let order: string[];
    try {
      order = alg.topsort(this.graph);
    } catch {
      return []; // Cycles present
    }

    // Calculate longest paths
    for (const node of order) {
      const task = this.tasks.get(node);
      const nodeWeight = task?.complexity || 1;
      const currentDist = distances.get(node) || 0;

      for (const successor of (this.graph.successors(node) || []) as string[]) {
        const newDist = currentDist + nodeWeight;
        if (newDist > (distances.get(successor) || 0)) {
          distances.set(successor, newDist);
          predecessors.set(successor, node);
        }
      }
    }

    // Find the end of critical path
    let maxDist = 0;
    let endNode = '';
    for (const [node, dist] of distances) {
      if (dist > maxDist) {
        maxDist = dist;
        endNode = node;
      }
    }

    // Reconstruct path
    const path: string[] = [];
    let current: string | undefined = endNode;
    while (current) {
      path.unshift(current);
      current = predecessors.get(current);
    }

    return path;
  }

  /**
   * Group tasks that can run in parallel
   */
  getParallelGroups(): string[][] {
    const groups: string[][] = [];
    const inDegree: Map<string, number> = new Map();
    const nodes = this.graph.nodes();

    // Initialize in-degrees
    for (const node of nodes) {
      inDegree.set(node, (this.graph.predecessors(node) || []).length);
    }

    const remaining = new Set(nodes);

    while (remaining.size > 0) {
      // Find all nodes with no remaining dependencies
      const group: string[] = [];

      for (const node of remaining) {
        if (inDegree.get(node) === 0) {
          group.push(node);
        }
      }

      if (group.length === 0) {
        // Cycle detected or error
        break;
      }

      groups.push(group);

      // Remove these nodes and update in-degrees
      for (const node of group) {
        remaining.delete(node);
        for (const successor of (this.graph.successors(node) || []) as string[]) {
          inDegree.set(successor, (inDegree.get(successor) || 1) - 1);
        }
      }
    }

    return groups;
  }

  /**
   * Get orphan tasks (no predecessors - entry points)
   */
  getOrphanTasks(): string[] {
    return this.graph.nodes().filter((node: string) =>
      (this.graph.predecessors(node) || []).length === 0
    );
  }

  /**
   * Get leaf tasks (no successors - exit points)
   */
  getLeafTasks(): string[] {
    return this.graph.nodes().filter((node: string) =>
      (this.graph.successors(node) || []).length === 0
    );
  }

  /**
   * Run full graph analysis
   */
  analyze(): GraphAnalysisResult {
    const cycles = this.detectCycles();

    let executionOrder: string[] = [];
    let criticalPath: string[] = [];
    let parallelGroups: string[][] = [];

    if (cycles.length === 0) {
      executionOrder = this.getExecutionOrder();
      criticalPath = this.getCriticalPath();
      parallelGroups = this.getParallelGroups();
    }

    return {
      executionOrder,
      criticalPath,
      parallelGroups,
      cycles,
      orphanTasks: this.getOrphanTasks(),
      leafTasks: this.getLeafTasks()
    };
  }

  /**
   * Get all implicit dependencies detected
   */
  getImplicitDependencies(): DetectedDependency[] {
    return [...this.implicitDependencies];
  }

  /**
   * Export graph for visualization
   */
  exportForVisualization(): {
    nodes: Array<{ id: string; label: string; complexity: number }>;
    edges: Array<{ from: string; to: string; type: string; confidence: number }>;
  } {
    const nodes = this.graph.nodes().map((id: string) => {
      const task = this.tasks.get(id);
      return {
        id,
        label: task?.title || id,
        complexity: task?.complexity || 1
      };
    });

    const edges = this.graph.edges().map((e: graphlib.Edge) => {
      const edgeData = this.graph.edge(e) as EdgeMeta | undefined;
      return {
        from: e.v,
        to: e.w,
        type: edgeData?.type || 'depends_on',
        confidence: edgeData?.confidence || 1.0
      };
    });

    return { nodes, edges };
  }
}

/**
 * Convenience function to detect dependencies between tasks
 */
export function detectImplicitDependencies(
  tasks: AITask[],
  confidenceThreshold: number = 0.5
): DetectedDependency[] {
  const graph = new DependencyGraph();
  graph.addTasks(tasks);
  return graph.detectImplicitDependencies(confidenceThreshold);
}
