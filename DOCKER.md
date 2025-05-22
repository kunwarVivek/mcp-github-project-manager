# Docker Support

This project includes Docker support to make deployment and development easier.

## Prerequisites

- Docker installed on your system
- GitHub token, owner, and repository information for the `.env` file

## Environment Variables

Make sure to set the following environment variables in your `.env` file:

```
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=your_github_username_or_organization
GITHUB_REPO=your_repository_name
```

## Building the Docker Image

```bash
docker build -t mcp-github-project-manager .
```

## Running the Container

```bash
# Run the container with your .env file
docker run -it --env-file .env mcp-github-project-manager

# Alternatively, you can provide environment variables directly
docker run -it \
  -e GITHUB_TOKEN=your_github_token \
  -e GITHUB_OWNER=your_github_username_or_organization \
  -e GITHUB_REPO=your_repository_name \
  mcp-github-project-manager
```

## Development with Docker

For development purposes, you can mount your local source directory into the container:

```bash
docker run -it \
  --env-file .env \
  -v $(pwd)/src:/app/src \
  mcp-github-project-manager
```

This allows you to make changes to your source code and see them reflected in the container.
