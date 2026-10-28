# Technology Stack

**Analysis Date:** 2026-10-21

**Updated:** 2026-10-21 — rewritten for the current stack: TypeScript 7, Vitest 5, Biome 2.5, npm + pnpm, MCP SDK v2, zod 4. The previous snapshot described the pre-migration toolchain and is no longer accurate.

## Languages

**Primary:**
- TypeScript 7.0.2 - All source code in `src/`

**Secondary:**
- JavaScript (ESM) - Build helper `scripts/fix-imports.js`, Husky hook scripts

## Runtime

**Environment:**
- Node.js 24 (`.node-version`); `engines.node` floor is `>=22.12.0`
- CI tests the matrix `22.x` + `24.x`; Docker images use `node:24-slim`
- Package is ESM (`"type": "module"`)

**Package Managers:**
- npm **and** pnpm are both supported. Both lockfiles are committed and kept in sync:
  - `package-lock.json` (npm)
  - `pnpm-lock.yaml` (pnpm)
- `package.json` deliberately has **no** `packageManager` field — nobody is forced onto one
- pnpm 12 is used in CI (`pnpm/action-setup@v4` with `version: 12`); `pnpm-workspace.yaml` carries an `allowBuilds` allowlist (`esbuild: true`) because pnpm 12 refuses to install dependencies with unapproved lifecycle scripts
- Every npm script is package-manager agnostic: `npm run build` and `pnpm run build` are the same command

## Frameworks

**Core:**
- Model Context Protocol SDK `@modelcontextprotocol/server` ^2.3.1 - MCP server implementation (v2, 2026-07-28 spec)
- `@modelcontextprotocol/client` ^2.3.1 - dev/test client
- Octokit `@octokit/rest` ^22.0.1 - GitHub REST + GraphQL API client
- `@octokit/auth-app` ^8.3.1 - GitHub App installation auth
- Vercel AI SDK `ai` ^7.0.146 - Unified AI model interface

**Testing:**
- Vitest ^5.0.5 - Test runner (config: `vitest.config.ts`)
- `@vitest/coverage-v8` ^5.0.5 - Coverage provider
- Vite ^8.3.4 - dev-only; pulled in as Vitest's peer and pinned explicitly so resolution is not a lottery
- nock ^15.0.5 - HTTP mocking
- tsx ^4.23.15 - TypeScript execution for dev/watch and scripts

**Build/Dev:**
- TypeScript ^7.0.2 - Compiler (`tsc -p tsconfig.build.json`)
- rimraf ^6.1.3 - Build cleanup
- Husky ^9.1.7 - Git hooks

**Linting/Formatting:**
- Biome ^2.5.15 (`@biomejs/biome`) - **both** linting and formatting, configured in `biome.json`
- `pnpm run lint` (`biome check .`) · `pnpm run format` (`biome format --write .`) · `pnpm run lint:fix` (`biome check --write .`)

## Key Dependencies

**Critical:**
- `@modelcontextprotocol/server` ^2.3.1 - Core MCP protocol implementation for LLM tool exposure
- `@octokit/rest` ^22.0.1 - GitHub API client for all GitHub operations
- `ai` ^7.0.146 - Vercel AI SDK for multi-provider AI model access

**AI Provider SDKs:**
- `@ai-sdk/anthropic` ^4.0.84 - Claude models
- `@ai-sdk/openai` ^4.0.98 - OpenAI/GPT models
- `@ai-sdk/google` ^4.0.101 - Gemini models
- `@ai-sdk/perplexity` ^5.0.16 - Perplexity models (research)
- `@ai-sdk/provider` `4.0.31` - **pinned exact and a direct dependency**: `ai`@7 does not re-export `LanguageModelV4*`, and pnpm does not hoist transitive packages the way npm did. An undeclared import compiles under npm and fails under pnpm.

