# AI-Powered Task Management Features

This document provides comprehensive documentation for the AI-powered task management and requirements traceability features in the GitHub Project Manager MCP Server.

The AI features are exposed through **three compound tools** — `ai_generate`
(9 actions), `ai_analyze` (9 actions) and `ai_plan` (6 actions). This page uses
the `tool/action` notation, e.g. `ai_generate/generate_prd`.

## Overview

The AI features transform traditional project management by providing intelligent task generation, comprehensive requirements traceability, and AI-powered analysis throughout the project lifecycle.

## Table of Contents

- [AI Tools Overview](#ai-tools-overview)
- [Requirements Traceability](#requirements-traceability)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## AI Tools Overview

### 1. PRD Management Tools (`ai_generate`)

#### `ai_generate/generate_prd`
Generates comprehensive Product Requirements Documents from project ideas using AI analysis.

**Features:**
- Multi-provider AI support (Anthropic, OpenAI, Google, Perplexity, and any OpenAI-compatible endpoint)
- Comprehensive PRD structure with all standard sections
- Quality assessment and completeness scoring
- Market research integration (optional)
- Industry-specific customization

**Input Parameters:**
```typescript
{
  projectIdea: string;           // The project concept (min 20 chars)
  projectName: string;           // Name of the project (min 3 chars)
  targetUsers?: string[];        // Target user groups
  timeline?: string;             // Expected timeline
  complexity: 'low' | 'medium' | 'high';
  author: string;                // PRD author
  stakeholders?: string[];       // Project stakeholders
  includeResearch?: boolean;     // Include market research
  industryContext?: string;      // Industry domain context
}
```

**Output:**
- Complete PRD with objectives, features, user personas
- Technical requirements and success metrics
- Quality assessment with completeness score
- Recommendations for improvement

#### `ai_generate/enhance_prd`
Improves existing PRDs with AI-powered gap analysis and enhancements.

**Enhancement Types:**
- `comprehensive`: Complete enhancement across all areas
- `technical`: Focus on technical requirements and architecture
- `user_focused`: Enhance user personas and journey mapping
- `business_focused`: Improve business analysis and ROI

#### `ai_generate/parse_prd`
Parses PRDs and generates actionable development tasks with full traceability.

**Features:**
- AI-powered task breakdown from PRD content
- Automatic complexity and effort estimation
- Priority assignment and dependency detection
- Complete requirements traceability matrix creation
- Use case generation from features

#### `ai_generate/materialize_tasks`
Materializes AI-generated tasks into real GitHub issues, grouped into
milestones and sprints and sequenced by the dependency graph.

### 2. Task Management Tools (`ai_generate`)

#### `ai_generate/get_next_task`
Provides AI-powered recommendations for the next task to work on.

**Features:**
- Priority-based task recommendations
- Team skill matching
- Sprint capacity planning
- Dependency analysis
- Blocker identification

#### `ai_generate/analyze_complexity`
Performs detailed AI analysis of task complexity and risk assessment.

**Analysis Includes:**
- Complexity scoring (1-10 scale)
- Effort breakdown by activity type
- Risk assessment with mitigation strategies
- Team experience considerations
- Confidence scoring

#### `ai_generate/expand_task`
Breaks down complex tasks into manageable subtasks automatically.

**Features:**
- Intelligent subtask generation
- Dependency detection between subtasks
- Acceptance criteria creation
- Implementation order recommendations

### 3. Feature Lifecycle Management (`ai_generate`)

#### `ai_generate/add_feature`
Adds new features with complete lifecycle management and impact analysis.

**Features:**
- Business impact assessment
- Technical feasibility analysis
- Automatic task breakdown (8-12 tasks per feature)
- Complete lifecycle tracking setup
- Roadmap integration

### 4. Analysis Tools (`ai_analyze`)

| Action | Purpose |
|--------|---------|
| `ai_analyze/enrich_issue` | AI-enrich a single issue (labels, priority, type, complexity, effort) |
| `ai_analyze/enrich_issue_sections` | Enrich an issue into structured sections with per-section confidence |
| `ai_analyze/enrich_bulk` | Bulk enrich multiple issues |
| `ai_analyze/triage_issue` | AI triage a single issue |
| `ai_analyze/triage_all` | Triage all untriaged issues |
| `ai_analyze/suggest_labels` | Suggest labels for an issue |
| `ai_analyze/detect_duplicates` | Detect duplicate issues |
| `ai_analyze/find_related` | Find related issues |

### 5. Planning Tools (`ai_plan`)

| Action | Purpose |
|--------|---------|
| `ai_plan/calculate_capacity` | Calculate sprint capacity |
| `ai_plan/prioritize_backlog` | AI-prioritize the backlog |
| `ai_plan/assess_risk` | Assess sprint risk |
| `ai_plan/suggest_composition` | Suggest sprint composition |
| `ai_plan/generate_roadmap` | Generate a project roadmap |
| `ai_plan/generate_visualization` | Generate visualization data |

### 6. Requirements Traceability (`ai_generate`)

#### `ai_generate/create_traceability_matrix`
Creates comprehensive requirements traceability matrix with full bidirectional tracking.

**Traceability Hierarchy:**
```
Business Requirements (from PRD)
    ↓ derives_from
Functional Requirements (Features)
    ↓ derives_from
Use Cases (Actor-Goal-Scenario)
    ↓ implements
Implementation Tasks
```

## Requirements Traceability

### Complete Hierarchy

The system provides end-to-end traceability through four levels:

1. **Business Requirements**: Extracted from PRD objectives and success metrics
2. **Functional Requirements**: Features that implement business requirements
3. **Use Cases**: Actor-goal-scenario structures derived from user stories
4. **Implementation Tasks**: Specific development tasks that implement use cases

### Traceability Links

- **DERIVES_FROM**: Child requirements derive from parent requirements
- **IMPLEMENTS**: Tasks implement requirements/use cases
- **VERIFIES**: Test cases verify requirements
- **DEPENDS_ON**: Dependency relationships
- **CONFLICTS_WITH**: Conflict identification
- **RELATES_TO**: General relationships

### Coverage Analysis

The system provides comprehensive coverage metrics:

- **Business Requirements Coverage**: % of requirements with implementing features
- **Feature Coverage**: % of features with use cases
- **Use Case Coverage**: % of use cases with implementing tasks
- **Task Traceability**: % of tasks linked to requirements
- **Orphaned Task Detection**: Tasks without requirement links
- **Unimplemented Requirements**: Requirements without implementing tasks

## Configuration

### Environment Variables

#### Required AI Provider Configuration
At least one AI provider must be configured:

```bash
# Primary AI providers (at least one required)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

#### Optional AI Model Configuration
There are **no default models** — configure the ones you want to use. A role
with an API key but no model is left unconfigured and the server warns instead
of silently picking one.

```bash
# AI Model Configuration (no defaults)
# AI_MAIN_MODEL=claude-sonnet-4-20250514
# AI_RESEARCH_MODEL=sonar-pro
# AI_FALLBACK_MODEL=gpt-4o-mini
# AI_PRD_MODEL=claude-opus-5
```

Each role can also override its provider, key and endpoint independently:

```bash
# AI_MAIN_PROVIDER=openai-compatible
# AI_MAIN_BASE_URL=https://openrouter.ai/api/v1
# AI_MAIN_API_KEY=sk-or-v1-...
# AI_MAIN_MODEL=deepseek/deepseek-chat
```

#### Optional Task Generation Configuration
```bash
# AI Task Generation Configuration
MAX_TASKS_PER_PRD=50
DEFAULT_COMPLEXITY_THRESHOLD=7
MAX_SUBTASK_DEPTH=3
AUTO_DEPENDENCY_DETECTION=true
AUTO_EFFORT_ESTIMATION=true
```

### AI Provider Setup

#### Anthropic Claude (Recommended Primary)
1. Sign up at [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Set `ANTHROPIC_API_KEY` in your environment

#### OpenAI (Recommended Fallback)
1. Sign up at [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Set `OPENAI_API_KEY` in your environment

#### Google Gemini
1. Sign up at [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. Set `GOOGLE_API_KEY` in your environment

#### Perplexity (For Research)
1. Sign up at [Perplexity API](https://www.perplexity.ai/settings/api)
2. Create an API key
3. Set `PERPLEXITY_API_KEY` in your environment

## Usage Examples

### Complete Project Workflow

```json
// 1. Generate PRD from project idea
{"tool": "ai_generate", "arguments": {
  "action": "generate_prd",
  "projectIdea": "AI-powered task management system with real-time collaboration and advanced analytics",
  "projectName": "TaskAI Pro",
  "author": "product-team",
  "complexity": "high",
  "timeline": "8 months",
  "targetUsers": ["project-managers", "developers", "executives"],
  "stakeholders": ["engineering", "product", "design", "sales"],
  "includeResearch": true,
  "industryContext": "productivity software"
}}

// 2. Parse PRD and generate tasks with full traceability
{"tool": "ai_generate", "arguments": {
  "action": "parse_prd",
  "prdContent": "<generated PRD content>",
  "maxTasks": 35,
  "createTraceabilityMatrix": true,
  "includeUseCases": true,
  "projectId": "task-ai-pro"
}}

// 3. Get next task recommendations
{"tool": "ai_generate", "arguments": {
  "action": "get_next_task",
  "sprintCapacity": 40,
  "teamSkills": ["react", "node.js", "typescript", "python"],
  "maxComplexity": 7,
  "includeAnalysis": true
}}

// 4. Analyze complex tasks before starting
{"tool": "ai_generate", "arguments": {
  "action": "analyze_complexity",
  "taskTitle": "Implement real-time collaboration engine",
  "taskDescription": "Build WebSocket-based real-time collaboration with conflict resolution, presence indicators, and collaborative editing",
  "teamExperience": "mixed",
  "includeBreakdown": true,
  "includeRisks": true
}}

// 5. Break down complex tasks if needed
{"tool": "ai_generate", "arguments": {
  "action": "expand_task",
  "taskTitle": "Build advanced analytics dashboard",
  "taskDescription": "Create comprehensive analytics dashboard with custom charts, real-time data, and AI-powered insights",
  "currentComplexity": 8,
  "targetComplexity": 3,
  "includeEstimates": true,
  "includeDependencies": true
}}
```

### Feature Addition Workflow

```json
// Add new feature with complete lifecycle management
{"tool": "ai_generate", "arguments": {
  "action": "add_feature",
  "featureIdea": "Advanced Analytics Dashboard with AI Insights",
  "description": "Real-time analytics dashboard with custom charts, predictive analytics, and AI-powered recommendations for project optimization",
  "requestedBy": "product-manager",
  "businessJustification": "Increase user engagement by 40% and provide actionable insights for better project outcomes",
  "targetUsers": ["project-managers", "team-leads", "executives"],
  "autoApprove": true,
  "expandToTasks": true
}}

// This automatically creates:
// ✅ Business requirement analysis and impact assessment
// ✅ Use cases with complete actor-goal-scenario structure
// ✅ 8-12 implementation tasks with full traceability links
// ✅ Lifecycle tracking for all generated tasks
// ✅ Integration with existing project roadmap
```

### Requirements Traceability Management

```json
// Create comprehensive traceability matrix
{"tool": "ai_generate", "arguments": {
  "action": "create_traceability_matrix",
  "projectId": "task-ai-pro",
  "prdContent": "<comprehensive PRD content>",
  "features": [
    {
      "id": "feature-1",
      "title": "Real-time Collaboration",
      "description": "WebSocket-based real-time collaboration with conflict resolution",
      "priority": "critical",
      "userStories": [
        "As a team member, I want to collaborate in real-time so that we can work efficiently together",
        "As a project manager, I want to see who is working on what in real-time"
      ],
      "acceptanceCriteria": [
        "Multiple users can edit simultaneously",
        "Conflicts are resolved automatically",
        "Presence indicators show active users"
      ],
      "estimatedComplexity": 8
    }
  ],
  "tasks": [
    {
      "id": "task-1",
      "title": "Implement WebSocket infrastructure",
      "description": "Set up WebSocket server and client connection handling",
      "complexity": 6,
      "estimatedHours": 16,
      "priority": "critical"
    }
  ],
  "validateCompleteness": true
}}

// Output provides:
// ✅ Complete requirements hierarchy (Business → Features → Use Cases → Tasks)
// ✅ Bidirectional traceability links with impact analysis
// ✅ Coverage metrics and gap identification
// ✅ Sample traceability paths showing end-to-end connections
// ✅ Validation results with completeness scoring
// ✅ Orphaned task detection and unimplemented requirement tracking
```

## Best Practices

### 1. PRD Generation
- Provide detailed project ideas (minimum 20 characters, ideally 100+)
- Include specific target users and stakeholders
- Set realistic timelines and complexity levels
- Use industry context for better AI analysis
- Enable research for competitive analysis when needed

### 2. Task Generation
- Start with well-structured PRDs for better task quality
- Use appropriate maxTasks limits (20-50 for most projects)
- Enable subtasks for complex features
- Set target complexity thresholds based on team experience
- Always create traceability matrices for enterprise projects

### 3. Requirements Traceability
- Maintain bidirectional links between all requirement levels
- Regularly validate traceability completeness
- Address orphaned tasks and unimplemented requirements promptly
- Use traceability for impact analysis when requirements change
- Track verification status for compliance requirements

### 4. Team Collaboration
- Match task recommendations to team skills
- Consider sprint capacity when getting next task recommendations
- Use complexity analysis before starting high-risk tasks
- Break down tasks with complexity > 7 into subtasks
- Maintain lifecycle tracking for progress visibility

## Troubleshooting

### Common Issues

#### AI Provider Errors
```
Error: No AI providers available
```
**Solution**: Ensure at least one AI provider API key is configured in environment variables.

#### Rate Limiting
```
Error: Rate limit exceeded for provider
```
**Solution**: The system automatically switches to fallback providers. Wait for rate limits to reset or configure additional providers.

#### Invalid PRD Content
```
Error: Failed to extract features from PRD
```
**Solution**: Ensure PRD content is well-structured with clear sections for objectives, features, and requirements.

#### Traceability Gaps
```
Warning: 15 orphaned tasks detected
```
**Solution**: Review orphaned tasks and link them to appropriate requirements or use cases. Consider if tasks are truly necessary.

### Performance Optimization

1. **Use appropriate task limits**: Don't generate more tasks than needed
2. **Enable caching**: AI responses are cached to improve performance
3. **Batch operations**: Use traceability matrix creation for bulk operations
4. **Monitor API usage**: Track AI provider usage to avoid unexpected costs

### Debugging

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

This provides detailed information about:
- AI provider selection and fallback
- Request/response cycles
- Traceability link generation
- Coverage analysis calculations

## Support

For issues related to AI features:

1. Check the [troubleshooting section](#troubleshooting)
2. Review AI provider status and API key configuration
3. Validate input parameters against the tool schemas (`discover_tools` returns them)
4. Check debug logs for detailed error information
5. Open an issue with detailed reproduction steps

## Changelog

### Version 2.x (current)
- The AI features are exposed through the compound tools `ai_generate`,
  `ai_analyze` and `ai_plan`
- Multi-provider AI support with automatic fallback and per-role provider,
  key and endpoint overrides
- End-to-end requirements traceability
- Intelligent task complexity analysis
- Feature lifecycle management

### Version 1.x
- Core GitHub project management functionality
- Basic issue and milestone management
- Sprint planning capabilities
