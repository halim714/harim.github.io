module.exports = {
  root: true,
  env: { 
    browser: true, 
    es2020: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:jsx-a11y/recommended',
    'prettier'
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parserOptions: { 
    ecmaVersion: 'latest', 
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: ['react-refresh', 'unused-imports', 'import', 'jsx-a11y'],
  rules: {
    'unused-imports/no-unused-imports': 'warn',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/prop-types': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'prefer-const': 'warn',
    'no-var': 'error',
    'import/order': ['warn', { 'newlines-between': 'always' }],
    'react/display-name': 'warn',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-static-element-interactions': 'warn',
    'jsx-a11y/label-has-associated-control': 'warn',
    'jsx-a11y/no-autofocus': 'warn',
    'jsx-a11y/mouse-events-have-key-events': 'warn'
  },
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.*'],
      rules: {
        'no-console': 'off',
      }
    }
  ],
  settings: {
    react: { version: 'detect' },
    'import/resolver': {
      alias: {
        map: [
          ['@utils', './src/utils'],
          ['@components', './src/components'],
          ['@', './src']
        ],
        extensions: ['.js', '.jsx']
      }
    }
  },
} 