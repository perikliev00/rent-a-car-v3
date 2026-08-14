import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ContactForm } from '../../components/static/ContactForm';
import { FaqAccordion, type FaqItem } from '../../components/static/FaqAccordion';
import { StaticPageHero } from '../../components/static/StaticPageHero';
import { StaticSection } from '../../components/static/StaticSection';
import { Button } from '../../components/ui/Button';

function IconMail({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="m3.5 7.5 8.5 6 8.5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconPhone({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.5 3.5h3l1.5 4.5-2 1.5a12 12 0 0 0 5 5l1.5-2 4.5 1.5v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 3.5 5.7 2 2 0 0 1 5.5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClock({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconMap({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const ABOUT_VALUES = [
  {
    title: 'Transparent pricing',
    body: 'See the full total for your dates before you pay — delivery, return, and extras included in the summary.',
  },
  {
    title: 'Flexible pickup',
    body: "Airport delivery and city pickup across Bulgaria's busiest travel hubs, with clear fees shown at booking.",
  },
  {
    title: 'Trusted fleet',
    body: 'Regularly maintained automatic and manual vehicles for beach holidays, business trips, and countryside drives.',
  },
];

const LOCATIONS = [
  { name: 'Burgas Airport', detail: 'Meet & greet delivery' },
  { name: 'Sunny Beach', detail: 'Resort pickup & return' },
  { name: 'Sofia', detail: 'City & airport coverage' },
  { name: 'Varna', detail: 'Airport & coastal pickup' },
];

const BOOKING_STEPS = [
  {
    title: 'Search',
    body: 'Enter your pickup and return dates, times, and locations on the home page.',
    tip: 'Tip: Flexible times help us match more cars in peak season.',
  },
  {
    title: 'Choose a car',
    body: 'Browse available vehicles with transparent total pricing for your dates.',
    tip: 'Tip: Filter by category, transmission, or seats to narrow the fleet.',
  },
  {
    title: 'Review',
    body: 'Confirm your booking details and rental summary before checkout.',
    tip: 'Tip: Double-check pickup location and return time to avoid extra fees.',
  },
  {
    title: 'Checkout',
    body: 'Enter your contact details and pay securely via Stripe.',
    tip: 'Tip: Your card is charged when you confirm — no hidden hold at this step.',
  },
  {
    title: 'Confirmation',
    body: 'Receive a booking reference and pickup instructions by email.',
    tip: 'Tip: Keep the confirmation handy for airport meet & greet.',
  },
];

const SUPPORT_CHANNELS = [
  {
    label: 'Email',
    value: 'support@luxride.bg',
    href: 'mailto:support@luxride.bg',
    icon: IconMail,
  },
  {
    label: 'Phone',
    value: '+359 888 000 000',
    href: 'tel:+359888000000',
    icon: IconPhone,
  },
  {
    label: 'Hours',
    value: 'Mon–Sat 08:00–20:00 (EET)',
    href: undefined,
    icon: IconClock,
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'What documents do I need?',
    a: 'A valid driving licence held for at least one year and a passport or national ID card. Bring the same documents at pickup that you used for the booking.',
  },
  {
    q: 'What is the minimum driver age?',
    a: 'Drivers must be at least 21 years old and hold a valid licence for a minimum of one year. Younger drivers may not be eligible for all vehicle categories.',
  },
  {
    q: 'Is insurance included?',
    a: 'Basic third-party insurance is included with every rental. Additional coverage options may be available at pickup — ask our team if you want extra protection.',
  },
  {
    q: 'Can I pick up at the airport?',
    a: 'Yes. We offer delivery to Burgas, Sofia, and Varna airports. Delivery fees apply and are shown during booking before you pay.',
  },
  {
    q: 'Is a deposit required?',
    a: 'A security deposit may be required at pickup depending on the vehicle category. The amount and payment method are confirmed in your booking details.',
  },
  {
    q: 'What is the fuel policy?',
    a: 'Cars are typically provided with a full tank and should be returned with a full tank unless your booking states otherwise. Fuel costs are not included in the rental price.',
  },
  {
    q: 'What is your cancellation policy?',
    a: 'Free cancellation up to 48 hours before pickup. Later cancellations may incur a fee. See our Terms of Service for full details.',
  },
  {
    q: 'How does payment work?',
    a: 'You pay securely online via Stripe at checkout. Your card is charged when you confirm your booking. We do not store your full card details on our servers.',
  },
  {
    q: 'Can I add additional drivers?',
    a: 'Yes. Additional drivers must be registered at pickup and meet the same licence and age requirements as the primary driver.',
  },
];

function LegalArticle({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: Array<{ id: string; heading: string; body: ReactNode }>;
}) {
  return (
    <div>
      <StaticPageHero title={title} description={`Last updated: ${updated}`} />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-14">
          <nav
            aria-label={`${title} sections`}
            className="animate-lux-rise hidden lg:block"
          >
            <div className="sticky top-24 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-soft)]">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-ink)]">
                On this page
              </p>
              <ul className="mt-4 space-y-2.5">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="block text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
                    >
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <article className="animate-lux-fade space-y-5">
            <p className="rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent-muted)]/35 px-4 py-3 text-sm text-[var(--color-ink-soft)]">
              Please read these terms carefully. By using LuxRide you agree to the policies below.
            </p>
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-28 rounded-2xl border border-[var(--color-line)] border-l-4 border-l-[var(--color-accent)] bg-[var(--color-surface-elevated)] px-5 py-6 shadow-[var(--shadow-soft)] sm:px-7"
              >
                <h2 className="font-display text-lg font-semibold text-[var(--color-ink)] sm:text-xl">
                  {section.heading}
                </h2>
                <div className="mt-3 space-y-3 text-[var(--color-muted)] leading-relaxed">
                  {section.body}
                </div>
              </section>
            ))}
          </article>
        </div>
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div>
      <StaticPageHero
        title="About LuxRide"
        description="Premium car rental across Bulgaria — transparent pricing, flexible pickup, and a fleet built for every trip."
      />

      <StaticSection
        title="Our story"
        subtitle="We built LuxRide for travellers who want a simple, stress-free rental from beach resorts to city hubs."
        className="animate-lux-rise"
      >
        <div className="max-w-3xl space-y-4 text-[var(--color-muted)] leading-relaxed">
          <p>
            LuxRide is a premium car rental service operating across Bulgaria&apos;s most popular
            destinations — from Sunny Beach and Burgas Airport to Sofia and Varna.
          </p>
          <p>
            We believe renting a car should be simple, transparent, and stress-free. That&apos;s why
            we show full pricing upfront, offer flexible pickup and return locations, and let you
            complete your booking online in minutes.
          </p>
          <p>
            Our fleet is regularly maintained and includes a range of automatic and manual vehicles
            to suit every trip — whether you&apos;re on a beach holiday, a business visit, or
            exploring the countryside.
          </p>
        </div>
      </StaticSection>

      <section className="border-y border-[var(--color-line)] bg-[var(--color-surface-elevated)]">
        <StaticSection
          title="Why LuxRide"
          subtitle="Three reasons travellers choose us for Bulgaria."
        >
          <div className="grid gap-6 md:grid-cols-3">
            {ABOUT_VALUES.map((value) => (
              <div
                key={value.title}
                className="border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-7"
              >
                <h3 className="font-display text-lg font-semibold text-[var(--color-ink)]">
                  {value.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{value.body}</p>
              </div>
            ))}
          </div>
        </StaticSection>
      </section>

      <StaticSection
        title="Where we operate"
        subtitle="Coverage across Bulgaria's key travel corridors."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LOCATIONS.map((location) => (
            <div
              key={location.name}
              className="flex items-start gap-3 border-l-2 border-[var(--color-accent)] pl-4"
            >
              <IconMap className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent-ink)]" />
              <div>
                <p className="font-display font-semibold text-[var(--color-ink)]">{location.name}</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{location.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <Link to="/">
            <Button size="lg">Start booking</Button>
          </Link>
        </div>
      </StaticSection>
    </div>
  );
}

