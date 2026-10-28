# Development Workflow

This document outlines the development workflow for contributing to the GitHub Project Manager MCP Server.

## Development Lifecycle

The development workflow follows these steps:

1. **Issue Creation**: All work starts with an issue in **beads** (`bd`)
2. **Branch Creation**: Create a branch for your work
3. **Development**: Make your changes
4. **Testing**: Write and run tests
5. **Pull Request**: Submit your changes for review
6. **Review**: Address feedback
7. **Merge**: Changes are merged
8. **Release**: Changes are included in a release

## Issue Workflow

### Creating Issues

Working issues live in **beads** (`bd`), a local Dolt-backed tracker — not in
GitHub Issues. See [docs/agents/issue-tracker.md](../agents/issue-tracker.md)
for the full conventions, and
[ADR-002](../adr/002-beads-as-working-tracker.md) for the rationale.

Before starting work, ensure there is an issue describing what you are working
on:

1. Check if one already exists — `bd search "<query>"` or `bd list --status=open`
2. If not, create one:
   ```bash
   bd create --title="..." --description="..." --type=task --priority=2 \
             [--parent=<epic-id>] [--labels=needs-triage]
   ```
3. Claim it before you start: `bd update <id> --claim`
4. Close it when done: `bd close <id> --reason="..."`

Issue ids look like `mcp-github-project-manager-hb8.15` — always pass the full
id. Priority is `0`–`4` or `P0`–`P4` (`0` = critical, `2` = medium,
`4` = backlog); `high`/`medium`/`low` are rejected.

> GitHub Issues on this repository still holds externally reported bugs. That is
> a *reporting* surface for users; beads is the *working* tracker. Do not mirror
> between them automatically.

### Triage Labels

Triage state is carried on labels:

| Label | Meaning |
|-------|---------|
| `needs-triage` | Maintainer needs to evaluate this issue |
| `needs-info` | Waiting on the reporter for more information |
| `ready-for-agent` | Fully specified, ready for an AFK agent |
| `ready-for-human` | Requires human implementation |
| `wontfix` | Will not be actioned |

Set them at creation with `--labels`, or later with `bd update <id> --add-label=...`.

### Issue Assignment

- Claim an issue before working on it (`bd update <id> --claim`)
- Don't start work on an issue that is already claimed
- `bd ready` lists issues with no unresolved blockers — that is the frontier

## Branch Workflow

### Branch Naming

Use the following naming convention for branches:

- `feature/issue-number-short-description` for new features
- `fix/issue-number-short-description` for bug fixes
- `docs/issue-number-short-description` for documentation
- `refactor/issue-number-short-description` for refactoring
- `test/issue-number-short-description` for test improvements

Example: `feature/123-add-sprint-metrics`

### Creating a Branch

```bash
# Ensure you're on the main branch
git checkout main

# Pull the latest changes
git pull upstream main

# Create a new branch
git checkout -b feature/123-add-sprint-metrics
```

### Keeping Your Branch Updated

```bash
# Fetch the latest changes from upstream
git fetch upstream

# Rebase your branch on the latest main
git rebase upstream/main

# If there are conflicts, resolve them and continue
git rebase --continue

# Push your updated branch (force push if you've rebased)
git push origin feature/123-add-sprint-metrics --force
```

## Development Process

### Local Development

1. Make your changes following the [coding standards](./index.md#coding-standards)
2. Run the server locally to test your changes:
   ```bash
   npm run dev
   ```
3. Use the examples in the `examples/` directory to test your changes
4. Run the full quality gate before opening a PR:
   ```bash
   npm run build
   npm run typecheck
   npm run lint
   npm test
   ```

### Committing Changes

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Changes that don't affect the code's meaning (formatting, etc.)
- `refactor`: Code changes that neither fix a bug nor add a feature
- `perf`: Performance improvements
- `test`: Adding or correcting tests
- `chore`: Changes to the build process or auxiliary tools

Examples:
```
feat(sprint): add sprint metrics calculation
fix(milestone): resolve issue with milestone due date formatting
docs(api): update API reference for create_roadmap tool
```

### Pull Request Process

1. Push your branch to your fork:
   ```bash
   git push origin feature/123-add-sprint-metrics
   ```

2. Create a pull request from your fork to the original repository:
   - Go to the original repository
   - Click "Pull Requests" > "New Pull Request"
   - Select "compare across forks"
   - Select your fork and branch
   - Click "Create Pull Request"

3. Fill in the pull request template:
   - Reference the issue number
   - Describe the changes
   - List any dependencies
   - Mention any breaking changes

4. Wait for the CI checks to complete

5. Request a review from a maintainer

### Addressing Review Feedback

1. Make the requested changes
2. Push the changes to your branch
3. Respond to the review comments
4. Request a re-review if needed

### Merging

Once your pull request is approved:

1. A maintainer will merge your pull request
2. The branch will be deleted automatically
3. The issue will be closed automatically (if you used "Fixes #123" in your PR description)

## Testing Workflow

### Running Tests

The test runner is **Vitest 5** (there is no Jest in this project). Every
script works with both `npm` and `pnpm`.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

### Writing Tests

1. Create test files under `src/__tests__/` with a `.test.ts` suffix
2. Use Vitest's `describe`/`it` syntax
3. Mock external dependencies
4. Test both success and error cases

Two mocking traps bite regularly:

- A mock that the code under test calls with `new` must be a `function`, not an
  arrow — `mockImplementation(() => ({}))` fails with "is not a constructor".
- A `beforeEach(() => x.mockReset())` with an *implicit* return hands the mock
  back to Vitest, which treats a returned function as a teardown callback and
  calls it. Always use a block body.

Example:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectManagementService } from '../../services/ProjectManagementService';