**Infrastructure:**
- `dotenv` ^18.0.8 - Environment variable loading (loaded with `quiet: true` — dotenv's banner would corrupt the stdio JSON-RPC stream)
- `tsyringe` ^4.10.0 - Dependency injection (decorators enabled)
- `zod` ^4.6.7 - Schema validation
- `uuid` ^14.0.3 - Unique ID generation
- `commander` ^15.0.0 - CLI argument parsing
- `cockatiel` ^4.0.0 - Retry/resilience
- `reflect-metadata` ^0.2.2 - Required by tsyringe decorator metadata

## Configuration

**Environment:**
- Environment loaded via `dotenv` from `.env` or the `--env-file` CLI flag
- Configuration centralized in `src/env.ts`; CLI arguments override environment variables
- Startup validation runs against the **resolved** config, not raw `process.env`

**Required Environment Variables:**
- `GITHUB_TOKEN` - GitHub Personal Access Token (repo, project, workflow, write:org scopes)
- `GITHUB_OWNER` - GitHub username or organization
- `GITHUB_REPO` - Repository name

**Credential chain (first hit wins):**
- `--token` CLI flag → `$SECRETS_DIR/GITHUB_TOKEN` file → `GITHUB_TOKEN` env var → `gh auth token`
- `gh` fallback is disabled with `GH_CLI_TOKEN_FALLBACK=false` and is off automatically under `NODE_ENV=test`
- Every credential read goes through `getSecret()` / `requireToken()` in `src/env.ts` (and `src/infrastructure/tools/tool-factory.ts`). **Never** read `process.env.GITHUB_TOKEN` directly — that bypasses the whole chain.
- `SECRETS_DIR` (e.g. `/run/secrets`) loads any config/secret from a file named after it, checked before env vars
- `SecretProvider` (`src/infrastructure/secrets/`) is the extension point for Vault/AWS Secrets Manager

**GitHub App auth (optional, outranks the PAT when all three are set):**
- `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`
- A partial App configuration falls back to the PAT rather than failing, so a half-set environment cannot lock the server out

**Optional AI Provider Keys (at least one required for AI features):**
- `ANTHROPIC_API_KEY` - Anthropic/Claude API
- `OPENAI_API_KEY` - OpenAI API
- `GOOGLE_API_KEY` - Google AI API
- `PERPLEXITY_API_KEY` - Perplexity API

**AI Model Configuration:**
- `AI_MAIN_MODEL` - Primary model
- `AI_RESEARCH_MODEL` - Research tasks
- `AI_FALLBACK_MODEL` - Fallback model
- `AI_PRD_MODEL` - PRD generation
- Per-role overrides: `AI_<ROLE>_PROVIDER`, `AI_<ROLE>_API_KEY`, `AI_<ROLE>_BASE_URL` (supports any OpenAI-protocol endpoint)

**Build:**
- `tsconfig.json` - Base config (ES2022 target, ESNext modules, `moduleResolution: bundler`)
- `tsconfig.build.json` - Production build config
- `tsconfig.test.json` - Test typecheck config (`types: ["node", "vitest/globals"]`)
- `tsconfig.typecheck.json` - Typecheck config for `src/` + `examples/`
- `vitest.config.ts` - Test runner config
- `biome.json` - Lint + format config
- `pnpm-workspace.yaml` - pnpm 12 `allowBuilds` allowlist
- Decorators enabled (`experimentalDecorators`, `emitDecoratorMetadata`)

## TypeScript Configuration

**Compiler Options:**
- Target: ES2022
- Module: ESNext
- Module Resolution: `bundler`
- `isolatedModules: true` - every file must transpile independently; a type re-exported as a value is an error (`tsc` elides those; `tsx`/esbuild emit a real runtime import that then fails to resolve)
- Strict mode: enabled
- Source maps: enabled
- Declaration files: enabled
- `experimentalDecorators` + `emitDecoratorMetadata` (tsyringe)

**Path Aliases:**
- `@/*` maps to `src/*` (tsconfig `paths` + `vitest.config.ts` `resolve.alias`)

## Build Process

**Scripts:**
```bash
npm run build      # Clean + compile TypeScript to build/  (pnpm run build is identical)
npm run dev        # Watch mode with tsx
npm run typecheck  # src + examples, then src + tests
npm start          # Run compiled build/index.js
```

**Post-build:**
- Makes `build/index.js` executable
- Runs `scripts/fix-imports.js` to add `.js` extensions to ESM imports (source omits them)

## Validation

- **zod 4** (`^4.6.7`). Tool JSON Schema is generated by zod 4's native `z.toJSONSchema({io:'input'})` inside `ToolRegistry`. The older `zod-to-json-schema` package does not support zod 4 and returns `{type:'object'}` with no `properties` — silently, with no error — which left every tool advertising a parameterless schema. Guarded by `src/__tests__/unit/infrastructure/tools/schema-generation.test.ts`.
- zod-4 gotchas: `z.record` needs an explicit key schema (`z.record(z.string(), v)`); `ZodError.errors` → `.issues`; `.nonstrict()` removed (objects strip by default)

## Platform Requirements

**Development:**
- Node.js >= 22.12.0 (24 recommended; `.node-version` pins 24)
- npm or pnpm (both supported, both lockfiles committed)
- Git (for husky hooks)

**Production:**
- Node.js >= 22.12.0
- Runs as MCP server over stdio transport
- Optional: HTTP server for webhooks (port 3001 default)

**Deployment:**
- Published to npm as `mcp-github-project-manager`
- Binary: `mcp-github-project-manager`
- Main export: `build/index.js`
- Docker: multi-stage `Dockerfile` — `node:24-slim` builder running `npm ci` from `package-lock.json` and `npm run build`, then a runtime stage with `npm ci --omit=dev`, running as the non-root user `mcpuser`

---

*Stack analysis: 2026-10-21*
