import js from '@eslint/js';
import globals from 'globals';
import tsEslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import googleConfig from 'eslint-config-google';

// Filter out deprecated ESLint rules from eslint-config-google that are not supported in ESLint v9+
const googleRules = { ...googleConfig.rules };
delete googleRules['valid-jsdoc'];
delete googleRules['require-jsdoc'];

export default tsEslint.config(
  {
    ignores: ['dist', 'node_modules'],
  },
  js.configs.recommended,
  ...tsEslint.configs.recommended,
  {
    files: ['**/*.{ts,js}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      parser: tsEslint.parser,
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      // Google style guide base rules (filtered)
      ...googleRules,

      // NexusZen guide enforcements
      '@typescript-eslint/no-explicit-any': 'error',
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      'max-len': ['error', { code: 100, ignoreUrls: true, ignoreComments: true }],
      curly: ['error', 'all'],
      'new-cap': ['error', { capIsNew: false }],

      // Prettier integration
      'prettier/prettier': 'error',
    },
  },
  prettierConfig,
);