export function FaqPage() {
  return (
    <div>
      <StaticPageHero
        title="Frequently Asked Questions"
        description="Quick answers about documents, insurance, pickup, payment, and more."
      />
      <StaticSection className="animate-lux-rise">
        <FaqAccordion items={FAQ_ITEMS} />
        <p className="mt-10 text-[var(--color-muted)]">
          Still need help? Read our{' '}
          <Link to="/terms" className="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline">
            Terms of Service
          </Link>
          , visit{' '}
          <Link
            to="/support"
            className="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
          >
            Support
          </Link>
          , or{' '}
          <Link
            to="/contact"
            className="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
          >
            Contact us
          </Link>
          .
        </p>
      </StaticSection>
    </div>
  );
}

export function HowToBookPage() {
  return (
    <div>
      <StaticPageHero
        title="How to Book"
        description="Five simple steps from search to confirmation — usually done in minutes."
      />
      <StaticSection className="animate-lux-rise">
        <ol className="relative space-y-0 border-l border-[var(--color-line)] ml-3 sm:ml-4">
          {BOOKING_STEPS.map((step, index) => (
            <li key={step.title} className="relative pb-10 pl-8 last:pb-0 sm:pl-10">
              <span className="absolute -left-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)] font-display text-sm font-bold text-[var(--color-ink)] sm:-left-3.5">
                {index + 1}
              </span>
              <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
                {step.title}
              </h2>
              <p className="mt-2 max-w-2xl text-[var(--color-muted)] leading-relaxed">{step.body}</p>
              <p className="mt-2 max-w-2xl text-sm text-[var(--color-ink-soft)]/80">{step.tip}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12">
          <Link to="/">
            <Button size="lg">Start booking</Button>
          </Link>
        </div>
      </StaticSection>
    </div>
  );
}

export function SupportPage() {
  return (
    <div>
      <StaticPageHero
        title="Support"
        description="Help with bookings, changes, and roadside assistance during your rental."
      />
      <StaticSection className="animate-lux-rise">
        <div className="grid gap-5 md:grid-cols-3">
          {SUPPORT_CHANNELS.map((channel) => {
            const Icon = channel.icon;
            const content = (
              <>
                <Icon className="h-6 w-6 text-[var(--color-accent-ink)]" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
                    {channel.label}
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold text-[var(--color-ink)]">
                    {channel.value}
                  </p>
                </div>
              </>
            );

            return channel.href ? (
              <a
                key={channel.label}
                href={channel.href}
                className="flex items-start gap-4 border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-5 py-6 shadow-[var(--shadow-soft)] transition-colors hover:border-[var(--color-accent)]/50"
              >
                {content}
              </a>
            ) : (
              <div
                key={channel.label}
                className="flex items-start gap-4 border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-5 py-6 shadow-[var(--shadow-soft)]"
              >
                {content}
              </div>
            );
          })}
        </div>

        <div className="mt-10 border border-[var(--color-accent)]/30 bg-[var(--color-accent-muted)]/40 px-5 py-5 sm:px-6">
          <p className="font-display font-semibold text-[var(--color-ink)]">Roadside assistance</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            For urgent roadside assistance during your rental, call the number provided in your
            booking confirmation. Our team coordinates help as quickly as possible within operating
            hours.
          </p>
        </div>

        <p className="mt-10 text-[var(--color-muted)]">
          Looking for self-serve answers? Check the{' '}
          <Link
            to="/faq"
            className="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
          >
            FAQ
          </Link>{' '}
          or{' '}
          <Link
            to="/contact"
            className="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
          >
            send us a message
          </Link>
          .
        </p>
      </StaticSection>
    </div>
  );
}

export function ContactPage() {
  return (
    <div>
      <StaticPageHero
        title="Contact Us"
        description="Booking enquiries, changes, or general questions — we typically reply within one business day."
      />
      <StaticSection className="animate-lux-rise">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] lg:items-start">
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
              Send a message
            </h2>
            <p className="mt-2 mb-6 text-sm text-[var(--color-muted)]">
              Fill in the form and our team will get back to you soon.
            </p>
            <ContactForm />
          </div>

          <aside className="space-y-6 border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
              Office details
            </h2>
            <ul className="space-y-5 text-sm">
              <li className="flex items-start gap-3">
                <IconMap className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent-ink)]" />
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">Office</p>
                  <p className="mt-1 text-[var(--color-muted)]">Sunny Beach, Bulgaria</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <IconMail className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent-ink)]" />
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">Email</p>
                  <a
                    href="mailto:info@luxride.bg"
                    className="mt-1 block text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  >
                    info@luxride.bg
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <IconPhone className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent-ink)]" />
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">Phone</p>
                  <a
                    href="tel:+359888000000"
                    className="mt-1 block text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  >
                    +359 888 000 000
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <IconClock className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent-ink)]" />
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">Hours</p>
                  <p className="mt-1 text-[var(--color-muted)]">Mon–Sat 08:00–20:00 (EET)</p>
                </div>
              </li>
            </ul>
          </aside>
        </div>
      </StaticSection>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalArticle
      title="Terms of Service"
      updated="July 2026"
      sections={[
        {
          id: 'rental-agreement',
          heading: '1. Rental agreement',
          body: (
            <p>
              By completing a booking with LuxRide, you agree to these terms. The rental period
              begins at the agreed pickup time and ends at the agreed return time. The vehicle must
              be returned in the same condition it was provided, subject to normal wear and tear.
            </p>
          ),
        },
        {
          id: 'driver-requirements',
          heading: '2. Driver requirements',
          body: (
            <p>
              Drivers must be at least 21 years old and hold a valid licence for a minimum of one
              year. Additional drivers must be registered at pickup and meet the same requirements.
              You are responsible for ensuring every driver is authorised and fit to drive.
            </p>
          ),
        },
        {
          id: 'payment',
          heading: '3. Payment',
          body: (
            <p>
              Full payment is required at the time of booking. Prices include delivery and return
              fees as shown during checkout. Payments are processed securely via Stripe. Security
              deposits, if required, are handled at pickup according to the vehicle category.
            </p>
          ),
        },
        {
          id: 'cancellation',
          heading: '4. Cancellation',
          body: (
            <p>
              Cancellations made more than 48 hours before pickup receive a full refund.
              Cancellations within 48 hours may be subject to a cancellation fee. No-shows may be
              charged the full rental amount.
            </p>
          ),
        },
        {
          id: 'insurance',
          heading: '5. Insurance',
          body: (
            <p>
              Basic third-party insurance is included with every rental. Optional additional
              coverage may be offered at pickup. You remain responsible for excesses, exclusions,
              and damage arising from misuse or breach of these terms.
            </p>
          ),
        },
        {
          id: 'liability',
          heading: '6. Liability',
          body: (
            <p>
              You are liable for fines, tolls, parking charges, and damage caused during the rental
              period, except where LuxRide is at fault. LuxRide is not liable for indirect or
              consequential losses arising from delays, breakdowns, or force majeure events beyond
              our reasonable control.
            </p>
          ),
        },
        {
          id: 'prohibited-use',
          heading: '7. Prohibited use',
          body: (
            <p>
              The vehicle may not be used for racing, off-road driving (unless expressly permitted),
              towing, subletting, illegal activity, or driving under the influence of alcohol or
              drugs. Smoking in the vehicle and carrying hazardous materials are prohibited.
            </p>
          ),
        },
        {
          id: 'governing-law',
          heading: '8. Governing law',
          body: (
            <p>
              These terms are governed by the laws of the Republic of Bulgaria. Disputes shall be
              subject to the competent courts in Bulgaria, without prejudice to any mandatory
              consumer protection rights that apply.
            </p>
          ),
        },
      ]}
    />
  );
}

