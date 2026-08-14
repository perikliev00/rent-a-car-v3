import { staticHeroImage } from '../../data/marketingAssets';

interface StaticPageHeroProps {
  title: string;
  description?: string;
  eyebrow?: string;
}

export function StaticPageHero({ title, description, eyebrow = 'LuxRide' }: StaticPageHeroProps) {
  return (
    <section className="relative overflow-hidden text-white">
      <div className="absolute inset-0">
        <img
          src={staticHeroImage}
          alt=""
          className="h-full w-full object-cover"
          loading="eager"
        />
        <div className="hero-photo-overlay absolute inset-0" />
      </div>
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="max-w-2xl animate-lux-rise">
          {eyebrow ? (
            <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-[var(--color-accent)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-tight sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
