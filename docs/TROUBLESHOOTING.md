# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the MCP GitHub Project Manager.

## Quick Diagnosis

### Check Server Status

```bash
# Test if the server starts successfully
mcp-github-project-manager --verbose

# Check environment variables are set
env | grep -E "GITHUB_|ANTHROPIC_|OPENAI_"
```

### Enable Debug Logging

```bash
# Set debug logging
export LOG_LEVEL=debug

# Or in your .env file
LOG_LEVEL=debug

# Then restart the server
mcp-github-project-manager
```

### Verify Configuration

```bash
# Check required variables
echo "GITHUB_TOKEN: ${GITHUB_TOKEN:0:10}..."
echo "GITHUB_OWNER: $GITHUB_OWNER"
echo "GITHUB_REPO: $GITHUB_REPO"
```

---

## Common Issues

### Authentication Errors

#### "Bad credentials"

**Symptoms:**
- Server returns 401 error
- "Bad credentials" message in logs

**Causes:**
- Token is invalid, expired, or revoked
- Token was copied incorrectly (extra spaces/newlines)

**Solutions:**

1. **Verify token format:**
   ```bash
   # Token should start with ghp_, gho_, or github_pat_
   echo $GITHUB_TOKEN | head -c 10
   ```

2. **Regenerate token:**
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Delete the old token
   - Generate a new token with required scopes
   - Update your configuration

3. **Check for copy errors:**
   ```bash
   # Remove any whitespace
   export GITHUB_TOKEN=$(echo "$GITHUB_TOKEN" | tr -d '[:space:]')
   ```

---

#### "Resource not accessible by integration"

**Symptoms:**
- 403 Forbidden error
- "Resource not accessible" message

**Causes:**
- Token lacks required scopes
- Token doesn't have access to the repository
- Using fine-grained token without proper permissions

**Solutions:**

1. **Check token scopes:**
   Required scopes:
   - `repo` (Full repository access)
   - `project` (Project board access)
   - `write:org` (For organization projects)

2. **Verify repository access:**
   ```bash
   # Test with curl
   curl -H "Authorization: Bearer $GITHUB_TOKEN" \
     https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO
   ```

3. **For fine-grained tokens:**
   Ensure these permissions are enabled:
   - Repository: Read and write
   - Projects: Read and write
   - Issues: Read and write

---

#### "Not Found" (404)

**Symptoms:**
- 404 error when accessing resources
- "Not found" message

**Causes:**
- Wrong owner or repository name
- Private repository without access
- Resource doesn't exist

**Solutions:**

1. **Verify owner and repo:**
   ```bash
   # Check values
   echo "Owner: $GITHUB_OWNER, Repo: $GITHUB_REPO"

   # Test API access
   curl -H "Authorization: Bearer $GITHUB_TOKEN" \
     "https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO"
   ```

2. **Check repository visibility:**
   - For private repos, ensure token has `repo` scope
   - For organization repos, ensure you're a member

3. **Verify resource exists:**
   - Check the project/issue/milestone exists in GitHub UI

---

### Connection Issues

#### "ECONNREFUSED"

**Symptoms:**
- Connection refused error
- Server doesn't respond

**Causes:**
- Server not running
- Firewall blocking connection
- Wrong port/host

**Solutions:**

1. **Verify server is running:**
   ```bash
   # Start the server
   mcp-github-project-manager
   ```

2. **Check network connectivity:**
   ```bash
   # Test GitHub API
   curl https://api.github.com
   ```

3. **Check firewall settings:**
   - Ensure outbound HTTPS (443) is allowed
   - Allow connections to api.github.com

---

#### "Timeout" errors

**Symptoms:**
- Operations take too long
- Timeout error messages

**Causes:**
- Slow network connection
- GitHub API is slow or down
- Large response sizes

**Solutions:**

1. **Check GitHub status:**
   Visit [GitHub Status](https://www.githubstatus.com/)

2. **Reduce request scope:**
   - Use pagination for large lists
   - Filter results where possible

3. **Check network:**
   ```bash
   # Test latency
   ping api.github.com
   ```

---

#### Server doesn't start

**Symptoms:**
- No output when starting server
- Module not found errors

**Causes:**
- Package not built
- Node.js version incompatible
- Dependencies not installed

**Solutions:**

1. **If installed from npm:**
   ```bash
   # Reinstall the package
   npm install -g mcp-github-project-manager --force
   ```

2. **If running from source:**
   ```bash
   # Rebuild
   npm install
   npm run build
   ```

3. **Check Node.js version:**
   ```bash
   # Requires Node.js 18+
   node --version
   ```

---

### MCP Client Issues

#### Claude Desktop: Server not appearing

**Symptoms:**
- MCP server not listed in Claude
- Tools not available

**Solutions:**

1. **Verify config file location:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. **Validate JSON syntax:**
   ```bash
   # Check for JSON errors
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq .
   ```

3. **Restart Claude Desktop:**
   - Quit completely (not just close window)
   - Reopen Claude Desktop

4. **Check logs:**
   - View Claude Desktop logs for connection errors

---

#### Cursor: Connection failed

**Symptoms:**
- "Connection failed" in Cursor
- MCP tools not working

**Solutions:**

1. **Verify npx can run the package:**
   ```bash
   npx -y mcp-github-project-manager --help
   ```

2. **Try with bunx:**
   ```json
   {
     "mcpServers": {
       "github-project-manager": {
         "command": "bunx",
         "args": ["-y", "mcp-github-project-manager"]
       }
     }
   }
   ```

3. **Check Cursor MCP settings:**
   - Settings > MCP > Verify configuration

---

#### VS Code: Extension not connecting

**Symptoms:**
- MCP extension shows disconnected
- Tools not available

**Solutions:**

1. **Verify MCP extension is installed:**
   - Check Extensions panel for MCP extension

2. **Check configuration format:**
   ```json
   {
     "servers": {
       "github-project-manager": {
         "type": "stdio",
         "command": "npx",
         "args": ["-y", "mcp-github-project-manager"]
       }
     }
   }
   ```

3. **Check VS Code output:**
   - View > Output > Select "MCP" from dropdown

---

#### Windows-Specific Issues

**Symptoms:**
- Server fails to start on Windows
- Command not found errors

**Solutions:**

Use `cmd` wrapper in MCP config:

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "mcp-github-project-manager"
      ],
      "env": {
        "GITHUB_TOKEN": "your_token"
      }
    }
  }
}
```

---

### AI Feature Issues

#### "AI provider not configured"

**Symptoms:**
- AI tools return configuration error
- PRD generation fails

**Causes:**
- No AI API key set
- Invalid API key format

**Solutions:**

1. **Set at least one API key:**
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-xxxx
   # Or
   export OPENAI_API_KEY=sk-xxxx
   ```

