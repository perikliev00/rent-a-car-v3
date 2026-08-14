import {
  advantageHeadline,
  advantageImage,
  advantageImageAlt,
  advantagePoints,
} from '../../data/marketingAssets';

export function AdvantageSplit() {
  return (
    <section className="bg-[var(--color-surface-elevated)]">
      <div className="mx-auto grid max-w-7xl lg:grid-cols-[1.65fr_1fr]">
        <div className="relative min-h-[16rem] overflow-hidden sm:min-h-[22rem]">
          <img
            src={advantageImage}
            alt={advantageImageAlt}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[rgb(6_29_53_/0.85)] via-[rgb(6_29_53_/0.25)] to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
              Trusted by travellers across Bulgaria
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold uppercase tracking-tight text-white sm:text-3xl">
              Millions of road trips start here
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center bg-[var(--color-navy)] px-6 py-10 text-white sm:px-8 sm:py-12">
          <h2 className="font-display text-2xl font-semibold leading-snug tracking-tight sm:text-[1.65rem]">
            {advantageHeadline}
          </h2>
          <div className="mt-4 h-0.5 w-16 bg-[var(--color-accent)]" aria-hidden />
          <ul className="mt-6 space-y-3.5">
            {advantagePoints.map((point) => (
              <li key={point} className="flex gap-3 text-sm leading-snug text-white/90">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-[var(--color-ink)]"
                  aria-hidden
                >
                  ✓
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
