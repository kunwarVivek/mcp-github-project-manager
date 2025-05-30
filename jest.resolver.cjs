const path = require('path');
const fs = require('fs');

module.exports = (request, options) => {
  // Handle path aliases
  if (request.startsWith('@/')) {
    const relativePath = request.substring(2);
    return path.resolve(options.rootDir, 'src', relativePath);
  }

  // Handle .js imports that should resolve to .ts files in Jest
  if (request.endsWith('.js')) {
    const tsRequest = request.replace(/\.js$/, '.ts');

    // Check if this is a relative import
    if (request.startsWith('./') || request.startsWith('../')) {
      // Use the directory of the file that's doing the importing
      const basePath = options.basedir;
      const tsFilePath = path.resolve(basePath, tsRequest);

      // Debug logging (commented out for production)
      // console.log('Jest resolver debug:', {
      //   request,
      //   tsRequest,
      //   basePath,
      //   basedir: options.basedir,
      //   allOptions: Object.keys(options),
      //   tsFilePath,
      //   exists: fs.existsSync(tsFilePath)
      // });

      // Check if the .ts file exists
      if (fs.existsSync(tsFilePath)) {
        return options.defaultResolver(tsRequest, {
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
    }
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