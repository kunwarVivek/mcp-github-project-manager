#!/bin/bash

# MCP Test Client - Shell wrapper script
# This script provides a convenient way to test the MCP GitHub Project Manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
MCP_SERVER_PATH="${MCP_SERVER_PATH:-$PROJECT_ROOT/build/index.js}"

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if the project is built
check_build() {
    if [ ! -f "$MCP_SERVER_PATH" ]; then
        print_color $RED "❌ MCP server not found at: $MCP_SERVER_PATH"
        print_color $YELLOW "Please build the project first:"
        print_color $BLUE "  npm run build"
        exit 1
    fi
}

# Function to check environment variables
check_env() {
    local missing_vars=()
    
    if [ -z "$GITHUB_TOKEN" ]; then
        missing_vars+=("GITHUB_TOKEN")
    fi
    
    if [ -z "$GITHUB_OWNER" ]; then
        missing_vars+=("GITHUB_OWNER")
    fi
    
    if [ -z "$GITHUB_REPO" ]; then
        missing_vars+=("GITHUB_REPO")
    fi
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_color $RED "❌ Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            print_color $RED "  - $var"
        done
        print_color $YELLOW "\nPlease set them before running the test client:"
        print_color $BLUE "  export GITHUB_TOKEN=ghp_xxxxxxxxxxxx"
        print_color $BLUE "  export GITHUB_OWNER=myusername"
        print_color $BLUE "  export GITHUB_REPO=myrepo"
        print_color $YELLOW "\nOr create a .env file in the project root with:"
        print_color $BLUE "  GITHUB_TOKEN=ghp_xxxxxxxxxxxx"
        print_color $BLUE "  GITHUB_OWNER=myusername"
        print_color $BLUE "  GITHUB_REPO=myrepo"
        exit 1
    fi
}

# Function to load .env file if it exists
load_env() {
    local env_file="$PROJECT_ROOT/.env"
    if [ -f "$env_file" ]; then
        print_color $CYAN "📄 Loading environment variables from .env file..."
        export $(grep -v '^#' "$env_file" | xargs)
    fi
}

# Function to show help
show_help() {
    print_color $CYAN "MCP Test Client - Shell Wrapper"
    print_color $CYAN "================================"
    echo
    echo "Usage: $0 <command> [options]"
    echo
    print_color $GREEN "Commands:"
    echo "  list-tools          List all available tools"
    echo "  test-tool <name>    Test a specific tool"
    echo "  test-all           Test all tools with sample data"
    echo "  interactive        Enter interactive mode"
    echo "  build              Build the project before testing"
    echo "  help               Show this help message"
    echo
    print_color $GREEN "Quick Start:"
    echo "  # Build the project"
    echo "  $0 build"
    echo
    echo "  # List all tools"
    echo "  $0 list-tools"
    echo
    echo "  # Test all tools"
    echo "  $0 test-all"
    echo
    echo "  # Interactive mode"
    echo "  $0 interactive"
    echo
    print_color $GREEN "Environment Variables:"
    echo "  GITHUB_TOKEN       GitHub personal access token (required)"
    echo "  GITHUB_OWNER       GitHub repository owner (required)"
    echo "  GITHUB_REPO        GitHub repository name (required)"
    echo "  MCP_SERVER_PATH    Path to MCP server (optional)"
}

# Main script logic
main() {
    local command="${1:-help}"
    
    case "$command" in
        "help"|"--help"|"-h")
            show_help
            ;;
        "build")
            print_color $CYAN "🔨 Building the project..."
            cd "$PROJECT_ROOT"
            npm run build
            print_color $GREEN "✅ Build completed successfully"
            ;;
        "list-tools"|"test-tool"|"test-all"|"interactive")
            # Load environment variables
            load_env
            
            # Check if project is built
            check_build
            
            # Check environment variables
            check_env
            
            # Run the Node.js test client
            print_color $CYAN "🚀 Starting MCP test client..."
            cd "$PROJECT_ROOT"
            node scripts/mcp-test-client.js "$@"
            ;;
        *)
            print_color $RED "❌ Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