export function PrivacyPage() {
  return (
    <LegalArticle
      title="Privacy Policy"
      updated="July 2026"
      sections={[
        {
          id: 'data-collected',
          heading: '1. Data we collect',
          body: (
            <p>
              LuxRide collects personal information needed to process your rental — including name,
              email, phone number, address, booking details, and messages you send via our contact
              form.
            </p>
          ),
        },
        {
          id: 'data-use',
          heading: '2. How we use your data',
          body: (
            <p>
              We use your information solely to manage reservations, communicate about your booking,
              provide customer support, meet legal obligations, and improve our service. We do not
              sell your personal data to third parties.
            </p>
          ),
        },
        {
          id: 'payments-stripe',
          heading: '3. Payments (Stripe)',
          body: (
            <p>
              Payment data is processed securely by Stripe. We do not store your full card details on
              our servers. Stripe acts as an independent payment processor under its own privacy
              terms.
            </p>
          ),
        },
        {
          id: 'cookies-session',
          heading: '4. Cookies and session',
          body: (
            <p>
              We use session cookies and related storage to maintain your login state and booking
              session. These are necessary for the site to function securely and are not used for
              third-party advertising.
            </p>
          ),
        },
        {
          id: 'retention',
          heading: '5. Retention',
          body: (
            <p>
              We retain booking and contact records for as long as needed to fulfil the rental,
              handle disputes, and comply with accounting or legal requirements, after which data is
              deleted or anonymised where feasible.
            </p>
          ),
        },
        {
          id: 'your-rights',
          heading: '6. Your rights',
          body: (
            <p>
              Depending on applicable law, you may request access, correction, deletion, or
              restriction of your personal data. To exercise these rights, contact us at
              privacy@luxride.bg. We may need to verify your identity before fulfilling a request.
            </p>
          ),
        },
        {
          id: 'privacy-contact',
          heading: '7. Contact',
          body: (
            <p>
              For privacy questions or data requests, email{' '}
              <a
                href="mailto:privacy@luxride.bg"
                className="font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
              >
                privacy@luxride.bg
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
