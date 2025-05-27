# Testing Guide for AI-Powered Features

This document provides comprehensive testing guidance for the AI-powered task management and requirements traceability features.

## Test Structure

### Test Organization

```
tests/
├── ai-services/                    # AI service layer tests
│   ├── AIServiceFactory.test.ts   # AI provider management
│   ├── PRDGenerationService.test.ts
│   ├── TaskGenerationService.test.ts
│   └── RequirementsTraceabilityService.test.ts
├── ai-tools/                      # MCP tool tests
│   ├── GeneratePRDTool.test.ts
│   ├── ParsePRDTool.test.ts
│   ├── CreateTraceabilityMatrixTool.test.ts
│   └── [other AI tool tests]
└── integration/                   # End-to-end tests
    └── ai-workflow.test.ts
```

## Running Tests

### All Tests
```bash
npm test
```

### AI-Specific Tests
```bash
# Run only AI-related tests
npm run test:ai

# Watch mode for AI tests
npm run test:ai:watch

# Coverage for AI tests
npm run test:ai:coverage
```

### Core Tests (excluding AI)
```bash
npm run test:core
```

### Integration Tests
```bash
npm run test:integration
```

## Test Categories

### 1. AI Service Tests

#### AIServiceFactory Tests
- **Provider Detection**: Tests automatic detection of available AI providers
- **Fallback Logic**: Tests switching between providers on failure
- **Rate Limiting**: Tests rate limit handling and provider switching
- **Configuration**: Tests model configuration and API key validation
- **Health Checks**: Tests provider health monitoring
- **Metrics**: Tests usage tracking and error reporting

#### PRDGenerationService Tests
- **PRD Generation**: Tests complete PRD generation from project ideas
- **Research Integration**: Tests market research inclusion
- **Quality Validation**: Tests PRD completeness scoring
- **Feature Extraction**: Tests feature extraction from PRD content
- **Enhancement**: Tests PRD improvement functionality
- **Error Handling**: Tests AI service error scenarios

#### TaskGenerationService Tests
- **Task Generation**: Tests task creation from PRD content
- **Complexity Analysis**: Tests AI-powered complexity assessment
- **Task Expansion**: Tests breaking down complex tasks
- **Recommendations**: Tests next task recommendation logic
- **Validation**: Tests generated task structure validation
- **Subtask Handling**: Tests subtask generation and management

#### RequirementsTraceabilityService Tests
- **Business Requirements Extraction**: Tests extraction from PRD objectives
- **Use Case Generation**: Tests actor-goal-scenario creation
- **Task Enhancement**: Tests adding traceability to tasks
- **Matrix Creation**: Tests comprehensive traceability matrix
- **Relationship Detection**: Tests automatic relationship identification
- **Coverage Analysis**: Tests gap identification and metrics

### 2. AI Tool Tests

#### GeneratePRDTool Tests
- **Successful Generation**: Tests complete PRD generation workflow
- **Research Integration**: Tests PRD generation with market research
- **Quality Assessment**: Tests completeness scoring and recommendations
- **Error Handling**: Tests service error scenarios
- **Input Validation**: Tests parameter validation
- **Output Formatting**: Tests comprehensive summary generation

#### ParsePRDTool Tests
- **Task Generation**: Tests PRD parsing and task creation
- **Traceability Matrix**: Tests automatic traceability creation
- **Complexity Filtering**: Tests task filtering by complexity
- **Coverage Analysis**: Tests orphaned task detection
- **Error Handling**: Tests service failure scenarios
- **Metrics Calculation**: Tests project metrics computation

#### CreateTraceabilityMatrixTool Tests
- **Matrix Creation**: Tests comprehensive traceability matrix generation
- **Validation**: Tests completeness scoring and gap identification
- **Sample Paths**: Tests traceability path generation
- **Content Extraction**: Tests objective and metric extraction
- **Error Handling**: Tests service error scenarios
- **Coverage Metrics**: Tests coverage calculation accuracy

### 3. Integration Tests

#### End-to-End Workflows
- **Complete Project Workflow**: Tests PRD → Tasks → Traceability
- **Feature Addition**: Tests feature addition with lifecycle management
- **Requirements Tracking**: Tests end-to-end traceability
- **AI Provider Fallback**: Tests multi-provider scenarios
- **Error Recovery**: Tests error handling across services

## Test Data

### Mock Data Structure

#### Sample PRD
```typescript
const mockPRD = {
  id: 'prd-1',
  title: 'Task Management App PRD',
  overview: 'Comprehensive task management application',
  objectives: ['Improve productivity', 'Streamline workflows'],
  features: [
    {
      id: 'feature-1',
      title: 'Task Creation',
      description: 'Create and manage tasks',
      priority: 'high',
      userStories: ['As a user, I want to create tasks'],
      acceptanceCriteria: ['User can create task with title'],
      estimatedComplexity: 5
    }
  ],
  // ... additional PRD properties
};
```

#### Sample Tasks
```typescript
const mockTasks = [
  {
    id: 'task-1',
    title: 'Setup authentication infrastructure',
    description: 'Configure OAuth and JWT handling',
    complexity: 4,
    estimatedHours: 8,
    priority: 'high',
    status: 'pending',
    dependencies: [],
    acceptanceCriteria: ['OAuth is configured'],
    tags: ['auth', 'setup']
  }
];
```

