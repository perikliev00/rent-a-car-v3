import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { defaultSearchParams, searchParamsToQuery } from '../utils/searchParams';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function buildTestSearchQuery() {
  return new URLSearchParams(searchParamsToQuery(defaultSearchParams())).toString();
}

export function renderWithRouter(
  ui: ReactElement,
  {
    route = '/',
    path = '*',
    ...options
  }: RenderOptions & { route?: string; path?: string } = {},
) {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
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

  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient };
}

export function renderWithAuth(
  ui: ReactElement,
  {
    route = '/',
    path = '*',
    ...options
  }: RenderOptions & { route?: string; path?: string } = {},
) {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
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

  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient };
}
