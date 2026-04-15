import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  rootDir: '.',
  roots: ['<rootDir>'],
  moduleNameMapper: {
    '^cc$': '<rootDir>/__mocks__/cc.ts',
    '^cc/env$': '<rootDir>/__mocks__/cc-env.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  collectCoverageFrom: [
    '../assets/scenes/scripts/core/**/*.ts',
    '../assets/scenes/scripts/data/**/*.ts',
    '../assets/scenes/scripts/net/**/*.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 90, lines: 85, statements: 85 },
  },
  passWithNoTests: true,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.json', useESM: false, diagnostics: false }],
  },
};

export default config;
