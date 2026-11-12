// Import named exports from '@testing-library/react'.
import { configure } from '@testing-library/react';
// Load side effects from '@testing-library/jest-dom/vitest'.
import '@testing-library/jest-dom/vitest';

// Call configure to perform this step.
configure({ asyncUtilTimeout: 5000 });
