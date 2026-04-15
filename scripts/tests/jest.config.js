module.exports = {
  rootDir: '.',
  testMatch: ['<rootDir>/**/*.spec.{js,mjs}'],
  testEnvironment: 'node',
  passWithNoTests: true,
  collectCoverageFrom: [
    '../generate_images.js',
    '../process_images.js',
    '../optimize_scenes.js',
    '../cocos-mcp-proxy.mjs',
  ],
};
