// expo-audio's native module can't load in Jest; saving a log chings, so every screen test needs this stub.
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({ play: jest.fn(), seekTo: () => Promise.resolve() }),
  useAudioPlayer: () => ({ play: jest.fn(), seekTo: jest.fn() }),
  setAudioModeAsync: () => Promise.resolve(),
}));
