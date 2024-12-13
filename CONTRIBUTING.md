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
3. Make your changes
4. Run the tests
5. Push to your fork and submit a pull request

### Setup Development Environment

```bash
# Clone your fork
git clone https://github.com/your-username/github-project-manager-mcp.git

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
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
github-project-manager-mcp/
├── src/                    # Source code
│   └── index.ts           # Main server implementation
├── build/                 # Compiled files
├── tests/                 # Test files
├── docs/                  # Documentation
├── package.json          # Project metadata and dependencies
├── tsconfig.json         # TypeScript configuration
├── README.md            # Project overview
├── CONTRIBUTING.md      # Contribution guidelines
└── LICENSE             # MIT license
```

## Testing

* Write tests for all new features and bug fixes
* Run the existing test suite before submitting a PR
* Follow the existing testing patterns and conventions
* Include both positive and negative test cases

## Additional Notes

### Issue and Pull Request Labels

* `bug`: Something isn't working
* `enhancement`: New feature or request
* `documentation`: Improvements or additions to documentation
* `good first issue`: Good for newcomers
* `help wanted`: Extra attention is needed
* `question`: Further information is requested

## Recognition

Contributors who make significant and valuable contributions will be granted commit access to the project.