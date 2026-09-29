module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  // Metro resolves lucide's ESM build; Jest needs its CommonJS build.
  moduleNameMapper: {
    // `@/assets/*` lives outside src (see tsconfig paths); must come before the generic `@/*` mapping.
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|react-native-svg|lucide-react-native)',
  ],
};
