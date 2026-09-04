import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold text-[var(--color-ink)]">Page not found</h1>
      <p className="mt-4 font-display text-7xl font-bold tracking-tight text-[var(--color-ink-soft)]/35">
        404
      </p>
      <p className="mt-4 text-[var(--color-muted)]">
        This admin page does not exist or may have moved.
      </p>
      <Link to="/admin">
        <Button className="mt-8" size="lg">
          Go to dashboard
        </Button>
      </Link>
    </div>
  );
}
