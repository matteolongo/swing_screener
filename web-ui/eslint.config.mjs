import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.vite/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', '../../*', '../../../*'],
              message: 'Use @/ alias for cross-folder imports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: [
      'src/pages/Screener.tsx',
      'src/pages/DailyReview.tsx',
      'src/pages/Orders.tsx',
      'src/pages/Positions.tsx',
      'src/components/domain/orders/**/*.tsx',
      'src/components/domain/recommendation/**/*.tsx',
      'src/components/common/ModalShell.tsx',
      'src/components/common/TableShell.tsx',
      'src/components/common/TableState.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/[A-Za-z]/]',
          message: 'Use i18n keys via t(...) for user-facing text.',
        },
        {
          selector:
            'JSXAttribute[name.name=/^(title|placeholder|aria-label)$/] > Literal[value=/[A-Za-z]/]',
          message: 'Use i18n keys via t(...) for user-facing attribute strings.',
        },
      ],
    },
  },
];
