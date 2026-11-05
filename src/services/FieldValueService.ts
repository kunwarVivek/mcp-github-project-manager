import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubFieldValueRepository } from "../infrastructure/github/repositories/GitHubFieldValueRepository";
import { safeCall } from "./utils/safeCall";

/**
 * Service for managing GitHub Projects v2 custom field values.
 *
 * Handles:
 * - Setting field values (text, number, date, single select, multi select, iteration)
 * - Getting field values for project items
 * - Clearing field values
 *
 * Uses GraphQL mutations to interact with the GitHub Projects v2 API.
 * Supports field types: TEXT, NUMBER, DATE, SINGLE_SELECT, MULTI_SELECT, ITERATION.
 *
 * Can be instantiated directly with a GitHubRepositoryFactory or via dependency injection.
 */
export class FieldValueService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  private get fieldValueRepo(): GitHubFieldValueRepository {
    return this.factory.createFieldValueRepository();
  }

  async setFieldValue(data: {
    projectId: string;
    itemId: string;
    fieldId: string;
    value: unknown;
  }): Promise<{ success: boolean; message: string }> {
    return safeCall(async () => {
      const fieldName = await this.fieldValueRepo.setValue(data);
      return { success: true, message: `Field ${fieldName} updated successfully` };
    });
  }

  async getFieldValue(data: {
    projectId: string;
    itemId: string;
    fieldId: string;
  }): Promise<{ fieldId: string; fieldName: string; value: unknown; type: string }> {
    return safeCall(async () => this.fieldValueRepo.getValue(data));
  }

  async clearFieldValue(data: {
    projectId: string;
    itemId: string;
    fieldId: string;
  }): Promise<{ success: boolean; message: string }> {
    return safeCall(async () => {
      await this.fieldValueRepo.clearValue(data);
      return { success: true, message: `Field ${data.fieldId} cleared successfully` };
    });
  }
}
