import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/Button';

const NAV_LINKS = [
  { to: '/', label: 'Marketplace' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/contact', label: 'Contact' },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/85 backdrop-blur-md">
      <div className="page-shell flex items-center gap-4 py-3.5 lg:gap-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setMenuOpen(false)}>
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-brand-600 font-display text-sm font-bold text-white">
            HL
          </span>
          <span className="hidden font-display text-base font-semibold text-ink-900 sm:inline">Halal Livestocks</span>
        </Link>

        <nav className="hidden flex-1 space-x-4 text-sm font-medium text-ink-700 md:flex md:space-x-5 lg:space-x-6">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `whitespace-nowrap ${isActive ? 'text-brand-700' : 'transition hover:text-ink-900'}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex">
          {user ? (
            <>
              <Link to={dashboardPath(user.role)}>
                <Button variant="secondary">
                  <span className="hidden lg:inline">{user.fullName.split(' ')[0]}</span>
                  <span className="lg:hidden">My</span>
                  <span className="ml-1 text-ink-500">dashboard</span>
                </Button>
              </Link>
              <Button variant="ghost" onClick={logout}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost">Log in</Button>
              </Link>
              <Link to="/register">
                <Button>Get started</Button>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          className="ml-auto grid size-10 shrink-0 place-items-center rounded-xl text-ink-700 ring-1 ring-inset ring-stone-200 transition hover:bg-stone-100 md:hidden"
        >
          <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5">
            {menuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen ? (
        <div id="mobile-menu" className="border-t border-stone-200 bg-white md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="page-shell space-y-3 py-4">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `block text-sm font-medium ${isActive ? 'text-brand-700' : 'text-ink-700'}`}
              >
                {link.label}
              </NavLink>
            ))}
            <div className="grid gap-2 pt-1">
              {user ? (
                <>
                  <Link to={dashboardPath(user.role)}>
                    <Button className="w-full">Open my dashboard</Button>
                  </Link>
                  <Button variant="secondary" className="w-full" onClick={logout}>
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/register">
                    <Button className="w-full">Get started</Button>
                  </Link>
                  <Link to="/login">
                    <Button variant="secondary" className="w-full">
                      Log in
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function dashboardPath(role: 'buyer' | 'farmer' | 'admin'): string {
  return `/${role}/dashboard`;
}
