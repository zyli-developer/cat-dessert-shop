import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  rootDir: '..',
  roots: ['<rootDir>/tests', '<rootDir>/assets/scenes/scripts'],
  moduleNameMapper: {
    '^cc$': '<rootDir>/tests/__mocks__/cc.ts',
    '^cc/env$': '<rootDir>/tests/__mocks__/cc-env.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    '<rootDir>/assets/scenes/scripts/core/**/*.ts',
    '<rootDir>/assets/scenes/scripts/data/**/*.ts',
    '<rootDir>/assets/scenes/scripts/net/**/*.ts',
    '!**/*.d.ts',
    '!**/*.spec.ts',
  ],
  coverageThreshold: {
    global: { branches: 40, functions: 45, lines: 70, statements: 60 },
  },
  passWithNoTests: true,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tests/tsconfig.json', useESM: false, diagnostics: false }],
  },
};

export default config;
