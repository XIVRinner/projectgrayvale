/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/src/**/*.spec.ts"],
  globals: {
    "ts-jest": {
      tsconfig: {
        types: ["node", "jest"],
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
    },
  },
};
