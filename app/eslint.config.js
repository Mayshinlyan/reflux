// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'drizzle/*'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Type sizes come from the scale in theme/typography.ts. A one-off size keeps the parent's line height and tracking.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**', 'src/**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: "Property[key.name='fontSize']",
          message: 'Use a typography token (src/theme/typography.ts) instead of a raw fontSize.',
        },
      ],
    },
  },
]);
