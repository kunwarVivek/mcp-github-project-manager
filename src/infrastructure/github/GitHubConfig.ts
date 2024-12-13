export class GitHubConfig {
  constructor(
    public readonly owner: string,
    public readonly repo: string,
    public readonly token: string
  ) {}
}
