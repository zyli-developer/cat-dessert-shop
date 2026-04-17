module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/tests/**/*.spec.{js,mjs}'],
  testEnvironment: 'node',
  passWithNoTests: true,
  coverageProvider: 'v8',
  coverageDirectory: '<rootDir>/../coverage/raw/scripts',
  collectCoverageFrom: [
    'generate_images.js',
    'process_images.js',
    'optimize_scenes.js',
    'cocos-mcp-proxy.mjs',
  ],
};
