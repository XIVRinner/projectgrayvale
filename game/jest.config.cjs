module.exports = {
  preset: "jest-preset-angular",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleFileExtensions: ["ts", "html", "js", "json", "mjs"],
  testMatch: ["**/?(*.)+(spec).ts"],
  testPathIgnorePatterns: ["<rootDir>/e2e/", "<rootDir>/node_modules/"],
  transform: {
    "^.+\\.(ts|mjs|js|html)$": [
      "jest-preset-angular",
      {
        tsconfig: "<rootDir>/tsconfig.spec.json",
        stringifyContentPathRegex: "\\.html$"
      }
    ]
  },
  transformIgnorePatterns: ["node_modules/(?!(.*\\.mjs$|@angular|rxjs|tslib))"],
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts", "!src/polyfills.ts"]
};
