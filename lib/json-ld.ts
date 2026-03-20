import { ENV } from 'varlock/env';

const siteUrl = ENV.NEXT_PUBLIC_SITE_URL;
export const homeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CafeOrCoffeeShop',
  name: 'EBA Coffee Shop',
  image: `${siteUrl}/og/home-coffee.jpg`,
  url: siteUrl,
  telephone: '+2250502361818',
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
      ],
      opens: '10:00',
      closes: '18:00',
    },
  ],
};
