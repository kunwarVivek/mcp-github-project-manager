const path = require('path');

module.exports = (request, options) => {
  // Handle path aliases
  if (request.startsWith('@/')) {
    const relativePath = request.substring(2);
    return path.resolve(options.rootDir, 'src', relativePath);
  }

  // Handle TypeScript extensions
  if (request.endsWith('.ts')) {
    return options.defaultResolver(request, {
      ...options,
      packageFilter: pkg => {
        if (pkg.type === 'module') {
          delete pkg.exports;
          delete pkg.type;
        }
        return pkg;
      },
    });
  }

  // Default resolver
  return options.defaultResolver(request, options);
};