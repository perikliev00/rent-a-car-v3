// Assign the CommonJS module exports.
module.exports = [
  {
    // Provide the ignores field value.
    ignores: [
      // Supply the literal value used by the enclosing expression.
      'node_modules/**',
      // Supply the literal value used by the enclosing expression.
      'coverage/**',
      // Supply the literal value used by the enclosing expression.
      'dist/**',
      // Supply the literal value used by the enclosing expression.
      'src/public/**',
    ],
  },
  {
    // Provide the files field value.
    files: ['**/*.js'],
    // Provide the language options field value.
    languageOptions: {
      // Provide the ecma version field value.
      ecmaVersion: 2022,
      // Provide the source type field value.
      sourceType: 'commonjs',
      // Provide the globals field value.
      globals: {
        // Provide the buffer field value.
        Buffer: 'readonly',
        // Provide the dirname field value.
        __dirname: 'readonly',
        // Provide the filename field value.
        __filename: 'readonly',
        // Provide the clear interval field value.
        clearInterval: 'readonly',
        // Provide the clear timeout field value.
        clearTimeout: 'readonly',
        // Provide the console field value.
        console: 'readonly',
        // Provide the exports field value.
        exports: 'readonly',
        // Provide the global field value.
        global: 'readonly',
        // Provide the module field value.
        module: 'readonly',
        // Provide the process field value.
        process: 'readonly',
        // Provide the require field value.
        require: 'readonly',
        // Provide the set interval field value.
        setInterval: 'readonly',
        // Provide the set timeout field value.
        setTimeout: 'readonly',
      },
    },
    // Provide the rules field value.
    rules: {
      // Supply the literal value used by the enclosing expression.
      'no-console': 'off',
      // Supply the literal value used by the enclosing expression.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Supply the literal value used by the enclosing expression.
      'no-undef': 'error',
      // Supply the literal value used by the enclosing expression.
      'no-unreachable': 'error',
      // Supply the literal value used by the enclosing expression.
      'no-duplicate-case': 'error',
      // Supply the literal value used by the enclosing expression.
      'eqeqeq': ['warn', 'smart'],
    },
  },
  {
    // Provide the files field value.
    files: ['tests/**/*.js'],
    // Provide the language options field value.
    languageOptions: {
      // Provide the globals field value.
      globals: {
        // Provide the describe field value.
        describe: 'readonly',
        // Provide the test field value.
        test: 'readonly',
        // Provide the expect field value.
        expect: 'readonly',
        // Provide the before all field value.
        beforeAll: 'readonly',
        // Provide the after all field value.
        afterAll: 'readonly',
        // Provide the before each field value.
        beforeEach: 'readonly',
        // Provide the after each field value.
        afterEach: 'readonly',
        // Provide the jest field value.
        jest: 'readonly',
      },
    },
  },
];
