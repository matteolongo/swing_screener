import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Token-only color policy: no hardcoded Tailwind palette colors or dark: variants.
// The app is dark-only and driven by semantic design tokens (see docs/DESIGN_TOKENS.md).
// These selectors are shared so any block that sets `no-restricted-syntax` keeps the
// color ban (flat config does not merge a rule's options across blocks — last wins).
const COLOR_PALETTE =
  '(?:bg|text|border|divide|ring|fill|stroke|from|via|to|outline|placeholder|caret|accent|decoration)-(?:gray|slate|zinc|neutral|stone|blue|sky|indigo|purple|violet|fuchsia|cyan|pink|rose|red|orange|amber|yellow|lime|green|emerald|teal)-[0-9]';
const TOKEN_MSG =
  'Use a semantic design token (surface/foreground/muted/border/primary/success/danger/warning), not a hardcoded Tailwind palette color. See docs/DESIGN_TOKENS.md.';
const DARK_MSG = 'The app is dark-only; drop dark: variants and use the base token.';

const colorSelectors = [
  { selector: `Literal[value=/${COLOR_PALETTE}/]`, message: TOKEN_MSG },
  { selector: `TemplateElement[value.cooked=/${COLOR_PALETTE}/]`, message: TOKEN_MSG },
  { selector: 'Literal[value=/(?:^|\\s)dark:/]', message: DARK_MSG },
  { selector: 'TemplateElement[value.cooked=/(?:^|\\s)dark:/]', message: DARK_MSG },
];

const i18nSelectors = [
  { selector: 'JSXText[value=/[A-Za-z]/]', message: 'Use i18n keys via t(...) for user-facing text.' },
  {
    selector: 'JSXAttribute[name.name=/^(title|placeholder|aria-label)$/] > Literal[value=/[A-Za-z]/]',
    message: 'Use i18n keys via t(...) for user-facing attribute strings.',
  },
];

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
    // color policy for all non-test source
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...colorSelectors],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // i18n-enforced surfaces: keep the color ban AND add the i18n ban
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
      'no-restricted-syntax': ['error', ...colorSelectors, ...i18nSelectors],
    },
  },
];
