// lib/json-ld.test.ts
import { describe, it, expect, vi } from 'vitest';

// `lib/json-ld.ts` lit la racine du site AU CHARGEMENT DU MODULE
// (`const siteUrl = getSiteUrl()`), donc le mock doit précéder l'import —
// même contrainte que `app/llms.txt/route.test.ts`. La racine porte ici un
// slash final volontaire : c'est la forme réellement saisie dans l'hébergeur,
// celle qui produisait des `//` dans les URL absolues.
vi.mock('varlock/env', () => ({
  ENV: { NEXT_PUBLIC_SITE_URL: 'https://eba-coffee.com/' },
}));

import { DEFAULT_CONTACT_SETTINGS } from '@/lib/contact-settings';
import type { ContactSettings } from '@/lib/contact-settings';
import { DEFAULT_SETTINGS } from '@/lib/pickup-settings';
import type { WeeklyHours } from '@/lib/pickup-settings';
import { buildHomeJsonLd, buildBreadcrumbJsonLd } from './json-ld';

function contactWith(overrides: Partial<ContactSettings>): ContactSettings {
  return { ...DEFAULT_CONTACT_SETTINGS, ...overrides };
}

/** Horaires réels du commerce : lundi fermé, dimanche en après-midi. */
const REAL_HOURS: WeeklyHours = {
  '1': [],
  '2': [{ start: '08:30', end: '19:00' }],
  '3': [{ start: '08:30', end: '19:00' }],
  '4': [{ start: '08:30', end: '19:00' }],
  '5': [{ start: '08:30', end: '19:00' }],
  '6': [{ start: '09:00', end: '19:00' }],
  '0': [{ start: '13:00', end: '19:00' }],
};

describe('buildHomeJsonLd', () => {
  const home = () =>
    buildHomeJsonLd(DEFAULT_CONTACT_SETTINGS, DEFAULT_SETTINGS.weeklyHours);

  it('situe le commerce à sa position réelle', () => {
    // Position du `mapsEmbedUrl` des réglages de contact (`!3d`/`!2d`). La
    // valeur précédente (5.359952 / -3.994028) pointait à ~6 km d'ici.
    expect(home().geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: 5.4037601,
      longitude: -3.9601476,
    });
  });

  it('déclare à la fois CafeOrCoffeeShop et LocalBusiness', () => {
    // Beaucoup d'outils cherchent `LocalBusiness` littéralement sans remonter
    // la hiérarchie schema.org — les deux libellés doivent rester présents.
    expect(home()['@type']).toEqual(
      expect.arrayContaining(['CafeOrCoffeeShop', 'LocalBusiness'])
    );
  });

  it('place la ville en localité et le quartier des réglages en région', () => {
    const jsonLd = buildHomeJsonLd(
      contactWith({
        address: 'Rue Yvette Tiessé Duru, Abidjan',
        district: 'Cocody, Angré',
      }),
      DEFAULT_SETTINGS.weeklyHours
    );
    expect(jsonLd.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: 'Rue Yvette Tiessé Duru, Abidjan',
      addressLocality: 'Abidjan',
      addressRegion: 'Cocody, Angré',
      addressCountry: 'CI',
    });
  });

  it('reprend le contact des réglages, jamais des constantes figées', () => {
    const jsonLd = buildHomeJsonLd(
      contactWith({ phone: '+225 01 61 33 99 43', email: 'bonjour@eba.ci' }),
      DEFAULT_SETTINGS.weeklyHours
    );
    expect(jsonLd.telephone).toBe('+225 01 61 33 99 43');
    expect(jsonLd.email).toBe('bonjour@eba.ci');
  });

  it("n'émet pas d'entrée vide dans sameAs pour un réseau non renseigné", () => {
    const jsonLd = buildHomeJsonLd(
      contactWith({
        instagramUrl: 'https://www.instagram.com/eba.coffeeshop/',
        tiktokUrl: 'https://www.tiktok.com/@eba.coffeeshop',
        facebookUrl: '',
        xUrl: '',
        linkedinUrl: '',
        youtubeUrl: '',
      }),
      DEFAULT_SETTINGS.weeklyHours
    );
    expect(jsonLd.sameAs).toEqual([
      'https://www.instagram.com/eba.coffeeshop/',
      'https://www.tiktok.com/@eba.coffeeshop',
    ]);
  });

  it('construit des URL absolues sans double slash après le schéma', () => {
    const jsonLd = home();
    for (const url of [
      jsonLd['@id'],
      jsonLd.url,
      jsonLd.image,
      jsonLd.logo,
      jsonLd.hasMenu,
    ]) {
      expect(url.replace(/^https:\/\//, '')).not.toContain('//');
    }
  });

  describe('openingHoursSpecification', () => {
    it('regroupe les jours qui partagent les mêmes horaires', () => {
      const specs = buildHomeJsonLd(
        DEFAULT_CONTACT_SETTINGS,
        REAL_HOURS
      ).openingHoursSpecification;

      expect(specs).toEqual([
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Sunday'],
          opens: '13:00',
          closes: '19:00',
        },
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '08:30',
          closes: '19:00',
        },
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Saturday'],
          opens: '09:00',
          closes: '19:00',
        },
      ]);
    });

    it("n'émet aucune entrée pour un jour fermé", () => {
      const days = buildHomeJsonLd(
        DEFAULT_CONTACT_SETTINGS,
        REAL_HOURS
      ).openingHoursSpecification.flatMap((s) => s.dayOfWeek);
      expect(days).not.toContain('Monday');
    });
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it("place l'accueil en tête sans le faire figurer dans les items fournis", () => {
    const jsonLd = buildBreadcrumbJsonLd([
      { name: 'Le lieu', path: '/le-lieu' },
    ]);
    expect(jsonLd.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: 'https://eba-coffee.com/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Le lieu',
        item: 'https://eba-coffee.com/le-lieu',
      },
    ]);
  });
});
