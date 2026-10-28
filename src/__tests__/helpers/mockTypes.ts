import type { GitHubRepositoryFactory } from "../../infrastructure/github/GitHubRepositoryFactory";
import type { OctokitInstance } from "../../infrastructure/github/types";

/** Shape of `GitHubRepositoryFactory.graphql` as seen by a test double. */
export type GraphqlFn = (query: string, variables?: Record<string, unknown>) => Promise<unknown>;

/** Shape of an Octokit REST endpoint call as seen by a test double. */
export type RestCallFn = (params: Record<string, unknown>) => Promise<{ data: unknown }>;

/**
 * Present a partial Octokit fake to code that requires the full client.
 * The fakes only implement the endpoints the code under test touches, so this
 * is the single place the structural gap is bridged.
 */
export function asOctokit(fake: object): OctokitInstance {
  return fake as unknown as OctokitInstance;
}

/** Present a partial repository-factory fake to a service constructor. */
export function asFactory(fake: object): GitHubRepositoryFactory {
  return fake as unknown as GitHubRepositoryFactory;
}

/** Untyped-argument async method, for fakes whose fixtures are deliberately partial. */
export type AsyncFn = (...args: unknown[]) => Promise<unknown>;
