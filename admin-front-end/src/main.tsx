/**
 * Admin SPA entry: Sentry, React Query defaults, auth, routes, and global toasts.
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

// Optional; no-ops when VITE_SENTRY_DSN is unset.
initSentry();

// Create the query client constant.
const queryClient = new QueryClient({
  // Provide the default options field value.
  defaultOptions: {
    // Provide the queries field value.
    queries: {
      // Admin lists stay fresh for 30s; one retry on transient failures.
      staleTime: 30_000,
      // Provide the retry field value.
      retry: 1,
    },
  },
});

// Call createRoot to perform this step.
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
