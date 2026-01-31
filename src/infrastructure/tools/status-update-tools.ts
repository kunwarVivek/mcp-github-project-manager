/**
 * MCP tools for managing GitHub Project V2 status updates.
 *
 * Provides 3 tools:
 * - create_status_update (GHAPI-06): Create a new project status update
 * - list_status_updates (GHAPI-07): List status updates with pagination
 * - get_status_update (GHAPI-08): Get a single status update by ID
 */

import { z } from "zod";
import { ToolDefinition, ToolSchema } from "./ToolValidator.js";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations.js";
import { GitHubRepositoryFactory } from "../github/GitHubRepositoryFactory.js";
import {
  CreateStatusUpdateInputSchema,
  CreateStatusUpdateInput,
  ListStatusUpdatesInputSchema,
  ListStatusUpdatesInput,
  GetStatusUpdateInputSchema,
  GetStatusUpdateInput,
  StatusUpdateOutputSchema,
  StatusUpdateOutput,
  StatusUpdateListOutputSchema,
  StatusUpdateListOutput,
} from "./schemas/status-update-schemas.js";
import { StatusUpdateStatus } from "../github/repositories/types.js";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a GitHubRepositoryFactory from environment variables.
 *
 * Status updates operate at the project level (via projectId), so owner/repo
 * are only needed for factory initialization. We use defaults since status
 * update operations don't actually require a specific repo context.
 */
function createRepositoryFactory(): GitHubRepositoryFactory {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  // Owner/repo are required by factory but not used for status update operations
  // which work purely with project node IDs
  const owner = process.env.GITHUB_OWNER || "placeholder";
  const repo = process.env.GITHUB_REPO || "placeholder";

  return new GitHubRepositoryFactory(token, owner, repo);
}

/**
 * Convert status string to StatusUpdateStatus enum value.
 */
function toStatusEnum(status?: string): StatusUpdateStatus | undefined {
  if (!status) return undefined;
  return StatusUpdateStatus[status as keyof typeof StatusUpdateStatus];
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * create_status_update MCP tool (GHAPI-06)
 *
 * Creates a new status update for a GitHub project. Status updates allow
 * project managers to communicate project progress with optional status
 * indicators (ON_TRACK, AT_RISK, OFF_TRACK, COMPLETE, INACTIVE).
 */
export const createStatusUpdateTool: ToolDefinition<CreateStatusUpdateInput, StatusUpdateOutput> = {
  name: "create_status_update",
  title: "Create Status Update",
  description: "Create a new status update for a GitHub project. Status updates communicate project progress and can include a status indicator (ON_TRACK, AT_RISK, OFF_TRACK, COMPLETE, INACTIVE), start date, and target date.",
  schema: CreateStatusUpdateInputSchema as unknown as ToolSchema<CreateStatusUpdateInput>,
  outputSchema: StatusUpdateOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
  examples: [
    {
      name: "Create status update with ON_TRACK status",
      description: "Create a status update indicating the project is on track",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        body: "Sprint 3 is progressing well. All P0 features are complete, P1 items are in progress.",
        status: "ON_TRACK",
        startDate: "2025-01-15",
        targetDate: "2025-02-15",
      },
    },
    {
      name: "Create simple status update",
      description: "Create a status update with just a message",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        body: "Weekly sync: Team addressed 3 blockers, velocity is improving.",
      },
    },
  ],
};

/**
 * list_status_updates MCP tool (GHAPI-07)
 *
 * Lists status updates for a GitHub project with pagination support.
 * Status updates are returned in descending order by creation date.
 */
export const listStatusUpdatesTool: ToolDefinition<ListStatusUpdatesInput, StatusUpdateListOutput> = {
  name: "list_status_updates",
  title: "List Status Updates",
  description: "List status updates for a GitHub project with pagination support. Returns status updates in descending order by creation date.",
  schema: ListStatusUpdatesInputSchema as unknown as ToolSchema<ListStatusUpdatesInput>,
  outputSchema: StatusUpdateListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "List first 10 status updates",
      description: "Get the most recent status updates for a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        first: 10,
      },
    },
    {
      name: "Paginate status updates",
      description: "Get the next page of status updates using a cursor",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        first: 10,
        after: "Y3Vyc29yOnYyOpK5MjAyNS0wMS0xNVQxMDowMDowMFo=",
      },
    },
  ],
};

/**
 * get_status_update MCP tool (GHAPI-08)
 *
 * Retrieves a single status update by its node ID. Returns null if the
 * status update is not found.
 */
