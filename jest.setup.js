// Jest global setup — mocks for native modules that have no implementation in Node.
// Referenced from package.json "jest.setupFiles".

// AsyncStorage is a native module; use the in-memory mock the package ships for Jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
