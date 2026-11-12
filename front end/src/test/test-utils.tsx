// Import named exports from '@tanstack/react-query'.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Import named exports from '@testing-library/react'.
import { render, type RenderOptions } from '@testing-library/react';
// Contribute this line to the enclosing declaration or statement.
import type { ReactElement, ReactNode } from 'react';
// Import named exports from 'react-router-dom'.
import { MemoryRouter, Route, Routes } from 'react-router-dom';
// Import named exports from '../auth/AuthProvider'.
import { AuthProvider } from '../auth/AuthProvider';
// Import named exports from '../utils/searchParams'.
import { defaultSearchParams, searchParamsToQuery } from '../utils/searchParams';

// Export the createTestQueryClient function.
export function createTestQueryClient() {
  // Return the resulting value to the caller.
  return new QueryClient({
    // Provide the default options field value.
    defaultOptions: {
      // Provide the queries field value.
      queries: { retry: false, gcTime: 0 },
      // Provide the mutations field value.
      mutations: { retry: false },
    },
  });
}

// Export the buildTestSearchQuery function.
export function buildTestSearchQuery() {
  // Return the resulting value to the caller.
  return new URLSearchParams(searchParamsToQuery(defaultSearchParams())).toString();
}

// Export the renderWithRouter function.
export function renderWithRouter(
  // Provide the ui field value.
  ui: ReactElement,
  {
    // Update route with the right-hand side value.
    route = '/',
    // Update path with the right-hand side value.
    path = '*',
    // Spread options into the surrounding structure.
    ...options
  // Continue the surrounding logic with this statement.
  }: RenderOptions & { route?: string; path?: string } = {},
// Continue the surrounding logic with this statement.
) {
  // Create the query client constant.
  const queryClient = createTestQueryClient();

  // Define the Wrapper function.
  function Wrapper({ children }: { children: ReactNode }) {
    // Return control to the caller with the following value.
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/login" element={<div>Login page</div>} />
            <Route path={path} element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  // Return the resulting value to the caller.
  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient };
}

// Export the renderWithAuth function.
export function renderWithAuth(
  // Provide the ui field value.
  ui: ReactElement,
  {
    // Update route with the right-hand side value.
    route = '/',
    // Update path with the right-hand side value.
    path = '*',
    // Spread options into the surrounding structure.
    ...options
  // Continue the surrounding logic with this statement.
  }: RenderOptions & { route?: string; path?: string } = {},
// Continue the surrounding logic with this statement.
) {
  // Create the query client constant.
  const queryClient = createTestQueryClient();

  // Define the Wrapper function.
  function Wrapper({ children }: { children: ReactNode }) {
    // Return control to the caller with the following value.
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>
            <Routes>
              <Route path={path} element={children} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  // Return the resulting value to the caller.
  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient };
}
