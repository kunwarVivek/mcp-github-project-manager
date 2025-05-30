#!/usr/bin/env node

/**
 * Comprehensive E2E Test Runner for MCP Tools
 *
 * This script provides an easy way to run the comprehensive E2E test suite
 * with various options and configurations.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader() {
  console.log(colorize('\n🧪 MCP Tools Comprehensive E2E Test Runner', 'cyan'));
  console.log(colorize('=' .repeat(50), 'cyan'));
}

function printUsage() {
  console.log(colorize('\nUsage:', 'bright'));
  console.log('  node scripts/run-e2e-tests.js [options]');
  
  console.log(colorize('\nOptions:', 'bright'));
  console.log('  --help, -h              Show this help message');
  console.log('  --real-api              Use real APIs instead of mocks');
  console.log('  --github-only           Run only GitHub tool tests');
  console.log('  --ai-only               Run only AI tool tests');
  console.log('  --workflows-only        Run only workflow integration tests');
  console.log('  --build                 Build the project before running tests');
  console.log('  --verbose               Enable verbose output');
  console.log('  --timeout <seconds>     Set test timeout (default: 60)');
  
  console.log(colorize('\nExamples:', 'bright'));
  console.log('  node scripts/run-e2e-tests.js');
  console.log('  node scripts/run-e2e-tests.js --real-api --github-only');
  console.log('  node scripts/run-e2e-tests.js --build --verbose');
  console.log('  node scripts/run-e2e-tests.js --ai-only --timeout 120');
}

function checkEnvironment() {
  console.log(colorize('\n🔍 Checking Environment...', 'yellow'));
  
  // Check if build exists
  const buildPath = path.join(process.cwd(), 'build', 'index.js');
  if (!existsSync(buildPath)) {
    console.log(colorize('⚠️  Build not found. Run with --build flag or run "npm run build" first.', 'yellow'));
    return false;
  }
  
  // Check environment variables
  const requiredEnvVars = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log(colorize(`⚠️  Missing environment variables: ${missingVars.join(', ')}`, 'yellow'));
    console.log(colorize('   Tests will run with mock values.', 'yellow'));
  }
  
  // Check AI API keys
  const aiKeys = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GOOGLE_API_KEY', 'PERPLEXITY_API_KEY'];
  const hasAIKey = aiKeys.some(key => process.env[key]);
  
  if (!hasAIKey) {
    console.log(colorize('⚠️  No AI API keys found. AI tests will use mock responses.', 'yellow'));
  }
  
  console.log(colorize('✅ Environment check complete.', 'green'));
  return true;
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(colorize(`\n🚀 Running: ${command} ${args.join(' ')}`, 'blue'));
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function buildProject() {
  console.log(colorize('\n🔨 Building project...', 'yellow'));
  try {
    await runCommand('npm', ['run', 'build']);
    console.log(colorize('✅ Build completed successfully.', 'green'));
  } catch (error) {
    console.error(colorize('❌ Build failed:', 'red'), error.message);
    process.exit(1);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    help: false,
    realApi: false,
    githubOnly: false,
    aiOnly: false,
    workflowsOnly: false,
    build: false,
    verbose: false,
    timeout: 60
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--real-api':
        options.realApi = true;
        break;
      case '--github-only':
        options.githubOnly = true;
        break;
      case '--ai-only':
        options.aiOnly = true;
        break;
      case '--workflows-only':
        options.workflowsOnly = true;
        break;
      case '--build':
        options.build = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--timeout':
        if (i + 1 < args.length) {
          options.timeout = parseInt(args[i + 1], 10);
          i++; // Skip next argument
        }
        break;
      default:
        console.log(colorize(`⚠️  Unknown option: ${arg}`, 'yellow'));
    }
  }
  
  return options;
}

function buildTestCommand(options) {
  const baseCommand = ['node', '--experimental-vm-modules', 'node_modules/jest/bin/jest.js'];
  const args = [...baseCommand, '--config', 'jest.e2e.tools.config.js'];
  
  // Add test pattern based on options
  if (options.githubOnly) {
    args.push('--testPathPattern=github-project-tools');
  } else if (options.aiOnly) {
    args.push('--testPathPattern=ai-task-tools');
  } else if (options.workflowsOnly) {
    args.push('--testPathPattern=tool-integration-workflows');
  }
  
  // Add verbose flag
  if (options.verbose) {
    args.push('--verbose');
  }
  
  // Set environment variables
  const env = { ...process.env };
  
  if (options.realApi) {
    env.E2E_REAL_API = 'true';
  }
  
  if (options.timeout !== 60) {
    env.JEST_TIMEOUT = (options.timeout * 1000).toString();
  }
  
  return { command: args[0], args: args.slice(1), env };
}

async function runTests(options) {
  const { command, args, env } = buildTestCommand(options);
  
  console.log(colorize('\n📋 Test Configuration:', 'cyan'));
  console.log(`  Mode: ${options.realApi ? 'Real API' : 'Mock API'}`);
  console.log(`  Scope: ${options.githubOnly ? 'GitHub Tools' : options.aiOnly ? 'AI Tools' : options.workflowsOnly ? 'Workflows' : 'All Tools'}`);
  console.log(`  Timeout: ${options.timeout} seconds`);
  console.log(`  Verbose: ${options.verbose ? 'Yes' : 'No'}`);
  
  try {
    await runCommand(command, args, { env });
    console.log(colorize('\n✅ All tests completed successfully!', 'green'));
  } catch (error) {
    console.error(colorize('\n❌ Tests failed:', 'red'), error.message);
    process.exit(1);
  }
}

async function main() {
  printHeader();
  
  const options = parseArgs();
  
  if (options.help) {
    printUsage();
    return;
  }
  
  // Build project if requested
  if (options.build) {
    await buildProject();
  }
  
  // Check environment
  if (!checkEnvironment()) {
    console.log(colorize('\n⚠️  Environment issues detected. Continuing with available configuration...', 'yellow'));
  }
  
  // Run tests
  await runTests(options);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(colorize('\n💥 Uncaught Exception:', 'red'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(colorize('\n💥 Unhandled Rejection:', 'red'), reason);
  process.exit(1);
});

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(colorize('\n💥 Script failed:', 'red'), error);
    process.exit(1);
  });
}

export { main, parseArgs, buildTestCommand };
