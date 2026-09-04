import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { isStaffUser } from '../../auth/permissions';
import { AuthPageShell } from '../../components/static/AuthPageShell';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ErrorAlert } from '../../components/ui/Toast';
import { ApiError } from '../../api/client';

export function LoginPage() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (!isStaffUser(user)) {
        await logout();
        setError('You do not have permission to access the admin panel.');
        return;
      }
      const next = from.startsWith('/admin') ? from : '/admin';
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'ALREADY_LOGGED_IN') {
          navigate(from.startsWith('/admin') ? from : '/admin', { replace: true });
          return;
        }
        setError(err.message);
      } else {
        setError('Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

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
