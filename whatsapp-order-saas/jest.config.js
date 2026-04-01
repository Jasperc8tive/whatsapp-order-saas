module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '<rootDir>/components/**/__tests__/**/*.test.tsx',
    '<rootDir>/components/**/__tests__/**/*.test.ts',
    '<rootDir>/components/**/__tests__/**/*.spec.tsx',
    '<rootDir>/components/**/__tests__/**/*.spec.ts',
  ],
};
