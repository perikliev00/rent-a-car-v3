import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { isStaffUser } from '../../auth/permissions';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';

function adminFrontendUrl(): string | undefined {
  const raw = import.meta.env.VITE_ADMIN_FRONTEND_URL;
  if (!raw || !raw.trim()) return undefined;
  return raw.replace(/\/+$/, '');
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `relative text-sm font-semibold uppercase tracking-[0.06em] transition-colors ${
    isActive
      ? 'text-[var(--color-navy)] after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:bg-[var(--color-accent)]'
      : 'text-[var(--color-muted)] hover:text-[var(--color-navy)]'
  }`;

const drawerLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center rounded-xl px-3 py-2.5 text-sm font-semibold ${
    isActive
      ? 'bg-[var(--color-navy)] text-white'
      : 'bg-[var(--color-surface)] text-[var(--color-ink)]'
  }`;

export function PublicLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-[var(--color-surface)]">
      <div className="bg-[var(--color-navy)] text-white">
        <div className="mx-auto flex max-w-7xl min-w-0 items-center justify-between gap-4 px-4 py-2 text-xs sm:px-6">
          <nav className="hidden flex-wrap items-center gap-4 font-medium tracking-wide sm:flex">
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
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3 font-medium">
            {user ? (
              <>
                {!isStaffUser(user) && (
                  <Link to="/account" className="opacity-90 hover:opacity-100">
                    My account
                  </Link>
                )}
                {isStaffUser(user) && adminFrontendUrl() && (
                  <a href={adminFrontendUrl()} className="opacity-90 hover:opacity-100">
                    Admin
                  </a>
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
        <div className="mx-auto flex max-w-7xl min-w-0 items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Link to="/" className="group flex min-w-0 items-center gap-2" aria-label="LuxRide">
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

          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <>
                {!isStaffUser(user) && (
                  <Link to="/account" className="md:hidden">
                    <Button variant="outline" size="sm" className="min-h-11">
                      Account
                    </Button>
                  </Link>
                )}
                {isStaffUser(user) && adminFrontendUrl() && (
                  <a href={adminFrontendUrl()} className="md:hidden">
                    <Button variant="outline" size="sm" className="min-h-11">
                      Admin
                    </Button>
                  </a>
                )}
              </>
            ) : (
              <Link to="/signup" className="hidden sm:inline-flex">
                <Button size="sm" className="min-h-11">
                  Sign up
                </Button>
              </Link>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 md:hidden"
              aria-expanded={menuOpen}
              aria-controls="public-mobile-nav"
              data-testid="public-mobile-menu"
              onClick={() => setMenuOpen(true)}
            >
              Menu
            </Button>
          </div>
        </div>
      </header>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" side="right">
        <nav id="public-mobile-nav" className="space-y-1" aria-label="Primary">
          <NavLink to="/" end className={drawerLinkClass} onClick={() => setMenuOpen(false)}>
            Home
          </NavLink>
          <NavLink to="/about" className={drawerLinkClass} onClick={() => setMenuOpen(false)}>
            About
          </NavLink>
          <NavLink to="/faq" className={drawerLinkClass} onClick={() => setMenuOpen(false)}>
            FAQ
          </NavLink>
          <NavLink to="/how-to-book" className={drawerLinkClass} onClick={() => setMenuOpen(false)}>
            How to Book
          </NavLink>
          <NavLink to="/contact" className={drawerLinkClass} onClick={() => setMenuOpen(false)}>
            Contact
          </NavLink>
          <NavLink to="/support" className={drawerLinkClass} onClick={() => setMenuOpen(false)}>
            Support
          </NavLink>
        </nav>
        <div className="mt-6 space-y-2 border-t border-[var(--color-line)] pt-4">
          {!user ? (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)}>
                <Button variant="outline" className="w-full min-h-11">
                  Log in
                </Button>
              </Link>
              <Link to="/signup" onClick={() => setMenuOpen(false)}>
                <Button className="w-full min-h-11">Sign up</Button>
              </Link>
            </>
          ) : (
            <>
              {!isStaffUser(user) ? (
                <Link to="/account" onClick={() => setMenuOpen(false)}>
                  <Button variant="outline" className="w-full min-h-11">
                    My account
                  </Button>
                </Link>
              ) : null}
              <Button
                variant="outline"
                className="w-full min-h-11"
                onClick={() => {
                  setMenuOpen(false);
                  void logout();
                }}
              >
                Log out
              </Button>
            </>
          )}
        </div>
      </Drawer>

      <main className="min-w-0 flex-1">
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
