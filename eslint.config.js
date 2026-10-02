import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['node_modules/', 'coverage/', 'cache/', 'out/', 'res/'],
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
    files: ['src/render/node.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  prettier,
];
