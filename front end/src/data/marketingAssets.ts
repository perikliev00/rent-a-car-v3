/**
 * Marketing images & copy for the public site.
 * Replace Unsplash URLs with your own assets when ready.
 */

/** Full-bleed home hero photograph. */
export const heroImage =
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=80';

/** Accessible alt text for {@link heroImage}. */
export const heroImageAlt = 'Scenic mountain road ideal for a premium road trip';

/** Shared photo used by {@link StaticPageHero} on utility/static pages. */
export const staticHeroImage =
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1920&q=80';

/** Branded aside image for login/signup/verify shells. */
export const authAsideImage =
  'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1200&q=80';

/** Generic partner marks — not real trademark logos */
export const partnerMarks = [
  'DriveNet',
  'Coastal Cars',
  'CityFleet',
  'Summit Rentals',
  'BlueLane',
  'OpenRoad Co',
] as const;

/** Customer quotes shown in {@link ReviewsCarousel}. */
export const reviews = [
  {
    quote: 'Transparent pricing and a smooth pickup at the airport. Exactly what we needed.',
    name: 'Maria K.',
    location: 'Sofia',
  },
  {
    quote: 'Clean car, flexible return in Sunny Beach, and booking took minutes online.',
    name: 'James R.',
    location: 'UK',
  },
  {
    quote: 'Great fleet selection and clear totals before payment. Will book again.',
    name: 'Elena P.',
    location: 'Varna',
  },
  {
    quote: 'Overall good experience from quote to drop-off. Staff were helpful and on time.',
    name: 'Michael',
    location: 'Germany',
  },
  {
    quote: 'No hidden fees and easy online booking. Perfect for a Black Sea holiday.',
    name: 'Sofia L.',
    location: 'Poland',
  },
  {
    quote: 'Reliable car and clear communication. Pickup at Burgas Airport was seamless.',
    name: 'Andrei T.',
    location: 'Romania',
  },
] as const;

/** Photo for the home-page advantage split (left column). */
export const advantageImage =
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1400&q=80';

/** Accessible alt text for {@link advantageImage}. */
export const advantageImageAlt = 'Traveller overlooking green mountains on a road trip';

/** Headline for the navy advantage checklist column. */
export const advantageHeadline = 'Discover the LuxRide Advantage';

/** Bullet points listed under {@link advantageHeadline}. */
export const advantagePoints = [
  'Compare rates with transparent totals before you book',
  'Free cancellation up to 48 hours before pickup',
  'No hidden credit-card or booking fees',
  'Available 7 days a week for support',
  'Pickup across Bulgaria — airports, resorts & cities',
] as const;

/** Image tiles at the top of {@link DealsSection}. */
export const dealTiles = [
  {
    title: 'Coastal road trips',
    image:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80',
    href: '/',
  },
  {
    title: 'Convertible weekends',
    image:
      'https://images.unsplash.com/photo-1527786356703-4b100091cd2c?auto=format&fit=crop&w=900&q=80',
    href: '/about',
  },
  {
    title: 'City & village escapes',
    image:
      'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=900&q=80',
    href: '/how-to-book',
  },
] as const;

/** Tab ids for the deals link list. */
export type DealTabId = 'cities' | 'regions';

/** Tabbed destination link groups under the deals tiles. */
export const dealTabs: {
  id: DealTabId;
  label: string;
  links: { label: string; href: string }[];
}[] = [
  {
    id: 'cities',
    label: 'Great deals in top cities',
    links: [
      { label: 'Sofia', href: '/' },
      { label: 'Varna', href: '/' },
      { label: 'Burgas', href: '/' },
      { label: 'Plovdiv', href: '/' },
      { label: 'Sunny Beach', href: '/' },
      { label: 'Nesebar', href: '/contact' },
    ],
  },
  {
    id: 'regions',
    label: 'Best rates in popular regions',
    links: [
      { label: 'Black Sea Coast', href: '/' },
      { label: 'Rhodope Mountains', href: '/about' },
      { label: 'Pirin & Bansko', href: '/' },
      { label: 'Danube towns', href: '/contact' },
      { label: 'Rose Valley', href: '/how-to-book' },
      { label: 'Thracian Plain', href: '/about' },
    ],
  },
];
