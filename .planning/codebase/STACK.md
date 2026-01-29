# Technology Stack

**Analysis Date:** 2026-01-29

## Languages

**Primary:**
- TypeScript 5.8.3 - All source code in `src/`

**Secondary:**
- JavaScript (CommonJS) - Jest configuration files (`jest.config.cjs`)

## Runtime

**Environment:**
- Node.js >= 18.0.0 (specified in `package.json` engines)

**Package Manager:**
- npm (package-lock.json present)
- Lockfile: present (276KB)

## Frameworks

**Core:**
- Model Context Protocol SDK `@modelcontextprotocol/sdk` ^1.12.0 - MCP server implementation
- Octokit `@octokit/rest` ^22.0.0 - GitHub REST API client
- Vercel AI SDK `ai` ^4.3.16 - Unified AI model interface

**Testing:**
- Jest ^29.7.0 - Test runner
- ts-jest ^29.3.4 - TypeScript support for Jest
- jest-mock-extended ^3.0.7 - Mock creation
- nock ^14.0.4 - HTTP mocking

**Build/Dev:**
- TypeScript ^5.8.3 - Compiler
- ts-node ^10.9.2 - Runtime TypeScript execution
- rimraf ^6.0.1 - Build cleanup

**Linting/Formatting:**
- ESLint ^9.27.0 - Linting
- Prettier ^3.5.3 - Code formatting
- Husky ^9.1.7 - Git hooks

## Key Dependencies

**Critical:**
- `@modelcontextprotocol/sdk` ^1.12.0 - Core MCP protocol implementation for LLM tool exposure
- `@octokit/rest` ^22.0.0 - GitHub API client for all GitHub operations
- `ai` ^4.3.16 - Vercel AI SDK for multi-provider AI model access

**AI Provider SDKs:**
- `@ai-sdk/anthropic` ^1.2.12 - Claude models
- `@ai-sdk/openai` ^1.3.22 - OpenAI/GPT models
- `@ai-sdk/google` ^1.2.18 - Gemini models
- `@ai-sdk/perplexity` ^1.1.9 - Perplexity models (research)

**Infrastructure:**
- `dotenv` ^16.5.0 - Environment variable loading
- `tsyringe` ^4.10.0 - Dependency injection (decorators enabled)
- `zod` ^3.25.32 - Schema validation
- `uuid` ^11.1.0 - Unique ID generation
- `commander` ^14.0.0 - CLI argument parsing

## Configuration

**Environment:**
- Environment loaded via `dotenv` from `.env` or `--env-file` CLI flag
- Configuration centralized in `src/env.ts`
- CLI arguments override environment variables

**Required Environment Variables:**
- `GITHUB_TOKEN` - GitHub Personal Access Token (repo, project, workflow, write:org scopes)
- `GITHUB_OWNER` - GitHub username or organization
- `GITHUB_REPO` - Repository name

**Optional AI Provider Keys (at least one required for AI features):**
- `ANTHROPIC_API_KEY` - Anthropic/Claude API
- `OPENAI_API_KEY` - OpenAI API
- `GOOGLE_API_KEY` - Google AI API
- `PERPLEXITY_API_KEY` - Perplexity API

**AI Model Configuration:**
- `AI_MAIN_MODEL` - Primary model (default: claude-3-5-sonnet-20241022)
- `AI_RESEARCH_MODEL` - Research tasks (default: perplexity-llama-3.1-sonar-large-128k-online)
- `AI_FALLBACK_MODEL` - Fallback model (default: gpt-4o)
- `AI_PRD_MODEL` - PRD generation (default: claude-3-5-sonnet-20241022)

**Build:**
- `tsconfig.json` - Main TypeScript config (ES2022 target, ESNext modules)
- `tsconfig.build.json` - Production build config
- `tsconfig.test.json` - Test-specific config
- Decorators enabled (`experimentalDecorators`, `emitDecoratorMetadata`)

## TypeScript Configuration

**Compiler Options:**
- Target: ES2022
- Module: ESNext
- Module Resolution: node
- Strict mode: enabled
- Source maps: enabled
- Declaration files: enabled

**Path Aliases:**
- `@/*` maps to `src/*`

## Build Process

**Scripts:**
```bash
npm run build      # Clean + compile TypeScript to build/
npm run dev        # Watch mode with ts-node
npm start          # Run compiled build/index.js
```

**Post-build:**
- Makes `build/index.js` executable
- Runs `scripts/fix-imports.js` for ESM compatibility

## Platform Requirements

**Development:**
- Node.js >= 18.0.0
- npm (any modern version)
- Git (for husky hooks)

**Production:**
- Node.js >= 18.0.0
- Runs as MCP server over stdio transport
- Optional: HTTP server for webhooks (port 3001 default)

**Deployment:**
- Published to npm as `mcp-github-project-manager`
- Binary: `mcp-github-project-manager`
- Main export: `build/index.js`

---

*Stack analysis: 2026-01-29*
