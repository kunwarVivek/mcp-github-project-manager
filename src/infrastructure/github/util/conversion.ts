import { ResourceStatus, ResourceType } from "../../../domain/resource-types";

export class GitHubTypeConverter {
  static toResourceType(githubType: string): ResourceType {
    switch (githubType.toLowerCase()) {
      case 'issue':
        return ResourceType.ISSUE;
      case 'milestone':
        return ResourceType.MILESTONE;
      case 'project':
        return ResourceType.PROJECT;
      case 'sprint':
        return ResourceType.SPRINT;
      default:
        throw new Error(`Invalid GitHub type: ${githubType}`);
    }
  }

  static toGitHubType(type: ResourceType): string {
    switch (type) {
      case ResourceType.ISSUE:
        return 'issue';
      case ResourceType.MILESTONE:
        return 'milestone';
      case ResourceType.PROJECT:
        return 'project';
      case ResourceType.SPRINT:
        return 'sprint';
      default:
        throw new Error(`Invalid resource type: ${type}`);
    }
  }

  static toResourceStatus(githubStatus: string): ResourceStatus {
    switch (githubStatus.toLowerCase()) {
      case 'open':
        return ResourceStatus.ACTIVE;
      case 'closed':
        return ResourceStatus.CLOSED;
      case 'planned':
        return ResourceStatus.PLANNED;
      case 'in_progress':
        return ResourceStatus.ACTIVE;
      case 'completed':
        return ResourceStatus.COMPLETED;
      case 'archived':
        return ResourceStatus.ARCHIVED;
      case 'deleted':
        return ResourceStatus.DELETED;
      default:
        throw new Error(`Invalid GitHub status: ${githubStatus}`);
    }
  }

  static toGitHubStatus(status: ResourceStatus): string {
    switch (status) {
      case ResourceStatus.ACTIVE:
        return 'open';
      case ResourceStatus.CLOSED:
      case ResourceStatus.COMPLETED:
        return 'closed';
      case ResourceStatus.PLANNED:
        return 'draft';
      case ResourceStatus.ARCHIVED:
        return 'archived';
      case ResourceStatus.DELETED:
        return 'closed';
      default:
        throw new Error(`Invalid resource status: ${status}`);
    }
  }

  static toISOString(date: string | Date | undefined | null): string | undefined {
    if (!date) return undefined;
    return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
  }

  static parseDate(dateString: string | null | undefined): Date | undefined {
    if (!dateString) return undefined;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? undefined : date;
  }

  static formatDuration(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7)); // weeks
  }

  static addDuration(startDate: Date, durationWeeks: number): Date {
    const result = new Date(startDate);
    result.setDate(result.getDate() + (durationWeeks * 7));
    return result;
  }
}