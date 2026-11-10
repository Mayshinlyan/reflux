// expo-notifications' native module can't load in Jest. Reminders are allowed by default; tests that care override it.
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
  AndroidImportance: { DEFAULT: 3 },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: true, canAskAgain: true, status: 'granted' }),
  ),
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: true, canAskAgain: true, status: 'granted' }),
  ),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  clearLastNotificationResponseAsync: jest.fn(() => Promise.resolve()),
  useLastNotificationResponse: jest.fn(() => null),
}));

// Gesture Handler's native module can't load in Jest; this is its own stand-in.
require('react-native-gesture-handler/jestSetup');

// Reanimated's native runtime can't load in Jest; sheets, the arch and the tab bar all use it, so every screen test needs the stand-in.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));

// expo-audio's native module can't load in Jest; saving a log chings, so every screen test needs this stub.
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({ play: jest.fn(), seekTo: () => Promise.resolve() }),
  useAudioPlayer: () => ({ play: jest.fn(), seekTo: jest.fn() }),
  setAudioModeAsync: () => Promise.resolve(),
}));
