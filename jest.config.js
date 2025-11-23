module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|expo-.*|@expo-google-fonts|react-native-.*|@react-navigation|@react-native-community)/)',
  ],
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
  testMatch: [
    '**/__tests__/**/*.(test|spec).(js|jsx)',
    '**/*.(test|spec).(js|jsx)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/__tests__/**',
  ],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  testEnvironment: 'node',
};
