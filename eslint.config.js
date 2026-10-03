import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['node_modules/', 'coverage/', 'cache/', 'out/', 'res/', 'web/dist/'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    // Drawing code runs in both node-canvas and the browser (D5), so it must
    // not rely on Node-only globals.
    files: ['src/render/**/*.js', 'src/model/**/*.js', 'src/config/**/*.js', 'web/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // The server side of the renderer, the one Node-only file in src/render/.
    files: ['src/render/node.js', 'web/vite.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // The frontend (T-C2): React components in JSX.
    files: ['web/**/*.jsx'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  prettier,
];
