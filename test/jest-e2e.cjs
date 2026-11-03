module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  rootDir: ".",
  testRegex: ".*\\.e2e-spec\\.ts$",
  moduleFileExtensions: ["js", "json", "ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          types: ["jest", "node"],
          verbatimModuleSyntax: false,
        },
      },
    ],
  },
};

