module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', // Node 20+ has everything we need
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js'],
  // Remove setupFilesAfterEnv - no polyfills needed!
};
