/**
 * Staff login form; redirects into /admin after a successful session.
 */
import { useState } from 'react';
// Import named exports from 'react-router-dom'.
import { useNavigate, useLocation } from 'react-router-dom';
// Import named exports from '../../auth/useAuth'.
import { useAuth } from '../../auth/useAuth';
// Import named exports from '../../auth/permissions'.
import { isStaffUser } from '../../auth/permissions';
// Import named exports from '../../components/static/AuthPageShell'.
import { AuthPageShell } from '../../components/static/AuthPageShell';
// Import named exports from '../../components/ui/Input'.
import { Input } from '../../components/ui/Input';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Toast'.
import { ErrorAlert } from '../../components/ui/Toast';
// Import named exports from '../../api/client'.
import { ApiError } from '../../api/client';

/**
 * Email/password login for staff. Non-staff sessions are logged out immediately.
 * Respects `location.state.from` when it points under `/admin`.
 */
export function LoginPage() {
  // Destructure object properties into local variables.
  const { login, logout } = useAuth();
  // Create the navigate constant.
  const navigate = useNavigate();
  // Create the location constant.
  const location = useLocation();
  // Deep-link return path from a prior AdminRoute redirect, else dashboard.
  const from =
    // Continue the surrounding logic with this statement.
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/admin';

  // Destructure array values into local variables.
  const [email, setEmail] = useState('');
  // Destructure array values into local variables.
  const [password, setPassword] = useState('');
  // Destructure array values into local variables.
  const [error, setError] = useState('');
  // Destructure array values into local variables.
  const [loading, setLoading] = useState(false);

  /** Authenticate, enforce staff, then navigate into admin. */
  const handleSubmit = async (e: React.FormEvent) => {
    // Call e.preventDefault to perform this step.
    e.preventDefault();
    // Call setError to perform this step.
    setError('');
    // Call setLoading to perform this step.
    setLoading(true);
    // Start a try block for operations that may fail.
    try {
      // Create the user constant.
      const user = await login(email, password);
      // Customer accounts must not retain an admin session cookie.
      if (!isStaffUser(user)) {
        // Wait until the asynchronous operation resolves.
        await logout();
        // Call setError to perform this step.
        setError('You do not have permission to access the admin panel.');
        // Return control to the caller with the following value.
        return;
      }
      // Only honor in-app admin deep links; otherwise go to /admin.
      const next = from.startsWith('/admin') ? from : '/admin';
      // Call navigate to perform this step.
      navigate(next, { replace: true });
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Evaluate the condition and enter the branch when it is true.
      if (err instanceof ApiError) {
        // Already authenticated — treat as success and enter admin.
        if (err.code === 'ALREADY_LOGGED_IN') {
          // Call navigate to perform this step.
          navigate(from.startsWith('/admin') ? from : '/admin', { replace: true });
          // Return control to the caller with the following value.
          return;
        }
        // Call setError to perform this step.
        setError(err.message);
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Call setError to perform this step.
        setError('Login failed');
      }
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Call setLoading to perform this step.
      setLoading(false);
    }
  };

  // Return control to the caller with the following value.
  return (
    <main>
      <AuthPageShell title="Staff log in" subtitle="Sign in to the LuxRide admin panel">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <ErrorAlert message={error} />}
          <Button type="submit" className="w-full" loading={loading}>
            Log in
          </Button>
        </form>
      </AuthPageShell>
    </main>
  );
}
