import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { ResourceNotFoundError, ResourceType } from "../domain/resource-types";
import { CustomField, ProjectItem } from "../domain/types";
import { safeCall } from './utils/safeCall';
import { FieldValueService } from "./FieldValueService";
import { ProjectTemplateService } from "./ProjectTemplateService";
import { ProjectLinkingService } from "./ProjectLinkingService";

/**
 * Service for managing GitHub Projects v2 iterations (sprints/cycles).
 *
 * Handles:
 * - Getting iteration configuration (duration, start day, iterations list)
 * - Finding the current active iteration
 * - Getting items assigned to a specific iteration
 * - Finding which iteration a date falls into
 * - Assigning items to iterations
 *
 * Iterations are a built-in field type in GitHub Projects v2 that allow
 * time-boxed work management similar to sprints.
 *
 * Can be instantiated directly with a GitHubRepositoryFactory or via dependency injection.
 */
export class IterationService {
  private readonly factory: GitHubRepositoryFactory;
  private readonly fieldValueService: FieldValueService;
  private readonly templateService: ProjectTemplateService;
  private readonly linkingService: ProjectLinkingService;

  constructor(
    factory: GitHubRepositoryFactory,
    fieldValueService: FieldValueService,
    templateService: ProjectTemplateService,
    linkingService: ProjectLinkingService
  ) {
    this.factory = factory;
    this.fieldValueService = fieldValueService;
    this.templateService = templateService;
    this.linkingService = linkingService;
  }

  async getIterationConfiguration(data: {
    projectId: string;
    fieldName?: string;
  }): Promise<{
    fieldId: string;
    fieldName: string;
    duration: number;
    startDay: number;
    iterations: Array<{ id: string; title: string; startDate: string; duration: number }>;
  }> {
    return safeCall(async () => {
      const fields = await this.templateService.listProjectFields({ projectId: data.projectId });
      const iterationField = fields.find((f: CustomField) =>
        f.type === 'iteration' && (!data.fieldName || f.name === data.fieldName)
      );

      if (!iterationField) {
        throw new ResourceNotFoundError(ResourceType.FIELD, data.fieldName || 'iteration field');
      }

      if (!iterationField.config) {
        throw new Error('Invalid iteration field configuration');
      }

      return {
        fieldId: iterationField.id,
        fieldName: iterationField.name,
        duration: iterationField.config.iterationDuration || 14,
        startDay: iterationField.config.iterationStart ? new Date(iterationField.config.iterationStart).getDay() : 1,
        iterations: (iterationField.config.iterations || []).map((iter: { id: string; title: string; startDate: string; duration: number }) => ({
          id: iter.id,
          title: iter.title,
          startDate: iter.startDate,
          duration: iter.duration
        }))
      };
    });
  }

  async getCurrentIteration(data: {
    projectId: string;
    fieldName?: string;
  }): Promise<{ id: string; title: string; startDate: string; endDate: string; duration: number } | null> {
    return safeCall(async () => {
      const config = await this.getIterationConfiguration(data);
      const now = new Date();

      for (const iteration of config.iterations) {
        const start = new Date(iteration.startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + iteration.duration);

        if (now >= start && now < end) {
          return {
            id: iteration.id,
            title: iteration.title,
            startDate: iteration.startDate,
            endDate: end.toISOString(),
            duration: iteration.duration
          };
        }
      }

      return null;
    });
  }

  async getIterationItems(data: {
    projectId: string;
    iterationId: string;
    limit?: number;
  }): Promise<{ items: Array<{ id: string; title: string; type: string; status?: string }> }> {
    return safeCall(async () => {
      const items = await this.linkingService.listProjectItems({
        projectId: data.projectId,
        limit: data.limit || 50
      });

      const iterationItems = items.filter((item: ProjectItem) => {
        const fieldValues = item.fieldValues || {};
        return Object.values(fieldValues).some(v => v === data.iterationId);
      });

      return {
        items: iterationItems.map((item: ProjectItem) => ({
          id: item.id,
          title: 'Untitled',
          type: item.contentType,
          status: undefined
        }))
      };
    });
  }

  async getIterationByDate(data: {
    projectId: string;
    date: string;
    fieldName?: string;
  }): Promise<{ id: string; title: string; startDate: string; endDate: string; duration: number } | null> {
    return safeCall(async () => {
      const config = await this.getIterationConfiguration(data);
      const targetDate = new Date(data.date);

      for (const iteration of config.iterations) {
        const start = new Date(iteration.startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + iteration.duration);

        if (targetDate >= start && targetDate < end) {
          return {
            id: iteration.id,
            title: iteration.title,
            startDate: iteration.startDate,
            endDate: end.toISOString(),
            duration: iteration.duration
          };
        }
      }

      return null;
    });
  }

  async assignItemsToIteration(data: {
    projectId: string;
    itemIds: string[];
    iterationId: string;
    fieldName?: string;
  }): Promise<{ success: boolean; assignedCount: number }> {
    return safeCall(async () => {
      const fields = await this.templateService.listProjectFields({ projectId: data.projectId });
      const iterationField = fields.find((f: CustomField) =>
        f.type === 'iteration' && (!data.fieldName || f.name === data.fieldName)
      );

      if (!iterationField) {
        throw new ResourceNotFoundError(ResourceType.FIELD, data.fieldName || 'iteration field');
      }

      let assignedCount = 0;

      for (const itemId of data.itemIds) {
        try {
          await this.fieldValueService.setFieldValue({
            projectId: data.projectId,
            itemId: itemId,
            fieldId: iterationField.id,
            value: { iterationId: data.iterationId }
          });
          assignedCount++;
        } catch {
          // Continue with other items on failure
        }
      }

      return { success: assignedCount > 0, assignedCount };
    });
  }
}
