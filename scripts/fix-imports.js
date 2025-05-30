#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Walk through build directory and fix imports
function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Recursively process subdirectories
      processDirectory(fullPath);
    } else if (file.endsWith('.js')) {
      // Process JavaScript files
      fixImports(fullPath);
    }
  }
}

// Modify imports to add .js extension
function fixImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Regex patterns to match imports
    const fromImportRegex = /from\s+["']([^"']*?)["']/g;
    const dynamicImportRegex = /import\s*\(\s*["']([^"']*?)["']\s*\)/g;
    
    // Function to process import paths
    function processImportPath(importPath) {
      // Skip if it's not a relative path or already has a file extension or external module
      if (!importPath.startsWith('.') || path.extname(importPath) || importPath.includes('node_modules')) {
        return importPath;
      }
      
      // Special case for directories with index.js files
      const fullPath = path.resolve(path.dirname(filePath), importPath);
      const directoryPath = path.resolve(fullPath);
      const indexPath = path.join(directoryPath, 'index.js');
      
      if (fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory() && 
          fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
        return `${importPath}/index.js`;
      }
      
      // Add .js extension for regular files
      return `${importPath}.js`;
    }
    
    // Fix 'from' imports
    content = content.replace(fromImportRegex, (match, importPath) => {
      const fixedPath = processImportPath(importPath);
      return `from "${fixedPath}"`;
    });
    
    // Fix dynamic imports
    content = content.replace(dynamicImportRegex, (match, importPath) => {
      const fixedPath = processImportPath(importPath);
      return `import("${fixedPath}")`;
    });
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed imports in ${filePath}`);
  } catch (error) {
    process.stderr.write(`Error processing ${filePath}:`, error);
  }
}

// Get the directory paths in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main entry point
const buildDir = path.join(__dirname, '..', 'build');
console.log(`Fixing imports in ${buildDir}...`);
processDirectory(buildDir);
console.log('Done fixing imports.');
