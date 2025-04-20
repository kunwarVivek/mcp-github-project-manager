# Development Workflow

This document outlines the development workflow for contributing to the GitHub Project Manager MCP Server.

## Development Lifecycle

The development workflow follows these steps:

1. **Issue Creation**: All work starts with an issue
2. **Branch Creation**: Create a branch for your work
3. **Development**: Make your changes
4. **Testing**: Write and run tests
5. **Pull Request**: Submit your changes for review
6. **Review**: Address feedback
7. **Merge**: Changes are merged
8. **Release**: Changes are included in a release

## Issue Workflow

### Creating Issues

Before starting work, ensure there's an issue that describes what you're working on:

1. Check if an issue already exists
2. If not, create a new issue with:
   - Clear title
   - Detailed description
   - Steps to reproduce (for bugs)
   - Expected behavior
   - Actual behavior (for bugs)
   - Any relevant screenshots or logs

### Issue Labels

Issues are categorized with labels:

- `bug`: Something isn't working as expected
- `enhancement`: New feature or improvement
- `documentation`: Documentation improvements
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention is needed
- `question`: Further information is requested
- `wontfix`: This will not be worked on

### Issue Assignment

- Comment on an issue if you want to work on it
- Wait for a maintainer to assign it to you
- Don't start work on an issue that's assigned to someone else

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

1. Create test files in the `__tests__` directory
2. Name test files with `.test.ts` suffix
3. Use Jest's describe/it syntax
4. Mock external dependencies
5. Test both success and error cases

Example:

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

Releases are managed by the maintainers:

1. Maintainers create a release branch
2. Version is bumped according to [Semantic Versioning](https://semver.org/)
3. Changelog is updated
4. Release notes are created
5. Release is published

## Continuous Integration

The project uses GitHub Actions for CI:

- **Build**: Ensures the project builds successfully
- **Lint**: Checks code style and quality
- **Test**: Runs unit and integration tests
- **E2E**: Runs end-to-end tests
- **Coverage**: Reports test coverage

All CI checks must pass before a pull request can be merged.

## Development Tools

### Recommended VS Code Extensions

- ESLint
- Prettier
- TypeScript Hero
- Jest Runner
- GitLens

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "jest.autoRun": "off"
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
Error: Cannot find module '@modelcontextprotocol/sdk'
```

Solution: Run `npm install` to ensure all dependencies are installed.

#### TypeScript Errors

```
Error: Property 'X' does not exist on type 'Y'
```

Solution: Check the type definitions and ensure you're using the correct properties.

## Getting Help

If you encounter any issues with the development workflow:

1. Check the documentation
2. Ask in the issue you're working on
3. Create a new issue with the `question` label

Happy coding!
