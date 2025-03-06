# Build Configuration Review

## Current Issues
1. Build output directory mismatch (`dist` vs `build`)
2. TypeScript configuration needs adjustment
3. Build script configuration needs updates

## Required Changes

### Package.json Updates
```json
// Current package.json issues
{
  "type": "module",            // Using ES modules
  "exports": "./dist/index.js", // Points to wrong directory
  "scripts": {
    "start": "node dist/index.js" // Wrong output directory
  }
}

// Required changes
{
  "type": "module",
  "exports": "./build/index.js",
  "scripts": {
    "prebuild": "rimraf build",
    "build": "tsc -p tsconfig.build.json",
    "start": "node build/index.js",
    "dev": "ts-node-dev --respawn src/index.ts"
  }
}
```

### TypeScript Configuration
```jsonc
// Current tsconfig.json issues
{
  "outDir": "./dist",  // Wrong output directory
  "module": "commonjs" // Should be ESNext for ES modules
}

// Required changes in tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}

// tsconfig.build.json needs
{
  "extends": "./tsconfig.json",
  "exclude": [
    "node_modules",
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/*.e2e.ts",
    "src/__tests__"
  ]
}
```

### Build Process Steps
1. Clean build directory
2. Compile TypeScript
3. Copy non-TypeScript files
4. Set executable permissions

### Fix Implementation Steps

1. Update Directory Structure
```bash
- build/          # Compiled output
  - index.js
  - domain/
  - infrastructure/
  - services/
- src/            # Source files
  - index.ts
  - domain/
  - infrastructure/
  - services/
```

2. Module Resolution
```typescript
// src/index.ts
import { ProjectManagementService } from './services/ProjectManagementService.js';
// Note: .js extension required for ES modules

// Update all imports to use .js extensions
import { GitHubConfig } from './infrastructure/github/GitHubConfig.js';
```

3. Package Scripts
```bash
# Development
npm run dev      # Run with ts-node-dev
npm run build    # Build production version
npm start        # Run production build
```

## Testing Configuration

### Jest Configuration
```javascript
// jest.config.js
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
};
```

## Error Handling

### Common Build Errors

1. Module Resolution
```typescript
// Error: Cannot find module './Service.js'
// Fix: Add .js extension to imports
import { Service } from './Service.js';
```

2. ES Module Compatibility
```typescript
// Error: require() not defined in ES module scope
// Fix: Use dynamic import() instead
const config = await import('./config.js');
```

3. Type Definitions
```typescript
// Error: Cannot find type definitions
// Fix: Add types to tsconfig.json
{
  "compilerOptions": {
    "types": ["node", "jest"]
  }
}
```

## Deployment Considerations

### Production Build Process
1. Clean build directory
2. Type check
3. Compile TypeScript
4. Copy assets
5. Set permissions

### Node.js Version Requirements
```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Environment Configuration
```bash
# Development
NODE_ENV=development
TS_NODE_PROJECT=tsconfig.json

# Production
NODE_ENV=production
```

## Monitoring and Debugging

### Source Maps
```json
{
  "compilerOptions": {
    "sourceMap": true,
    "inlineSourceMap": false,
    "inlineSources": false
  }
}
```

### Debug Configuration
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Program",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/src/index.ts",
      "preLaunchTask": "tsc: build - tsconfig.json",
      "outFiles": ["${workspaceFolder}/build/**/*.js"]
    }
  ]
}
```

## Next Steps

1. Update build configuration files
2. Test build process
3. Update CI/CD pipeline
4. Update documentation
5. Add build validation tests