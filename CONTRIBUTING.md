# Contributing to GitHub Project Manager MCP

First off, thank you for considering contributing to GitHub Project Manager MCP! It's people like you that make it a great tool for everyone.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to project maintainers.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* Use a clear and descriptive title
* Describe the exact steps which reproduce the problem
* Provide specific examples to demonstrate the steps
* Describe the behavior you observed after following the steps
* Explain which behavior you expected to see instead and why
* Include any error messages or logs

### Suggesting Enhancements

If you have a suggestion for a new feature or enhancement:

* Use a clear and descriptive title
* Provide a step-by-step description of the suggested enhancement
* Provide specific examples to demonstrate the steps
* Describe the current behavior and explain which behavior you expected to see instead
* Explain why this enhancement would be useful

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Follow the TypeScript styleguide
* Include thoughtfully-worded, well-structured tests
* Document new code
* End all files with a newline

## Development Process

1. Fork the repo
2. Create a new branch from `main`
3. Claim or open a working issue in beads (`bd`) — see [Task Management](#task-management--bd-beads)
4. Make your changes
5. Run the full quality gate (build → typecheck → lint → test)
6. Push to your fork and submit a pull request

### Setup Development Environment

```bash
# Clone your fork
git clone https://github.com/your-username/mcp-github-project-manager.git

# Install dependencies (npm or pnpm — both supported)
npm install        # or: pnpm install

# Build the project
npm run build      # or: pnpm run build

# Run tests
npm test           # or: pnpm test
```

### Package manager

**Use whichever you already have** — the project supports both, and every
script in `package.json` is package-manager agnostic.

| | npm | pnpm |
|---|---|---|
| Install | `npm install` | `pnpm install` |
| Reproducible install | `npm ci` | `pnpm install --frozen-lockfile` |
| Run a script | `npm run <script>` | `pnpm run <script>` |
| Lockfile | `package-lock.json` | `pnpm-lock.yaml` |

Both lockfiles are committed and must stay in sync. When you change
dependencies, update both:

```bash
npm install --package-lock-only   # refresh package-lock.json
pnpm import                       # regenerate pnpm-lock.yaml from it
```

Requirements: **Node 24** (the supported target — see `.node-version`; the
floor is 22.12) and pnpm **>= 10** if you use pnpm. The package manager is
deliberately *not* pinned in `package.json`, so nobody is forced onto a
particular version.

### The Quality Gate

Every change must pass the full gate, in this order:

```bash
npm run build        # tsc → postbuild (fix .js extensions) → chmod
npm run typecheck    # src + examples, then src + tests
npm run lint         # Biome; must exit 0
npm test             # Vitest 5
```

CI runs the same gate on **Node 22.x and 24.x under both npm and pnpm**. The
npm/pnpm matrix is deliberate: it is what catches a dependency that only
resolves under one of them (for example a package imported directly that is
only present as a hoisted transitive under npm).

Toolchain notes:

- **TypeScript 7** with `isolatedModules: true`. A type re-exported as a value
  is an error — use `export type` / `import type`, including for decorated
  constructor parameters.
- **Vitest 5**, not Jest. Vitest rejects Jest-only CLI flags
  (`--testPathPattern`) with `CACError: Unknown option`; filter with a
  positional pattern (`npm test -- unit`) and exclude with
  `--exclude='**/tests/x/**'`.
- **Biome 2.5** for lint *and* format — there is no ESLint and no Prettier in
  this project. `npm run format` writes changes; `npm run lint` checks.
- Source imports omit the `.js` extension; the `postbuild` script adds it.
  Never ship raw `tsc` output — always `npm run build`.

### Task Management — `bd` (beads)

Task tracking for this repo lives in **beads**, a local Dolt-backed issue
database driven by the `bd` CLI — not in GitHub Issues and not in a markdown
TODO list.

```bash
bd ready                     # issues with no unresolved blockers
bd show <id>                 # full detail, including dependencies
bd update <id> --claim       # claim the work
bd close <id>                # complete it
```

Issue ids look like `mcp-github-project-manager-hb8.15`. The tracker lives in a
local Dolt DB; `.beads/issues.jsonl` is a passive export, not the source of
truth. Do not push or sync without explicit instruction.

See [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) for the full
conventions, and [ADR-002](docs/adr/002-beads-as-working-tracker.md) for why
beads is the working tracker while GitHub Issues stays the external reporting
surface.

### Code Traversal and Audits — GitNexus

This repository is indexed by **GitNexus**, which gives a call-graph view of
the code for questions grep cannot answer.

```bash
# Refresh the index after structural changes
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
2. **Analyze graph changes before committing.** A zero result with
   `partial: true` or `truncated: true` means "not seen", not "unaffected".

### Releasing

The GitHub Actions workflows are the single publisher — nothing publishes to
npm outside CI, so a version can never be published twice.

**Bump the version from GitHub (recommended)**

1. Go to **Actions → Bump Version → Run workflow**
2. Choose `patch` / `minor` / `major`
3. The workflow bumps `package.json` + `package-lock.json`, moves the
   `[Unreleased]` CHANGELOG body into the new version section, commits, tags
   `vX.Y.Z` and pushes
4. Pushing the tag triggers the **Release** workflow, which verifies the tag
   matches `package.json`, builds, typechecks, tests, publishes to npm
   (with provenance) and creates the GitHub release

**Bump the version locally**

```bash
npm run release      # or: pnpm run release
```

Runs the tests, asks for `patch`/`minor`/`major`, bumps the version, builds,
commits, tags and pushes. The pushed tag then triggers the same **Release**
workflow — do **not** run `npm publish` yourself, the workflow does it (and
skips publishing if that version is already on the registry).

**Build only**

```bash
npm run build        # tsc → postbuild (fix .js extensions) → chmod
npm run typecheck    # src + examples, then src + tests
npm run lint         # Biome; must exit 0
npm test             # Vitest
```

### Styleguides

#### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

#### TypeScript Styleguide

* Use 2 spaces for indentation
* Use camelCase for variables and functions
* Use PascalCase for classes and interfaces
* Use meaningful variable names
* Add types for all function parameters and return values
* Document public APIs using JSDoc comments

#### Documentation Styleguide

* Use [Markdown](https://guides.github.com/features/mastering-markdown/)
* Reference functions and classes in backticks: \`functionName()\`
* Include code examples when relevant
* Keep documentation up to date with code changes

## Project Structure

```
src/
  domain/          — Types, schemas, interfaces, entities, domain events
  services/        — Business logic
    agent/         — Agent orchestration services
    ai/            — AI provider services
    context/       — Context generation
    feature/       — Feature lifecycle services
    templates/     — Template engine
    utils/         — Shared utilities
    validation/    — Context quality validation
  infrastructure/  — External integrations
    agent/         — Agent registry stores
    cache/         — Caching layer
    events/        — Webhooks + event store
    github/        — GitHub API repositories
    health/        — Health checks
    http/          — Webhook HTTP server
    lifecycle/     — Graceful shutdown
    logger/        — Structured logging
    mcp/           — MCP resources, prompts, response/error shaping
    observability/ — Correlation context, tracing, audit log
    persistence/   — File-backed persistence
    resilience/    — Circuit breaker, AI resilience policy
    resource/      — Resource manager + optimistic locking
    secrets/       — Layered secret resolution
    tools/         — MCP tool definitions
      compound/    — The 20 public compound tool schemas + executors
      schemas/     — Domain-specific granular schemas
    validation/    — Validation rule engine
  container.ts     — DI configuration (tsyringe)
  index.ts         — MCP server entry point
  env.ts           — Configuration + secret resolution + startup validation
  cli.ts           — Command-line flag parsing
tests/             — Legacy test tree (still in the Vitest include list)
src/__tests__/     — Current test tree
docs/              — Documentation
```

### Architecture Notes

- **Dependency Injection**: Uses `tsyringe` for IoC. `container.ts` registers the repository factory, services, and infrastructure.
- **Compound Tool API**: 20 compound tools (169 actions) are what MCP clients see. Each compound tool has a schema definition and a `CompoundExecutor` that routes `action` values to internal granular executors. See [docs/TOOLS.md](docs/TOOLS.md).
- **MCP v2**: the server runs on `@modelcontextprotocol/server` v2. Arguments are validated against the declared `inputSchema` before the handler runs, and a tool that runs and fails returns `{ content, isError: true }` — JSON-RPC errors are reserved for protocol faults. See [ADR-003](docs/adr/003-mcp-sdk-v2-migration.md).
- **Test Structure**: Tests live in `src/__tests__/` (unit, integration, E2E) and in a legacy root `tests/` tree. `npm test` runs everything; `npm run test:e2e:tools` runs the tool-level E2E suites.

## Testing

* Write tests for all new features and bug fixes
* Run the full quality gate (build → typecheck → lint → test) before submitting a PR
* Follow the existing testing patterns and conventions
* Include both positive and negative test cases
* New test files go under `src/__tests__/` with a `.test.ts` suffix; the root `tests/` tree is legacy

See [docs/TESTING.md](docs/TESTING.md) for the suite layout and
[docs/testing-guide.md](docs/testing-guide.md) for AI-feature specifics.

## Additional Notes

### Issue and Pull Request Labels

* `bug`: Something isn't working
* `enhancement`: New feature or request
* `documentation`: Improvements or additions to documentation
* `good first issue`: Good for newcomers
* `help wanted`: Extra attention is needed
* `question`: Further information is requested

### Where to Work

Working issues for this repo live in **beads** (`bd`), not in GitHub Issues —
see [Task Management](#task-management--bd-beads) above. GitHub Issues remains
the surface for externally reported bugs.

## Recognition

Contributors who make significant and valuable contributions will be granted commit access to the project.