#!/bin/bash

# Demo script for MCP Test Client
# This script demonstrates how to use the MCP test client with sample data

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to print section header
print_section() {
    echo
    print_color $CYAN "================================"
    print_color $CYAN "$1"
    print_color $CYAN "================================"
    echo
}

# Function to pause for user input
pause() {
    echo
    print_color $YELLOW "Press Enter to continue..."
    read -r
}

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_color $MAGENTA "🎬 MCP Test Client Demo"
print_color $MAGENTA "======================="
echo
print_color $BLUE "This demo will show you how to use the MCP test client to test"
print_color $BLUE "all the tools provided by the MCP GitHub Project Manager server."
echo
print_color $YELLOW "Prerequisites:"
print_color $YELLOW "- Project must be built (npm run build)"
print_color $YELLOW "- Environment variables must be set:"
print_color $YELLOW "  * GITHUB_TOKEN"
print_color $YELLOW "  * GITHUB_OWNER" 
print_color $YELLOW "  * GITHUB_REPO"
echo

# Check if environment variables are set
if [ -z "$GITHUB_TOKEN" ] || [ -z "$GITHUB_OWNER" ] || [ -z "$GITHUB_REPO" ]; then
    print_color $RED "❌ Environment variables not set!"
    print_color $YELLOW "Please set them first:"
    print_color $BLUE "  export GITHUB_TOKEN=ghp_xxxxxxxxxxxx"
    print_color $BLUE "  export GITHUB_OWNER=your-username"
    print_color $BLUE "  export GITHUB_REPO=your-repo"
    echo
    print_color $YELLOW "Or create a .env file in the project root."
    exit 1
fi

print_color $GREEN "✅ Environment variables are set!"
print_color $GREEN "  GITHUB_OWNER: $GITHUB_OWNER"
print_color $GREEN "  GITHUB_REPO: $GITHUB_REPO"
print_color $GREEN "  GITHUB_TOKEN: ${GITHUB_TOKEN:0:10}..."

pause

# Demo 1: Show help
print_section "Demo 1: Show Help"
print_color $BLUE "Let's start by showing the help message:"
echo
print_color $CYAN "Command: ./scripts/test-mcp.sh help"
echo
./scripts/test-mcp.sh help

pause

# Demo 2: List all tools
print_section "Demo 2: List All Available Tools"
print_color $BLUE "Now let's see what tools are available:"
echo
print_color $CYAN "Command: ./scripts/test-mcp.sh list-tools"
echo
./scripts/test-mcp.sh list-tools

pause

# Demo 3: Test a specific tool
print_section "Demo 3: Test a Specific Tool"
print_color $BLUE "Let's test the 'list_projects' tool with sample data:"
echo
print_color $CYAN "Command: ./scripts/test-mcp.sh test-tool list_projects"
echo
./scripts/test-mcp.sh test-tool list_projects

pause

# Demo 4: Test an AI tool
print_section "Demo 4: Test an AI Tool"
print_color $BLUE "Now let's test an AI-powered tool - 'generate_prd':"
print_color $BLUE "This will generate a Product Requirements Document using AI."
echo
print_color $CYAN "Command: ./scripts/test-mcp.sh test-tool generate_prd"
echo
./scripts/test-mcp.sh test-tool generate_prd

pause

# Demo 5: Interactive mode demo
print_section "Demo 5: Interactive Mode"
print_color $BLUE "The test client also has an interactive mode."
print_color $BLUE "In interactive mode, you can:"
print_color $YELLOW "  - List tools"
print_color $YELLOW "  - Test tools with sample data"
print_color $YELLOW "  - Call tools with custom arguments"
print_color $YELLOW "  - View tool schemas"
echo
print_color $BLUE "To start interactive mode, run:"
print_color $CYAN "  ./scripts/test-mcp.sh interactive"
echo
print_color $BLUE "Interactive commands include:"
print_color $GREEN "  help                 - Show help"
print_color $GREEN "  list                 - List all tools"
print_color $GREEN "  test <tool-name>     - Test a tool"
print_color $GREEN "  call <tool-name>     - Call with custom args"
print_color $GREEN "  schema <tool-name>   - Show tool schema"
print_color $GREEN "  exit                 - Exit interactive mode"

pause

# Demo 6: Show sample data
print_section "Demo 6: Available Sample Data"
print_color $BLUE "The test client includes sample data for these tools:"
echo
print_color $GREEN "Project Management Tools:"
print_color $YELLOW "  - create_project, create_milestone, create_issue"
print_color $YELLOW "  - create_sprint, create_label"
print_color $YELLOW "  - list_projects, list_milestones, list_issues"
echo
print_color $GREEN "Planning & Analytics:"
print_color $YELLOW "  - create_roadmap, get_upcoming_milestones"
print_color $YELLOW "  - get_overdue_milestones"
echo
print_color $GREEN "AI Task Management:"
print_color $YELLOW "  - generate_prd, parse_prd, enhance_prd"
print_color $YELLOW "  - get_next_task, analyze_task_complexity"
print_color $YELLOW "  - expand_task, add_feature"
print_color $YELLOW "  - create_traceability_matrix"

pause

# Demo 7: Test all tools
print_section "Demo 7: Test All Tools (Optional)"
print_color $BLUE "You can test all tools at once with:"
print_color $CYAN "  ./scripts/test-mcp.sh test-all"
echo
print_color $YELLOW "⚠️  Warning: This will make many API calls to GitHub and AI services."
print_color $YELLOW "It may take several minutes and could hit rate limits."
echo
print_color $BLUE "Would you like to run the full test suite? (y/N)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo
    print_color $CYAN "Running full test suite..."
    ./scripts/test-mcp.sh test-all
else
    print_color $YELLOW "Skipping full test suite."
fi

pause

# Demo conclusion
print_section "Demo Complete!"
print_color $GREEN "🎉 You've seen how to use the MCP test client!"
echo
print_color $BLUE "Key takeaways:"
print_color $YELLOW "  ✓ Use './scripts/test-mcp.sh help' for usage info"
print_color $YELLOW "  ✓ Use 'list-tools' to see available tools"
print_color $YELLOW "  ✓ Use 'test-tool <name>' to test specific tools"
print_color $YELLOW "  ✓ Use 'interactive' for manual testing"
print_color $YELLOW "  ✓ Use 'test-all' for comprehensive testing"
echo
print_color $BLUE "Next steps:"
print_color $YELLOW "  - Try the interactive mode"
print_color $YELLOW "  - Test tools relevant to your use case"
print_color $YELLOW "  - Add sample data for additional tools"
print_color $YELLOW "  - Integrate with your CI/CD pipeline"
echo
print_color $MAGENTA "Happy testing! 🚀"
