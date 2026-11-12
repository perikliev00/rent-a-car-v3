// Import js from '@eslint/js'.
import js from '@eslint/js';
// Import reactHooks from 'eslint-plugin-react-hooks'.
import reactHooks from 'eslint-plugin-react-hooks';
// Import reactRefresh from 'eslint-plugin-react-refresh'.
import reactRefresh from 'eslint-plugin-react-refresh';
// Import tseslint from 'typescript-eslint'.
import tseslint from 'typescript-eslint';

// Provide the module's default export.
export default tseslint.config(
  // Contribute this line to the enclosing declaration or statement.
  { ignores: ['dist/**', 'node_modules/**'] },
  // Contribute this line to the enclosing declaration or statement.
  js.configs.recommended,
  // Spread tseslint.configs.recommended into the surrounding structure.
  ...tseslint.configs.recommended,
  {
    // Provide the files field value.
    files: ['**/*.{ts,tsx}'],
    // Provide the plugins field value.
    plugins: {
      // Supply the literal value used by the enclosing expression.
      'react-hooks': reactHooks,
      // Supply the literal value used by the enclosing expression.
      'react-refresh': reactRefresh,
    },
    // Provide the rules field value.
    rules: {
      // Spread reactHooks.configs.recommended.rules into the surrounding structure.
      ...reactHooks.configs.recommended.rules,
      // Supply the literal value used by the enclosing expression.
      'react-hooks/set-state-in-effect': 'off',
      // Supply the literal value used by the enclosing expression.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Provide the files field value.
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    // Provide the rules field value.
    rules: {
      // Supply the literal value used by the enclosing expression.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
