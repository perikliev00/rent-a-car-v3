/**
 * Customer login. After success, staff users are sent to the admin frontend
 * (when configured); everyone else returns to the protected `from` path or `/account`.
 */
import { useState } from 'react';
// Import named exports from 'react-router-dom'.
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
 * Email/password login form for the public site.
 *
 * @returns Auth shell with login form and signup link.
 * @remarks Side effects: establishes a session via {@link useAuth}; may hard-redirect staff to the admin SPA.
 */
export function LoginPage() {
  // Destructure object properties into local variables.
  const { login } = useAuth();
  // Create the navigate constant.
  const navigate = useNavigate();
  // Create the location constant.
  const location = useLocation();
  // Set by ProtectedRoute so post-login navigation resumes the intended page.
  const from =
    // Continue the surrounding logic with this statement.
    (location.state as { from?: { pathname: string } })?.from?.pathname ??
    // Supply the literal value used by the enclosing expression.
    '/account';

  // Destructure array values into local variables.
  const [email, setEmail] = useState('');
  // Destructure array values into local variables.
  const [password, setPassword] = useState('');
  // Destructure array values into local variables.
  const [error, setError] = useState('');
  // Destructure array values into local variables.
  const [loading, setLoading] = useState(false);

  /** Authenticate and route customers vs staff appropriately. */
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
      // Staff belongs in the admin app when its URL is configured.
      if (isStaffUser(user)) {
        // Create the admin url constant.
        const adminUrl = import.meta.env.VITE_ADMIN_FRONTEND_URL?.replace(/\/+$/, '');
        // Evaluate the condition and enter the branch when it is true.
        if (adminUrl) {
          // Call window.location.assign to perform this step.
          window.location.assign(adminUrl);
          // Return control to the caller with the following value.
          return;
        }
        // Call navigate to perform this step.
        navigate('/', { replace: true });
        // Return control to the caller with the following value.
        return;
      }
      // Call navigate to perform this step.
      navigate(from || '/account', { replace: true });
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Evaluate the condition and enter the branch when it is true.
      if (err instanceof ApiError) {
        // Session already exists — treat as success and continue.
        if (err.code === 'ALREADY_LOGGED_IN') {
          // Call navigate to perform this step.
          navigate(from, { replace: true });
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
    <AuthPageShell title="Log in" subtitle="Welcome back to LuxRide">
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

      <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
        Don&apos;t have an account?{' '}
        <Link
          to="/signup"
          className="font-medium text-[var(--color-accent-ink)] hover:underline"
        >
          Sign up
        </Link>
      </p>
    </AuthPageShell>
  );
}
