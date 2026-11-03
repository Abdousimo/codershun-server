module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
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
