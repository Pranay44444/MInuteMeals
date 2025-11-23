// Mock AsyncStorage
const mockAsyncStorage = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(() =>
    Promise.resolve({
      uri: 'file://mock/path/compressed.jpg',
      width: 800,
      height: 600,
    })
  ),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
  },
  Action: {},
}));

// Mock expo-file-system/legacy
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(() => Promise.resolve('base64encodedstring')),
  EncodingType: {
    Base64: 'base64',
  },
}), { virtual: true });

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: true })
  ),
  requestMediaLibraryPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: true })
  ),
  launchCameraAsync: jest.fn(() =>
    Promise.resolve({
      canceled: false,
      assets: [{ uri: 'file://mock/path/camera.jpg' }],
    })
  ),
  launchImageLibraryAsync: jest.fn(() =>
    Promise.resolve({
      canceled: false,
      assets: [{ uri: 'file://mock/path/gallery.jpg' }],
    })
  ),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      spoonacularApiKey: 'test-spoonacular-key',
      azureVisionEndpoint: 'https://test.cognitiveservices.azure.com',
      azureVisionKey: 'test-azure-key',
    },
  },
}));

// Mock fetch globally with default Azure Vision response
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        tagsResult: { values: [] },
        objectsResult: { values: [] },
        readResult: { content: '' },
        denseCaptionsResult: { values: [] },
      }),
  })
);

// Silence console during tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock atob for base64 decoding
global.atob = jest.fn((str) => Buffer.from(str, 'base64').toString('binary'));
