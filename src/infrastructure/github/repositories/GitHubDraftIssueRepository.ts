import { BaseGitHubRepository } from "./BaseRepository";

const ADD_DRAFT_ISSUE_MUTATION = `
  mutation($input: AddProjectV2DraftIssueInput!) {
    addProjectV2DraftIssue(input: $input) {
      projectV2Item {
        id
        content {
          ... on DraftIssue {
            id
            title
            body
          }
        }
      }
    }
  }
`;

const UPDATE_DRAFT_ISSUE_MUTATION = `
  mutation($input: UpdateProjectV2DraftIssueInput!) {
    updateProjectV2DraftIssue(input: $input) {
      draftIssue {
        id
        title
        body
      }
    }
  }
`;

const DELETE_DRAFT_ISSUE_MUTATION = `
  mutation($input: DeleteProjectV2DraftIssueInput!) {
    deleteProjectV2DraftIssue(input: $input) {
      draftIssue { id }
    }
  }
`;

/** A GitHub Projects v2 draft issue. */
export interface DraftIssue {
  id: string;
  title: string;
  body: string;
}

interface AddDraftIssueResponse {
  addProjectV2DraftIssue: {
    projectV2Item: {
      id: string;
      content: DraftIssue;
    };
  };
}

interface UpdateDraftIssueResponse {
  updateProjectV2DraftIssue: {
    draftIssue: DraftIssue;
  };
}

/** GraphQL access to Projects v2 draft issues. */
export class GitHubDraftIssueRepository extends BaseGitHubRepository {
  async create(data: {
    projectId: string;
    title: string;
    body?: string;
    assigneeIds?: string[];
  }): Promise<DraftIssue> {
    const response = await this.graphql<AddDraftIssueResponse>(ADD_DRAFT_ISSUE_MUTATION, {
      input: {
        projectId: data.projectId,
        title: data.title,
        body: data.body || "",
        assigneeIds: data.assigneeIds || [],
      },
    });

    const content = response.addProjectV2DraftIssue.projectV2Item.content;
    return { id: content.id, title: content.title, body: content.body };
  }

  async update(data: {
    draftIssueId: string;
    title?: string;
    body?: string;
    assigneeIds?: string[];
  }): Promise<DraftIssue> {
    const input: Record<string, unknown> = { draftIssueId: data.draftIssueId };
    if (data.title !== undefined) input.title = data.title;
    if (data.body !== undefined) input.body = data.body;
    if (data.assigneeIds !== undefined) input.assigneeIds = data.assigneeIds;

    const response = await this.graphql<UpdateDraftIssueResponse>(UPDATE_DRAFT_ISSUE_MUTATION, {
      input,
    });
    const draftIssue = response.updateProjectV2DraftIssue.draftIssue;
    return { id: draftIssue.id, title: draftIssue.title, body: draftIssue.body };
  }

  async delete(draftIssueId: string): Promise<void> {
    await this.graphql(DELETE_DRAFT_ISSUE_MUTATION, { input: { draftIssueId } });
  }
}