describe('ProjectManagementService', () => {
  let service: ProjectManagementService;

  beforeEach(() => {
    service = new ProjectManagementService(/* ... */);
  });

  describe('createProject', () => {
    it('should create a project successfully', async () => {
      // Test implementation
    });

    it('should throw validation error for invalid data', async () => {
      // Test implementation
    });
  });
});
```

## Release Process

Releases are managed by the maintainers through GitHub Actions — nothing
publishes to npm outside CI.

1. **Bump Version** workflow bumps `package.json` + `package-lock.json`, moves
   the `[Unreleased]` CHANGELOG body into the new version section, commits,
   tags `vX.Y.Z`, pushes, and dispatches the **Release** workflow on the tag.
2. **Release** verifies the tag matches `package.json` and that CHANGELOG has
   the version's section, builds, typechecks, tests, publishes to npm through
   Trusted Publishing (OIDC — no npm token; provenance attached) and creates
   the GitHub release, so npm and GitHub always carry the same version.

A tag you push yourself (`git push origin vX.Y.Z`) triggers the same workflow.

To release from your machine — one command that ends with both npm and the
GitHub release live and verified:

```bash
npm run release      # or: npm run release -- patch|minor|major|X.Y.Z [--yes]
```

It pushes the release commit and tag, then waits for the Release workflow and
checks both results. Do **not** run `npm publish` yourself, and do not name a
script `publish` (npm runs it during `npm publish`, i.e. inside the workflow).

## Continuous Integration

The project uses GitHub Actions for CI (`.github/workflows/ci.yml`):

- **Build** — ensures the project builds successfully
- **Typecheck** — type-checks src + examples, then src + tests
- **Test** — runs the Vitest suite
- **Lint** — runs Biome

The build/typecheck/test job runs on a matrix of **Node 22.x and 24.x** under
**both npm and pnpm**. The lint job runs once on Node 24 with pnpm.

All CI checks must pass before a pull request can be merged.

## Code Traversal and Audits — GitNexus

The repository is indexed by **GitNexus**, which gives a call-graph view of the
code for questions grep cannot answer.

```bash
# Refresh the index
node .gitnexus/run.cjs analyze --index-only
```

Skills live under `.agents/skills/gitnexus-*/SKILL.md`:

| Skill | Use it for |
|---|---|
| `gitnexus-exploring` | "How does X work?" — architecture and execution flow |
| `gitnexus-impact-analysis` | "What breaks if I change X?" — blast radius before editing |
| `gitnexus-debugging` | "Why is X failing?" — trace an error to its source |
| `gitnexus-refactoring` | rename, extract, split, move — safely |
| `gitnexus-guide` | the tool and graph schema reference |
| `gitnexus-cli` | index / status / wiki commands |

Two rules matter before you commit:

1. **Run impact analysis before editing a symbol.** An empty caller set is
   *not* proof a symbol is unused — confirm with a text search before deleting
   or renaming anything.
2. **Analyse graph changes before committing.** A zero result with
   `partial: true` or `truncated: true` means "not seen", not "unaffected".

## Development Tools

### Recommended VS Code Extensions

- Biome (`biomejs.biome`)
- Vitest (`ZixuanChen.vitest-explorer`)
- TypeScript Hero
- GitLens

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.biome": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "vitest.commandLine": "npm",
  "vitest.enable": true
}
```

## Troubleshooting

### Common Issues

#### Build Errors

```
Error: Cannot find module './build/index.js'
```

Solution: Run `npm run build` to compile the TypeScript code.

#### Test Failures

```
Error: Cannot find module '@modelcontextprotocol/server'
```

Solution: Run `npm install` to ensure all dependencies are installed.

#### TypeScript Errors

```
Error: Property 'X' does not exist on type 'Y'
```

Solution: Check the type definitions and ensure you're using the correct properties.

#### Vitest Rejects a Flag

```
CACError: Unknown option '--testPathPattern'
```

Solution: Vitest does not accept Jest-only flags. Filter with a positional
pattern (`npm test -- unit`) and exclude with `--exclude='**/tests/x/**'`.

## Getting Help

If you encounter any issues with the development workflow:

1. Check the documentation
2. Ask in the issue you're working on
3. Create a new issue with the `question` label

Happy coding!
