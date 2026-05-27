import { ENV } from 'varlock/env';
import { brandConfig } from '@/config/brand.config';

const siteUrl = ENV.NEXT_PUBLIC_SITE_URL;

export const homeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CafeOrCoffeeShop',
  '@id': `${siteUrl}/#organization`,
  name: 'EBA Coffee Shop',
  description:
    'Coffee shop et pâtisserie artisanale à Cocody, Abidjan. Cafés de spécialité, pâtisseries maison, brunch et ambiance chaleureuse.',
  image: `${siteUrl}/og/home-coffee.jpg`,
  url: siteUrl,
  telephone: brandConfig.location.phone,
  email: brandConfig.links.contact.email.display,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Boulevard Latrille',
    addressLocality: 'Cocody',
    addressRegion: 'Abidjan',
    addressCountry: 'CI',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 5.359952,
    longitude: -3.994028,
  },
  areaServed: {
    '@type': 'City',
    name: 'Abidjan',
  },
  hasMenu: `${siteUrl}/carte`,
  priceRange: '$$',
  currenciesAccepted: 'XOF',
  paymentAccepted: 'Cash, Mobile Money, Carte bancaire',
  servesCuisine: [
    'Café de spécialité',
    'Pâtisserie française',
    'Brunch',
    'Boissons signatures',
  ],
  sameAs: [
    brandConfig.links.social.instagram.href,
    brandConfig.links.social.tiktok.href,
  ],
  founder: {
    '@type': 'Person',
    name: brandConfig.founderName,
    jobTitle: 'Pâtissière',
  },
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
      opens: brandConfig.location.openingTime,
      closes: brandConfig.location.closingTime,
    },
  ],
};
