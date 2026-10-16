/**
 * SPA entry: Sentry, React Query, auth provider, routes, and global toasts.
 *
 * Bootstraps error reporting, configures the shared QueryClient, and mounts the
 * React tree under StrictMode. Side effects: initializes Sentry and attaches the
 * app to `#root`.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthProvider';
import { AppRoutes } from './routes/AppRoutes';
import { ToastContainer } from './components/ui/Toast';
import { initSentry, Sentry } from './sentry';
import './index.css';

// Boot error reporting before anything else mounts.
initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Short stale window keeps search/fleet data fresh without hammering the API.
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// Mount the app tree under StrictMode with Sentry + Query + Auth wrappers.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRoutes />
          <ToastContainer />
        </AuthProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
