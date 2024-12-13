/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
        useESM: true,
      },
    ],
    "^.+\\.jsx?$": [
      "babel-jest",
      {
        presets: [["@babel/preset-env", { targets: { node: "current" } }]],
      },
    ],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(@octokit|@modelcontextprotocol|universal-user-agent|before-after-hook)/)",
  ],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@octokit/rest$": "<rootDir>/node_modules/@octokit/rest/dist-src/index.js",
    "^@octokit/(.*)$": "<rootDir>/node_modules/@octokit/$1/dist-src/index.js",
    "^@modelcontextprotocol/sdk/(.*)$":
      "<rootDir>/node_modules/@modelcontextprotocol/sdk/dist/$1",
    "^@modelcontextprotocol/sdk$":
      "<rootDir>/node_modules/@modelcontextprotocol/sdk/dist/index.js",
    "^before-after-hook$":
      "<rootDir>/node_modules/before-after-hook/lib/register.js",
  },
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/__tests__/**",
    "!src/types/**",
    "!src/**/*.d.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
