import type { RestEndpointMethodTypes } from "@octokit/rest";
import { BaseGitHubRepository } from "./BaseRepository";

type CreateLabelParams = RestEndpointMethodTypes["issues"]["createLabel"]["parameters"];
type ListLabelsParams = RestEndpointMethodTypes["issues"]["listLabelsForRepo"]["parameters"];

/** A repository label. */
export interface RepositoryLabel {
  id: number;
  name: string;
  color: string;
  description: string;
}

/** REST access to the labels of the configured repository. */
export class GitHubLabelRepository extends BaseGitHubRepository {
  async create(data: {
    name: string;
    color?: string;
    description?: string;
  }): Promise<RepositoryLabel> {
    const label = await this.rest(
      (params: CreateLabelParams) => this.octokit.rest.issues.createLabel(params),
      {
        name: data.name,
        color: data.color?.replace("#", "") || "ededed",
        description: data.description || "",
      }
    );

    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || "",
    };
  }

  async list(limit = 100): Promise<RepositoryLabel[]> {
    const labels = await this.rest(
      (params: ListLabelsParams) => this.octokit.rest.issues.listLabelsForRepo(params),
      { per_page: limit }
    );

    return labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || "",
    }));
  }
}
