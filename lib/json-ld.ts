import { ENV } from 'varlock/env';
import { brandConfig } from '@/config/brand.config';
import type { MenuCategory } from '@/config/menu';
import type { ContactSettings } from '@/lib/contact-settings';

const siteUrl = ENV.NEXT_PUBLIC_SITE_URL;

/** Chemin relatif (`/uploads/...`) → URL absolue ; une URL déjà absolue
 * (Cloudinary, http(s)) est renvoyée telle quelle. */
function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${siteUrl}${path}`;
}

/** JSON-LD `CafeOrCoffeeShop` (schema.org) pour la page d'accueil, rendu dans
 * le `<head>` racine (`app/layout.tsx`). Le téléphone/email/adresse/réseaux
 * viennent des réglages de contact en base (`lib/contact-settings-db.ts`) —
 * la localité/région/coordonnées GPS restent statiques (le commerce ne
 * déménage pas, contrairement au téléphone/email qui peuvent changer). */
export function buildHomeJsonLd(contact: ContactSettings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    '@id': `${siteUrl}/#organization`,
    name: 'EBA Coffee Shop',
    description:
      'Coffee shop et pâtisserie artisanale à Cocody, Abidjan. Cafés de spécialité, pâtisseries maison, brunch et ambiance chaleureuse.',
    image: `${siteUrl}/og/home-coffee.jpg`,
    url: siteUrl,
    telephone: contact.phone,
    email: contact.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: contact.address,
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
    sameAs: [contact.instagramUrl, contact.tiktokUrl],
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
        opens: contact.openingTime,
        closes: contact.closingTime,
      },
    ],
  };
}

/**
 * JSON-LD `Menu` (schema.org) pour `/carte`, rendu depuis le même appel
 * `getMenu()` que la page (aucune requête supplémentaire) — voir
 * `components/(public)/carte/carte-menu-section.tsx`. Chaque catégorie
 * devient une `MenuSection`, chaque produit un `MenuItem` avec son `Offer`
 * (prix en XOF, francs CFA — entiers, pas de décimales).
 */
export function buildMenuJsonLd(menuData: MenuCategory[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': `${siteUrl}/carte#menu`,
    name: 'Carte — EBA Coffee Shop',
    inLanguage: 'fr',
    hasMenuSection: menuData.map((category) => ({
      '@type': 'MenuSection',
      '@id': `${siteUrl}/carte#${category.id}`,
      name: category.name,
      hasMenuItem: category.products.map((product) => ({
        '@type': 'MenuItem',
        name: product.name,
        description: product.description || undefined,
        image: product.image ? absoluteUrl(product.image) : undefined,
        offers: {
          '@type': 'Offer',
          price: product.price,
          priceCurrency: 'XOF',
        },
      })),
    })),
  };
}

export type BreadcrumbItem = {
  name: string;
  /** Chemin relatif (`/carte`) ou URL absolue déjà résolue. */
  path: string;
};

/** JSON-LD `BreadcrumbList` (schema.org) générique, pour les pages publiques
 * autres que l'accueil (`/carte`, `/sondages`, `/a-propos`, `/le-lieu`,
 * `/contact`…). L'accueil (`/`) n'apparaît pas dans la liste elle-même —
 * c'est l'élément de départ implicite, jamais un des `itemListElement`. */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Accueil', path: '/' }, ...items].map(
      (item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: absoluteUrl(item.path),
      })
    ),
  };
}
