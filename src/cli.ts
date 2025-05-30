import { Command } from 'commander';
import fs from 'fs';
import path from 'path';

// Read version from package.json
let VERSION = '0.1.0';
try {
  // Try to read the version from package.json
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    VERSION = packageJson.version || VERSION;
  }
} catch (error) {
  // Fallback to default version if there's an error
  process.stderr.write('Warning: Could not read version from package.json');
}

export interface CliOptions {
  token?: string;
  owner?: string;
  repo?: string;
  envFile?: string;
  verbose?: boolean;
}

/**
 * Parse command line arguments using Commander
 * @returns Parsed command line options
 */
export function parseCommandLineArgs(): CliOptions {
  const program = new Command();

  program
    .name('mcp-github-project-manager')
    .description('A Model Context Protocol (MCP) server for managing GitHub Projects')
    .version(VERSION)
    .option('-t, --token <token>', 'GitHub personal access token')
    .option('-o, --owner <owner>', 'GitHub repository owner (username or organization)')
    .option('-r, --repo <repo>', 'GitHub repository name')
    .option('-e, --env-file <path>', 'Path to .env file (default: .env in project root)')
    .option('-v, --verbose', 'Enable verbose logging', false)
    .helpOption('-h, --help', 'Display help information')
    .addHelpText('after', `
Examples:
  $ mcp-github-project-manager --token=your_token --owner=your_username --repo=your_repo
  $ mcp-github-project-manager -t your_token -o your_username -r your_repo
  $ mcp-github-project-manager --env-file=.env.production
  $ GITHUB_TOKEN=your_token mcp-github-project-manager

Environment variables:
  GITHUB_TOKEN     GitHub personal access token
  GITHUB_OWNER     GitHub repository owner
  GITHUB_REPO      GitHub repository name
`);

  program.parse();
  return program.opts<CliOptions>();
}
