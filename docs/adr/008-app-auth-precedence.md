# ADR-008: GitHub App authentication outranks the PAT (`resolveGitHubAuth` + `fromAuth`)

**Status:** Accepted
**Date:** 2026-11-02
**Deciders:** Vivek

## Context

A personal access token acts as a person, carries broad scope and expires with that person's account. A GitHub App installation token is scoped to the installation's permissions and is the right identity for a long-running agent platform. Credentials were also read in several places (`process.env.GITHUB_TOKEN` directly in some tool modules), which silently bypassed `--token`, `SECRETS_DIR` and the `gh` fallback.

## Decision

- Credentials come only from `resolveGitHubAuth()` (`infrastructure/github/auth/resolveGitHubAuth.ts`), which returns a `GitHubAuth` (`mode`, `source`, `octokitAuth()`, `getToken()`). A **complete** App configuration (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`) wins; otherwise the token chain applies (`--token` → `$SECRETS_DIR/GITHUB_TOKEN` → `GITHUB_TOKEN` → stored OAuth token from `auth login` → `gh auth token`).
- A **partial** App configuration falls through to the next tier rather than failing, so a half-set environment cannot lock the server out. `GITHUB_TOKEN` is never required: boot fails only when every tier is empty, and the error lists them all.
- Repositories are built only through `GitHubRepositoryFactory.fromAuth(auth, owner, repo)`; `configureContainer(auth, owner, repo)` and `createGitHubFactory()` both use it (ADR-006).
- Every credential read goes through `getSecret()` and the `GitHubAuth` seam; nothing reads `process.env.GITHUB_TOKEN` directly.
- All GitHub traffic then flows through one `GitHubRequestExecutor`, so the chosen identity shares one retry and rate-limit budget.

## Consequences

### Positive
- App-only deployments need no PAT; the identity is the least-privilege one whenever it is configured.
- One resolver means `SECRETS_DIR`, `--token` and the `gh` fallback behave identically everywhere.

### Negative
- A mistyped App variable falls back to the PAT silently (by design); operators must check which identity is active.

### Trade-offs
- Fail-soft on partial App config was chosen over fail-fast: availability over strictness, with the documented precedence making the behavior predictable.
