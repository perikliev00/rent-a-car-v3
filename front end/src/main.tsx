/**
 * SPA entry: Sentry, React Query, auth provider, routes, and global toasts.
 *
 * Bootstraps error reporting, configures the shared QueryClient, and mounts the
 * React tree under StrictMode. Side effects: initializes Sentry and attaches the
 * app to `#root`.
 */
import { StrictMode } from 'react';
// Import named exports from 'react-dom/client'.
import { createRoot } from 'react-dom/client';
// Import named exports from '@tanstack/react-query'.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Import named exports from './auth/AuthProvider'.
import { AuthProvider } from './auth/AuthProvider';
// Import named exports from './routes/AppRoutes'.
import { AppRoutes } from './routes/AppRoutes';
// Import named exports from './components/ui/Toast'.
import { ToastContainer } from './components/ui/Toast';
// Import named exports from './sentry'.
import { initSentry, Sentry } from './sentry';
// Load side effects from './index.css'.
import './index.css';

// Boot error reporting before anything else mounts.
initSentry();

// Create the query client constant.
const queryClient = new QueryClient({
  // Provide the default options field value.
  defaultOptions: {
    // Provide the queries field value.
    queries: {
      // Short stale window keeps search/fleet data fresh without hammering the API.
      staleTime: 30_000,
      // Provide the retry field value.
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
