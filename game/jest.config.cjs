module.exports = {
  preset: "jest-preset-angular",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleFileExtensions: ["ts", "html", "js", "json", "mjs"],
  moduleNameMapper: {
    "^@rinner/grayvale-core$": "<rootDir>/../core/src/index.ts",
    // The dialogue package emits .js-relative imports from its public source entry,
    // so the root workspace test flow uses the built CJS artifact that dialogue pretest creates.
    "^@rinner/grayvale-dialogue$": "<rootDir>/../dialogue/dist/index.cjs",
    "^@rinner/grayvale-worldgraph$": "<rootDir>/../worldgraph/src/index.ts",
    "^tslib$": "<rootDir>/../node_modules/tslib/tslib.js"
  },
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
