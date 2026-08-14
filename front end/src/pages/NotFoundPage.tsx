import { Link } from 'react-router-dom';
import { StaticPageHero } from '../components/static/StaticPageHero';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div>
      <StaticPageHero
        title="Page not found"
        description="The page you are looking for does not exist or may have moved."
      />
      <div className="mx-auto max-w-lg px-4 py-14 text-center sm:px-6">
        <p className="animate-lux-rise font-display text-7xl font-bold tracking-tight text-[var(--color-ink-soft)]/35 sm:text-8xl">
          404
        </p>
        <p className="mt-4 text-[var(--color-muted)]">
          Try heading home to search available cars across Bulgaria.
        </p>
        <Link to="/">
          <Button className="mt-8" size="lg">
            Go home
          </Button>
        </Link>
      </div>
    </div>
  );
}