export const getStatusUpdateTool: ToolDefinition<GetStatusUpdateInput, StatusUpdateOutput | null> = {
  name: "get_status_update",
  title: "Get Status Update",
  description: "Get a single status update by its node ID. Returns null if the status update is not found.",
  schema: GetStatusUpdateInputSchema as unknown as ToolSchema<GetStatusUpdateInput>,
  outputSchema: StatusUpdateOutputSchema.nullable(),
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get status update by ID",
      description: "Retrieve a specific status update",
      args: {
        statusUpdateId: "PVTSU_lADOLhQ7gc4AOEbHzM4AOrKa",
      },
    },
  ],
};

// ============================================================================
// Executor Functions
// ============================================================================

/**
 * Execute the create_status_update tool.
 *
 * Creates a new status update for a GitHub project via the GraphQL API.
 *
 * @param args - Validated input arguments
 * @returns The created status update
 * @throws Error if GITHUB_TOKEN is not set or API call fails
 */
export async function executeCreateStatusUpdate(
  args: CreateStatusUpdateInput
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: StatusUpdateOutput }> {
  const factory = createRepositoryFactory();
  const repository = factory.createStatusUpdateRepository();

  const statusUpdate = await repository.createStatusUpdate(
    args.projectId,
    args.body,
    {
      status: toStatusEnum(args.status),
      startDate: args.startDate,
      targetDate: args.targetDate,
    }
  );

  // Map to output format
  const result: StatusUpdateOutput = {
    id: statusUpdate.id,
    body: statusUpdate.body,
    bodyHTML: statusUpdate.bodyHTML,
    status: statusUpdate.status,
    startDate: statusUpdate.startDate ?? null,
    targetDate: statusUpdate.targetDate ?? null,
    createdAt: statusUpdate.createdAt,
    creator: {
      login: statusUpdate.creator.login,
    },
  };

  return {
    content: [
      {
        type: "text",
        text: `Created status update ${result.id} for project ${args.projectId}`,
      },
    ],
    structuredContent: result,
  };
}

/**
 * Execute the list_status_updates tool.
 *
 * Lists status updates for a GitHub project with pagination support.
 *
 * @param args - Validated input arguments
 * @returns Paginated list of status updates
 * @throws Error if GITHUB_TOKEN is not set or API call fails
 */
export async function executeListStatusUpdates(
  args: ListStatusUpdatesInput
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: StatusUpdateListOutput }> {
  const factory = createRepositoryFactory();
  const repository = factory.createStatusUpdateRepository();

  const listResult = await repository.listStatusUpdates(
    args.projectId,
    args.first ?? 10,
    args.after
  );

  // Map to output format
  const result: StatusUpdateListOutput = {
    statusUpdates: listResult.statusUpdates.map((su) => ({
      id: su.id,
      body: su.body,
      bodyHTML: su.bodyHTML,
      status: su.status,
      startDate: su.startDate ?? null,
      targetDate: su.targetDate ?? null,
      createdAt: su.createdAt,
      creator: {
        login: su.creator.login,
      },
    })),
    pageInfo: {
      hasNextPage: listResult.pageInfo.hasNextPage,
      endCursor: listResult.pageInfo.endCursor ?? null,
    },
    totalCount: listResult.totalCount,
  };

  return {
    content: [
      {
        type: "text",
        text: `Found ${result.totalCount} status updates for project ${args.projectId}, returning ${result.statusUpdates.length}`,
      },
    ],
    structuredContent: result,
  };
}

/**
 * Execute the get_status_update tool.
 *
 * Retrieves a single status update by its node ID.
 *
 * @param args - Validated input arguments
 * @returns The status update or null if not found
 * @throws Error if GITHUB_TOKEN is not set or API call fails
 */
export async function executeGetStatusUpdate(
  args: GetStatusUpdateInput
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: StatusUpdateOutput | null }> {
  const factory = createRepositoryFactory();
  const repository = factory.createStatusUpdateRepository();

  const statusUpdate = await repository.getStatusUpdate(args.statusUpdateId);

  if (!statusUpdate) {
    return {
      content: [
        {
          type: "text",
          text: `Status update ${args.statusUpdateId} not found`,
        },
      ],
      structuredContent: null,
    };
  }

  // Map to output format
  const result: StatusUpdateOutput = {
    id: statusUpdate.id,
    body: statusUpdate.body,
    bodyHTML: statusUpdate.bodyHTML,
    status: statusUpdate.status,
    startDate: statusUpdate.startDate ?? null,
    targetDate: statusUpdate.targetDate ?? null,
    createdAt: statusUpdate.createdAt,
    creator: {
      login: statusUpdate.creator.login,
    },
  };

  return {
    content: [
      {
        type: "text",
        text: `Retrieved status update ${result.id}`,
      },
    ],
    structuredContent: result,
  };
}