2. **Verify key format:**
   - Anthropic: starts with `sk-ant-`
   - OpenAI: starts with `sk-`
   - Google: alphanumeric string
   - Perplexity: starts with `pplx-`

---

#### "Rate limited"

**Symptoms:**
- 429 error responses
- "Rate limit exceeded" message

**Causes:**
- Too many requests in short time
- API quota exceeded

**Solutions:**

1. **Wait and retry:**
   - GitHub: wait 1 minute
   - AI providers: check your plan limits

2. **Reduce request frequency:**
   - Add delays between batch operations
   - Use smaller batch sizes

3. **Check API usage:**
   - GitHub: `curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/rate_limit`
   - AI providers: check usage dashboard

---

#### Fallback mode active

**Symptoms:**
- AI features work but with reduced quality
- "Using fallback provider" in logs

**Causes:**
- Primary AI provider unavailable
- API key invalid for primary provider

**Solutions:**

1. **This is normal behavior:**
   The server automatically falls back to alternative providers

2. **Check primary provider:**
   - Verify API key is correct
   - Check provider status page
   - Verify billing/quota status

---

### GitHub API Issues

#### "Secondary rate limit"

**Symptoms:**
- 403 error with abuse message
- Operations blocked temporarily

**Causes:**
- Too many concurrent requests
- Large mutations in short time

**Solutions:**

1. **Wait 1-5 minutes:**
   Secondary rate limits are temporary

2. **Reduce concurrency:**
   - Don't run parallel operations
   - Add delays between requests

---

#### "GraphQL errors"

**Symptoms:**
- GraphQL query errors
- Partial data returned

**Causes:**
- Invalid query parameters
- Schema changes
- Permission issues

**Solutions:**

1. **Check parameters:**
   - Verify project/issue IDs are valid
   - Check field names match schema

2. **Update package:**
   ```bash
   npm update -g mcp-github-project-manager
   ```

---

#### "Project not found"

**Symptoms:**
- Cannot find project by ID
- Project operations fail

**Causes:**
- Invalid project ID format
- Project deleted or access revoked

**Solutions:**

1. **Verify project ID format:**
   - Projects v2 use GraphQL node IDs (e.g., `PVT_xxxxx`)
   - Get ID from project URL or use `list_projects`

2. **Check project access:**
   - Verify you have access in GitHub UI
   - Ensure token has `project` scope

---

## Debug Mode

### Enabling Debug Logging

```bash
# Via environment variable
export LOG_LEVEL=debug
mcp-github-project-manager

# Via command line
mcp-github-project-manager --verbose
```

### What to Look For

Debug logs show:
- API requests and responses
- Authentication attempts
- Rate limit status
- Tool invocation details

### Example Debug Output

```
[DEBUG] GitHub API request: GET /repos/owner/repo
[DEBUG] Response: 200 OK (123ms)
[DEBUG] Rate limit: 4999/5000 remaining
[DEBUG] Tool invocation: create_issue
[DEBUG] Parameters: { title: "...", body: "..." }
```

---

## Getting Help

### Reporting Bugs

When reporting issues, include:

1. **Environment info:**
   ```bash
   node --version
   npm --version
   mcp-github-project-manager --version
   ```

2. **Debug logs:**
   Run with `LOG_LEVEL=debug` and capture output

3. **Steps to reproduce:**
   What exactly did you do?

4. **Expected vs actual:**
   What did you expect? What happened?

### GitHub Issues

Report bugs and feature requests at:
[GitHub Issues](https://github.com/kunwarVivek/mcp-github-project-manager/issues)

### Required Information for Bug Reports

```markdown
**Environment:**
- OS: [e.g., macOS 14.0]
- Node.js: [e.g., v20.10.0]
- Package version: [e.g., 1.0.0]
- MCP client: [e.g., Claude Desktop]

**Description:**
[What happened?]

**Steps to Reproduce:**
1. [First step]
2. [Second step]
3. [See error]

**Expected Behavior:**
[What should have happened?]

**Debug Logs:**
```
[paste relevant logs here]
```
```

---

## See Also

- [Configuration Guide](CONFIGURATION.md) - Complete configuration reference
- [Tool Reference](TOOLS.md) - All 119 MCP tools documented
- [API Reference](API.md) - Service and infrastructure APIs
