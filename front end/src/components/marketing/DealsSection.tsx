import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dealTabs, dealTiles, type DealTabId } from '../../data/marketingAssets';

export function DealsSection() {
  const [activeTab, setActiveTab] = useState<DealTabId>('cities');
  const active = dealTabs.find((tab) => tab.id === activeTab) ?? dealTabs[0];

  return (
    <section className="bg-[var(--color-surface-elevated)] py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight text-[var(--color-navy)] sm:text-3xl">
          LuxRide car rental deals &amp; travel tips
        </h2>

        <div className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
          {dealTiles.map((tile) => (
            <Link
              key={tile.title}
              to={tile.href}
              className="group relative block aspect-[16/10] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <img
                src={tile.image}
                alt={tile.title}
                className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.04]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[rgb(6_29_53_/0.75)] to-transparent" />
              <span className="absolute bottom-3 left-3 font-display text-sm font-bold uppercase tracking-[0.08em] text-white">
                {tile.title}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-10 border-t-2 border-[var(--color-accent)] pt-6">
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            {dealTabs.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative pb-3 font-display text-sm font-bold uppercase tracking-[0.08em] transition-colors ${
                    isActive
                      ? 'text-[var(--color-navy)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-navy)]'
                  }`}
                >
                  {tab.label}
                  {isActive ? (
                    <span
                      className="absolute bottom-0 left-1/2 h-0 w-0 -translate-x-1/2 border-x-8 border-b-8 border-x-transparent border-b-[var(--color-accent)]"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <ul className="mt-6 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {active.links.map((link) => (
              <li key={link.label}>
                <Link
                  to={link.href}
                  className="text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-navy)] hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
