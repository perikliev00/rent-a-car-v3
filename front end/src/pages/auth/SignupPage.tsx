/**
 * Customer registration. Client-side password rules mirror common server checks;
 * on success the user is sent to email verification.
 */
import { useState } from 'react';
// Import named exports from 'react-router-dom'.
import { Link, useNavigate } from 'react-router-dom';
// Import named exports from '../../auth/useAuth'.
import { useAuth } from '../../auth/useAuth';
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
 * New account signup form.
 *
 * @returns Auth shell with registration form and login link.
 * @remarks Side effect: creates a session via {@link useAuth} and navigates to `/verify-email`.
 */
export function SignupPage() {
  // Destructure object properties into local variables.
  const { signup } = useAuth();
  // Create the navigate constant.
  const navigate = useNavigate();

  // Destructure array values into local variables.
  const [email, setEmail] = useState('');
  // Destructure array values into local variables.
  const [password, setPassword] = useState('');
  // Destructure array values into local variables.
  const [confirm, setConfirm] = useState('');
  // Destructure array values into local variables.
  const [error, setError] = useState('');
  // Destructure array values into local variables.
  const [loading, setLoading] = useState(false);

  /** Validate locally, register, then send the user to email verification. */
  const handleSubmit = async (e: React.FormEvent) => {
    // Call e.preventDefault to perform this step.
    e.preventDefault();
    // Call setError to perform this step.
    setError('');

    // Evaluate the condition and enter the branch when it is true.
    if (password !== confirm) {
      // Call setError to perform this step.
      setError('Passwords do not match');
      // Return control to the caller with the following value.
      return;
    }

    // Mirror common server rules so obvious failures never hit the network.
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      // Call setError to perform this step.
      setError('Password must be at least 8 characters with a letter and a number');
      // Return control to the caller with the following value.
      return;
    }

    // Call setLoading to perform this step.
    setLoading(true);
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await signup(email, password);
      // Call navigate to perform this step.
      navigate('/verify-email', { replace: true });
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Evaluate the condition and enter the branch when it is true.
      if (err instanceof ApiError) {
        // Call setError to perform this step.
        setError(err.message);
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Call setError to perform this step.
        setError('Signup failed');
      }
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Call setLoading to perform this step.
      setLoading(false);
    }
  };

  // Return control to the caller with the following value.
  return (
    <AuthPageShell
      title="Create account"
      subtitle="Join LuxRide for faster bookings"
      sideTitle="Book once. Drive with confidence."
      sideDescription="Create an account to manage bookings faster and pick up where you left off."
    >
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
          autoComplete="new-password"
        />
        <Input
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
        {error && <ErrorAlert message={error} />}
        <Button type="submit" className="w-full" loading={loading}>
          Sign up
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-[var(--color-accent-ink)] hover:underline">
          Log in
        </Link>
      </p>
    </AuthPageShell>
  );
}
