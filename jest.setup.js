// Jest global setup — mocks for native modules that have no implementation in Node.
// Referenced from package.json "jest.setupFiles".

// AsyncStorage is a native module; use the in-memory mock the package ships for Jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Sign in with Apple is a native module; Jest gets a stub whose availability is
// off by default so screen tests opt in explicitly.
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  signInAsync: jest.fn(),
  AppleAuthenticationButton: 'AppleAuthenticationButton',
  AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
  AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

// Google's SDK is native too; hasPlayServices resolves so the iOS path is exercised.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS' },
}));

// expo-crypto's digestStringAsync has no working implementation under jest-expo's
// Node test environment (it silently resolves to an empty string). getRandomBytes
// does work natively, but we mock the whole module for a consistent surface, hashing
// for real with node:crypto so tests that assert on the hashed value stay honest.
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { HEX: 'hex', BASE64: 'base64' },
    getRandomBytes: (byteCount) => nodeCrypto.randomBytes(byteCount),
    getRandomBytesAsync: async (byteCount) => nodeCrypto.randomBytes(byteCount),
    digestStringAsync: async (algorithm, data) => {
      const algo = algorithm === 'SHA-256' ? 'sha256' : algorithm.toLowerCase().replace('-', '');
      return nodeCrypto.createHash(algo).update(data).digest('hex');
    },
  };
});
