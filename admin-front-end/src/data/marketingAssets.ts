/**
 * Marketing images & copy for the public site.
 * Replace Unsplash URLs with your own assets when ready.
 */

export const heroImage =
  // Continue the surrounding logic with this statement.
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=80';

// Export the hero image alt const.
export const heroImageAlt = 'Scenic mountain road ideal for a premium road trip';

// Export the static hero image const.
export const staticHeroImage =
  // Continue the surrounding logic with this statement.
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1920&q=80';

// Export the auth aside image const.
export const authAsideImage =
  // Continue the surrounding logic with this statement.
  'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1200&q=80';

/** Generic partner marks — not real trademark logos */
export const partnerMarks = [
  // Supply the literal value used by the enclosing expression.
  'DriveNet',
  // Supply the literal value used by the enclosing expression.
  'Coastal Cars',
  // Supply the literal value used by the enclosing expression.
  'CityFleet',
  // Supply the literal value used by the enclosing expression.
  'Summit Rentals',
  // Supply the literal value used by the enclosing expression.
  'BlueLane',
  // Supply the literal value used by the enclosing expression.
  'OpenRoad Co',
// Apply the TypeScript type assertion for this value.
] as const;

// Export the reviews const.
export const reviews = [
  {
    // Provide the quote field value.
    quote: 'Transparent pricing and a smooth pickup at the airport. Exactly what we needed.',
    // Provide the name field value.
    name: 'Maria K.',
    // Provide the location field value.
    location: 'Sofia',
  },
  {
    // Provide the quote field value.
    quote: 'Clean car, flexible return in Sunny Beach, and booking took minutes online.',
    // Provide the name field value.
    name: 'James R.',
    // Provide the location field value.
    location: 'UK',
  },
  {
    // Provide the quote field value.
    quote: 'Great fleet selection and clear totals before payment. Will book again.',
    // Provide the name field value.
    name: 'Elena P.',
    // Provide the location field value.
    location: 'Varna',
  },
  {
    // Provide the quote field value.
    quote: 'Overall good experience from quote to drop-off. Staff were helpful and on time.',
    // Provide the name field value.
    name: 'Michael',
    // Provide the location field value.
    location: 'Germany',
  },
  {
    // Provide the quote field value.
    quote: 'No hidden fees and easy online booking. Perfect for a Black Sea holiday.',
    // Provide the name field value.
    name: 'Sofia L.',
    // Provide the location field value.
    location: 'Poland',
  },
  {
    // Provide the quote field value.
    quote: 'Reliable car and clear communication. Pickup at Burgas Airport was seamless.',
    // Provide the name field value.
    name: 'Andrei T.',
    // Provide the location field value.
    location: 'Romania',
  },
// Apply the TypeScript type assertion for this value.
] as const;

// Export the advantage image const.
export const advantageImage =
  // Continue the surrounding logic with this statement.
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1400&q=80';

// Export the advantage image alt const.
export const advantageImageAlt = 'Traveller overlooking green mountains on a road trip';

// Export the advantage headline const.
export const advantageHeadline = 'Discover the LuxRide Advantage';

// Export the advantage points const.
export const advantagePoints = [
  // Supply the literal value used by the enclosing expression.
  'Compare rates with transparent totals before you book',
  // Supply the literal value used by the enclosing expression.
  'Free cancellation up to 48 hours before pickup',
  // Supply the literal value used by the enclosing expression.
  'No hidden credit-card or booking fees',
  // Supply the literal value used by the enclosing expression.
  'Available 7 days a week for support',
  // Supply the literal value used by the enclosing expression.
  'Pickup across Bulgaria — airports, resorts & cities',
// Apply the TypeScript type assertion for this value.
] as const;

// Export the deal tiles const.
export const dealTiles = [
  {
    // Provide the title field value.
    title: 'Coastal road trips',
    // Provide the image field value.
    image:
      // Continue the surrounding logic with this statement.
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80',
    // Provide the href field value.
    href: '/',
  },
  {
    // Provide the title field value.
    title: 'Convertible weekends',
    // Provide the image field value.
    image:
      // Continue the surrounding logic with this statement.
      'https://images.unsplash.com/photo-1527786356703-4b100091cd2c?auto=format&fit=crop&w=900&q=80',
    // Provide the href field value.
    href: '/about',
  },
  {
    // Provide the title field value.
    title: 'City & village escapes',
    // Provide the image field value.
    image:
      // Continue the surrounding logic with this statement.
      'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=900&q=80',
    // Provide the href field value.
    href: '/how-to-book',
  },
// Apply the TypeScript type assertion for this value.
] as const;

// Export the deal tab id type.
export type DealTabId = 'cities' | 'regions';

// Export the deal tabs const.
export const dealTabs: {
  // Provide the id field value.
  id: DealTabId;
  // Provide the label field value.
  label: string;
  // Provide the links field value.
  links: { label: string; href: string }[];
// Continue the surrounding logic with this statement.
}[] = [
  {
    // Provide the id field value.
    id: 'cities',
    // Provide the label field value.
    label: 'Great deals in top cities',
    // Provide the links field value.
    links: [
      // Contribute this line to the enclosing declaration or statement.
      { label: 'Sofia', href: '/' },
      // Contribute this line to the enclosing declaration or statement.
      { label: 'Varna', href: '/' },
      // Contribute this line to the enclosing declaration or statement.
      { label: 'Burgas', href: '/' },
      // Contribute this line to the enclosing declaration or statement.
      { label: 'Plovdiv', href: '/' },
      // Contribute this line to the enclosing declaration or statement.
      { label: 'Sunny Beach', href: '/' },
      // Contribute this line to the enclosing declaration or statement.
      { label: 'Nesebar', href: '/contact' },
    ],
  },
  {
    // Provide the id field value.
    id: 'regions',
    // Provide the label field value.
    label: 'Best rates in popular regions',
    // Provide the links field value.
    links: [
      // Contribute this line to the enclosing declaration or statement.
      { label: 'Black Sea Coast', href: '/' },
      // Contribute this line to the enclosing declaration or statement.
      { label: 'Rhodope Mountains', href: '/about' },
      // Contribute this line to the enclosing declaration or statement.
      { label: 'Pirin & Bansko', href: '/' },
      // Contribute this line to the enclosing declaration or statement.
      { label: 'Danube towns', href: '/contact' },
      // Contribute this line to the enclosing declaration or statement.
      { label: 'Rose Valley', href: '/how-to-book' },
      // Contribute this line to the enclosing declaration or statement.
      { label: 'Thracian Plain', href: '/about' },
    ],
  },
];
