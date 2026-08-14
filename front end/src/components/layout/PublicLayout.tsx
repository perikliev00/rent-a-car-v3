import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { isStaffUser } from '../../auth/permissions';
import { Button } from '../ui/Button';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `relative text-sm font-semibold uppercase tracking-[0.06em] transition-colors ${
    isActive
      ? 'text-[var(--color-navy)] after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:bg-[var(--color-accent)]'
      : 'text-[var(--color-muted)] hover:text-[var(--color-navy)]'
  }`;

export function PublicLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface)]">
      <div className="bg-[var(--color-navy)] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-xs sm:px-6">
          <nav className="flex flex-wrap items-center gap-4 font-medium tracking-wide">
            <Link to="/about" className="opacity-90 transition-opacity hover:opacity-100">
              About
            </Link>
            <Link to="/faq" className="opacity-90 transition-opacity hover:opacity-100">
              FAQ
            </Link>
            <Link to="/contact" className="opacity-90 transition-opacity hover:opacity-100">
              Contact
            </Link>
            <Link to="/support" className="opacity-90 transition-opacity hover:opacity-100">
              Support
            </Link>
          </nav>
          <div className="flex items-center gap-3 font-medium">
            {user ? (
              <>
                {!isStaffUser(user) && (
                  <Link to="/account" className="opacity-90 hover:opacity-100">
                    My account
                  </Link>
                )}
                {isStaffUser(user) && (
                  <Link to="/admin" className="opacity-90 hover:opacity-100">
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => logout()}
                  className="opacity-90 hover:opacity-100"
                >
                  Log out
                </button>
              </>
            ) : (
              <Link to="/login" className="opacity-90 hover:opacity-100">
                Log in
              </Link>
            )}
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-surface-elevated)] shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link to="/" className="group flex items-center gap-2" aria-label="LuxRide">
            <span
              className="font-display text-2xl font-extrabold tracking-tight text-[var(--color-navy)] sm:text-3xl"
              aria-hidden="true"
            >
              Lux
              <span className="text-[var(--color-accent-ink)] transition-colors group-hover:text-[var(--color-navy)]">
                Ride
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            <NavLink to="/" className={navLinkClass} end>
              Home
            </NavLink>
            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>
            <NavLink to="/faq" className={navLinkClass}>
              FAQ
            </NavLink>
            <NavLink to="/how-to-book" className={navLinkClass}>
              How to Book
            </NavLink>
            <NavLink to="/contact" className={navLinkClass}>
              Contact
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                {!isStaffUser(user) && (
                  <Link to="/account" className="md:hidden">
                    <Button variant="outline" size="sm">
                      Account
                    </Button>
                  </Link>
                )}
                {isStaffUser(user) && (
                  <Link to="/admin" className="md:hidden">
                    <Button variant="outline" size="sm">
                      Admin
                    </Button>
                  </Link>
                )}
              </>
            ) : (
              <Link to="/signup">
                <Button size="sm">Sign up</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-navy text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="font-display text-2xl font-extrabold text-white">
              Lux<span className="text-[var(--color-accent)]">Ride</span>
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
              Premium car rental across Bulgaria. Transparent pricing, flexible pickup locations, and
              a fleet you can trust.
            </p>
          </div>
          <div>
            <p className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-white">
              Company
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              <li>
                <Link to="/about" className="transition-colors hover:text-white">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/faq" className="transition-colors hover:text-white">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/how-to-book" className="transition-colors hover:text-white">
                  How to Book
                </Link>
              </li>
              <li>
                <Link to="/support" className="transition-colors hover:text-white">
                  Support
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-white">
              Legal
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              <li>
                <Link to="/terms" className="transition-colors hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="transition-colors hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/contact" className="transition-colors hover:text-white">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} LuxRide. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
