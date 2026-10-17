// components/(public)/legal/privacy-content.test.tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Le fil d'Ariane JSON-LD lit varlock (non initialisé en test).
vi.mock('@/components/(public)/breadcrumb-json-ld', () => ({
  BreadcrumbJsonLd: () => null,
}));
import { PrivacyContent } from './privacy-content';
import { DEFAULT_CONTACT_SETTINGS } from '@/lib/contact-settings';
import { PROCESSORS, RETENTION } from '@/config/data-protection';

describe('PrivacyContent', () => {
  const html = renderToStaticMarkup(
    <PrivacyContent contact={DEFAULT_CONTACT_SETTINGS} />
  );

  it('cite la loi ivoirienne, l’ARTCI et les droits', () => {
    expect(html).toContain('2013-450');
    expect(html).toContain('ARTCI');
    expect(html).toContain('Vos droits');
    expect(html).toContain(DEFAULT_CONTACT_SETTINGS.email);
  });

  it('affiche « à compléter » tant que l’identité légale est vide', () => {
    expect(html).toContain('à compléter');
  });

  it('liste chaque prestataire hors Côte d’Ivoire et les durées de la grille', () => {
    for (const p of PROCESSORS) expect(html).toContain(p.name.split(' (')[0]);
    expect(html).toContain(`${RETENTION.orderYears} ans`);
    expect(html).toContain(`${RETENTION.pollVoteMetaDays} jours`);
  });

  it('utilise l’adresse dédiée aux droits quand elle est renseignée', () => {
    const custom = renderToStaticMarkup(
      <PrivacyContent
        contact={{ ...DEFAULT_CONTACT_SETTINGS, privacyEmail: 'dpo@eba.ci' }}
      />
    );
    expect(custom).toContain('dpo@eba.ci');
  });
});