#### Sample Traceability Matrix
```typescript
const mockTraceabilityMatrix = {
  id: 'tm-1',
  projectId: 'test-project',
  prdId: 'prd-1',
  businessRequirements: [...],
  features: [...],
  useCases: [...],
  tasks: [...],
  traceabilityLinks: [...],
  coverage: {
    businessRequirementsCovered: 5,
    featuresCovered: 3,
    useCasesCovered: 8,
    tasksWithTraceability: 22,
    orphanedTasks: [],
    unimplementedRequirements: []
  }
};
```

## Mocking Strategy

### AI Service Mocking
```typescript
// Mock AI service responses
vi.mocked(AIServiceFactory).mockImplementation(() => ({
  getProvider: vi.fn().mockResolvedValue({
    generateText: vi.fn().mockResolvedValue('Generated content'),
    generateObject: vi.fn().mockResolvedValue(mockObject)
  })
}));
```

### Service Layer Mocking
```typescript
// Mock service methods
vi.mocked(PRDGenerationService).mockImplementation(() => ({
  generatePRDFromIdea: vi.fn().mockResolvedValue(mockPRD),
  validatePRDCompleteness: vi.fn().mockResolvedValue(mockValidation)
}));
```

## Test Scenarios

### Happy Path Tests
1. **Complete Workflow**: PRD generation → Task parsing → Traceability creation
2. **Feature Addition**: Add feature → Generate tasks → Create lifecycle
3. **Task Management**: Get recommendations → Analyze complexity → Expand tasks

### Error Scenarios
1. **AI Provider Failures**: Test fallback mechanisms
2. **Invalid Input**: Test parameter validation
3. **Service Errors**: Test error propagation and handling
4. **Rate Limiting**: Test provider switching on rate limits

### Edge Cases
1. **Empty Content**: Test handling of minimal input
2. **Large Projects**: Test performance with many tasks/features
3. **Complex Dependencies**: Test circular dependency detection
4. **Malformed Data**: Test resilience to invalid data structures

## Coverage Requirements

### Minimum Coverage Targets
- **AI Services**: 85% line coverage
- **AI Tools**: 80% line coverage
- **Integration Tests**: 70% path coverage

### Critical Paths
- AI provider selection and fallback
- Traceability link generation
- Task complexity analysis
- Error handling and recovery

## Performance Testing

### Load Testing
- Test with large PRDs (50+ features)
- Test with complex traceability matrices (100+ tasks)
- Test AI provider response times

### Memory Testing
- Monitor memory usage during large operations
- Test for memory leaks in long-running processes

## Debugging Tests

### Debug Configuration
```bash
# Enable debug logging for tests
DEBUG=ai-services:*,test:* npm run test:ai

# Run specific test with verbose output
npm run test:ai -- --testNamePattern="PRD generation"
```

### Common Issues

#### AI Provider Errors
```
Error: No AI providers available
```
**Solution**: Mock AI providers in test setup

#### Async Test Issues
```
Error: Test timeout
```
**Solution**: Increase timeout for AI operations or mock responses

#### Memory Issues
```
Error: JavaScript heap out of memory
```
**Solution**: Use `--max-old-space-size=4096` for large test suites

## Continuous Integration

### GitHub Actions Configuration
```yaml
- name: Run AI Tests
  run: |
    npm run test:ai:coverage
  env:
    # Mock API keys for testing
    ANTHROPIC_API_KEY: test-key
    OPENAI_API_KEY: test-key
```

### Test Reporting
- Coverage reports generated in `coverage/` directory
- Test results exported in JUnit format
- Performance metrics tracked over time

## Manual Testing

### AI Tool Validation
1. **Start MCP Server**: `npm start`
2. **List Tools**: Verify all 8 AI tools are available
3. **Test Tool Execution**: Run sample commands
4. **Validate Output**: Check response format and content

### Integration Testing
1. **Complete Workflow**: Test end-to-end scenarios
2. **Error Scenarios**: Test with invalid inputs
3. **Performance**: Test with realistic data sizes

## Best Practices

### Test Writing
1. **Use Descriptive Names**: Test names should clearly describe the scenario
2. **Mock External Dependencies**: Always mock AI providers and external services
3. **Test Error Paths**: Include negative test cases
4. **Validate Output Structure**: Check both content and format
5. **Use Realistic Data**: Test with representative data sizes

### Test Maintenance
1. **Update Mocks**: Keep mock data synchronized with real responses
2. **Review Coverage**: Regularly check and improve test coverage
3. **Performance Monitoring**: Track test execution times
4. **Documentation**: Keep test documentation up to date

## Troubleshooting

### Common Test Failures

#### Mock Issues
- Ensure all external dependencies are properly mocked
- Verify mock return values match expected types
- Check async mock handling

#### Timeout Issues
- Increase test timeouts for AI operations
- Mock slow AI provider responses
- Use fake timers for time-dependent tests

#### Memory Issues
- Clean up resources in test teardown
- Use smaller test data sets
- Monitor memory usage patterns

### Debug Tools
- Use `console.log` for debugging test data
- Enable debug logging for specific modules
- Use Jest's `--verbose` flag for detailed output
- Use `--detectOpenHandles` to find resource leaks
