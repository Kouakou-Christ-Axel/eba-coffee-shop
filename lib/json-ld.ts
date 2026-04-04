import { ENV } from 'varlock/env';
import { brandConfig } from '@/config/brand.config';

const siteUrl = ENV.NEXT_PUBLIC_SITE_URL;

export const homeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CafeOrCoffeeShop',
  name: 'EBA Coffee Shop',
  image: `${siteUrl}/og/home-coffee.jpg`,
  url: siteUrl,
  telephone: brandConfig.location.phone,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Boulevard Latrille',
    addressLocality: 'Cocody, Abidjan',
    addressCountry: 'CI',
  },
  priceRange: '$$',
  servesCuisine: ['Coffee', 'Brunch', 'Desserts', 'Pastries', 'Snacks'],
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      opens: '07:30',
      closes: '21:30',
    },
  ],
};
