export interface GraphQLResponse<T> {
  data: T;
}

export interface ProjectV2Node {
  id: string;
  number: number;
  title: string;
  description: string;
  url: string;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectV2Response {
  createProjectV2: {
    projectV2: ProjectV2Node;
  };
}

export interface UpdateProjectV2Response {
  updateProjectV2: {
    projectV2: ProjectV2Node;
  };
}

export interface GetProjectV2Response {
  repository: {
    projectV2: ProjectV2Node;
  };
}

export interface ListProjectsV2Response {
  repository: {
    projectsV2: {
      nodes: ProjectV2Node[];
    };
  };
}

export interface CreateFieldResponse {
  createProjectV2Field: {
    projectV2Field: {
      id: string;
      name: string;
    };
  };
}

export interface IterationNode {
  id: string;
  title: string;
  startDate: string;
  duration: number;
  items?: {
    nodes: Array<{
      content: {
        number: number;
      };
    }>;
  };
}

export interface CreateIterationResponse {
  createProjectV2IterationFieldIteration: {
    iteration: IterationNode;
  };
}

export interface UpdateIterationResponse {
  updateProjectV2IterationFieldIteration: {
    iteration: IterationNode;
  };
}

export interface GetIterationResponse {
  node: IterationNode;
}

export interface ListIterationsResponse {
  node: {
    iterations: {
      nodes: IterationNode[];
    };
  };
}
