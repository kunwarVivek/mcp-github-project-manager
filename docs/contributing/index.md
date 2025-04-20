# Contributing to GitHub Project Manager MCP

Thank you for your interest in contributing to the GitHub Project Manager MCP Server! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Guidelines](#documentation-guidelines)
- [Component-Specific Guidelines](#component-specific-guidelines)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) before contributing.

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or pnpm
- Git
- A GitHub account

### Setting Up the Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/github-project-manager-mcp.git
   cd github-project-manager-mcp
   ```
3. Add the original repository as a remote:
   ```bash
   git remote add upstream https://github.com/original-owner/github-project-manager-mcp.git
   ```
4. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```
5. Create a `.env` file with your GitHub credentials:
   ```env
   GITHUB_TOKEN=your_personal_access_token
   GITHUB_OWNER=your_github_username_or_org
   GITHUB_REPO=your_repository_name
   ```
6. Build the project:
   ```bash
   npm run build
   ```

## Development Workflow

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bugfix-name
   ```

2. Make your changes, following the [coding standards](#coding-standards)

3. Run tests to ensure your changes don't break existing functionality:
   ```bash
   npm test
   ```

4. Run linting to ensure code quality:
   ```bash
   npm run lint
   ```

5. Commit your changes with a descriptive commit message:
   ```bash
   git commit -m "feat: add new feature" # for features
   git commit -m "fix: resolve issue with X" # for bugfixes
   git commit -m "docs: update documentation" # for documentation
   git commit -m "test: add tests for feature X" # for tests
   git commit -m "refactor: improve code structure" # for refactoring
   ```

6. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

7. Create a pull request from your fork to the original repository

## Pull Request Process

1. Ensure your PR includes a clear description of the changes and the purpose
2. Update documentation if necessary
3. Add tests for new functionality
4. Ensure all tests pass
5. Make sure your code follows the project's coding standards
6. Respond to any feedback from reviewers

## Coding Standards

This project follows strict coding standards to maintain code quality and consistency:

### TypeScript Guidelines

- Use TypeScript for all new code
- Define explicit types for function parameters and return values
- Avoid using `any` type when possible
- Use interfaces for object shapes
- Use enums for fixed sets of values

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Use semicolons at the end of statements
- Use PascalCase for class names and interfaces
- Use camelCase for variables, functions, and methods
- Use UPPER_CASE for constants
- Add JSDoc comments for public APIs

### Architecture Guidelines

- Follow Clean Architecture principles
- Keep concerns separated between layers
- Use dependency injection when appropriate
- Make code testable by avoiding tight coupling

## Testing Guidelines

### Unit Tests

- Write unit tests for all new functionality
- Use Jest for testing
- Mock external dependencies
- Aim for high test coverage (at least 80%)

Example unit test:

```typescript
import { ProjectManagementService } from '../services/ProjectManagementService';
import { MockGitHubRepository } from './mocks/MockGitHubRepository';

describe('ProjectManagementService', () => {
  let service: ProjectManagementService;
  let mockRepo: MockGitHubRepository;

  beforeEach(() => {
    mockRepo = new MockGitHubRepository();
    service = new ProjectManagementService('owner', 'repo', 'token', mockRepo);
  });

  it('should create a project successfully', async () => {
    // Arrange
    const projectData = {
      title: 'Test Project',
      description: 'Test Description',
      visibility: 'private'
    };
    mockRepo.mockCreateProject.mockResolvedValue({ id: 'proj_123', ...projectData });

    // Act
    const result = await service.createProject(projectData);

    // Assert
    expect(result.id).toBe('proj_123');
    expect(result.title).toBe('Test Project');
    expect(mockRepo.mockCreateProject).toHaveBeenCalledWith(projectData);
  });
});
```

### Integration Tests

- Write integration tests for API interactions
- Use nock to mock external API calls
- Test error handling and edge cases

### E2E Tests

- Write end-to-end tests for critical workflows
- Test the full system from API to response

## Documentation Guidelines

### Code Documentation

- Add JSDoc comments for all public APIs
- Include parameter descriptions and return types
- Document exceptions that may be thrown

Example:

```typescript
/**
 * Creates a new project with the specified properties
 * 
 * @param {CreateProject} data - The project data
 * @param {string} data.title - The project title
 * @param {string} data.description - The project description
 * @param {string} data.visibility - The project visibility ('private' or 'public')
 * @returns {Promise<Project>} The created project
 * @throws {ValidationError} If the project data is invalid
 * @throws {UnauthorizedError} If the user is not authorized
 */
async createProject(data: CreateProject): Promise<Project> {
  // Implementation
}
```

### User Documentation

- Update the user guide when adding new features
- Add examples for new functionality
- Keep the API reference up to date

## Component-Specific Guidelines

### Domain Layer

- Keep domain entities pure and free from external dependencies
- Use interfaces to define repository contracts
- Define clear validation rules

### Infrastructure Layer

- Implement repository interfaces
- Handle external API communication
- Map external data to domain entities

### Service Layer

- Coordinate between repositories
- Implement business logic
- Handle transactions and error mapping

### MCP Layer

- Define tool schemas with Zod
- Implement proper request validation
- Format responses according to MCP specification

## Getting Help

If you need help with contributing:

1. Check the [documentation](../README.md)
2. Look for existing issues that might be related
3. Create a new issue with your question
4. Reach out to the maintainers

Thank you for contributing to the GitHub Project Manager MCP Server!
