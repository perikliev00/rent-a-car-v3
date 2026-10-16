/**
 * Admin SPA entry: Sentry, React Query defaults, auth, routes, and global toasts.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthProvider';
import { AppRoutes } from './routes/AppRoutes';
import { ToastContainer } from './components/ui/Toast';
import { initSentry, Sentry } from './sentry';
import './index.css';

// Optional; no-ops when VITE_SENTRY_DSN is unset.
initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Admin lists stay fresh for 30s; one retry on transient failures.
      staleTime: 30_000,
      retry: 1,
    },
  },
});

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
