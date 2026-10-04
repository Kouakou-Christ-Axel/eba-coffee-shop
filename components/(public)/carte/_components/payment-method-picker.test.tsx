// components/(public)/carte/_components/payment-method-picker.test.tsx
//
// Choix du moyen de paiement au checkout. Pas de jsdom dans le projet : on vérifie
// le HTML rendu côté serveur (accessibilité comprise : groupe radio, état coché).

import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PaymentMethodPicker } from './payment-method-picker';

const methods = ['wave', 'orange', 'mtn', 'moov', 'djamo'] as const;

const render = (
  props: Partial<React.ComponentProps<typeof PaymentMethodPicker>>
) =>
  renderToStaticMarkup(
    <PaymentMethodPicker
      methods={[...methods]}
      value={null}
      onChange={() => {}}
      {...props}
    />
  );

describe('PaymentMethodPicker', () => {
  it('propose chaque moyen avec le libellé utilisé partout dans l’app', () => {
    const html = render({});
    for (const label of [
      'Wave',
      'Orange Money',
      'MTN Money',
      'Moov Money',
      'Djamo',
    ]) {
      expect(html).toContain(label);
    }
  });

  it('est un groupe radio accessible', () => {
    const html = render({});
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g)).toHaveLength(5);
  });

  it('coche uniquement le moyen choisi', () => {
    const html = render({ value: 'orange' });
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html.match(/aria-checked="false"/g)).toHaveLength(4);
  });

  it("n'affiche que les moyens fournis par le serveur", () => {
    const html = render({ methods: ['wave', 'mtn'] });
    expect(html).toContain('Wave');
    expect(html).toContain('MTN Money');
    expect(html).not.toContain('Djamo');
  });

  it('annonce une erreur au lecteur d’écran', () => {
    const html = render({ error: 'Choisis un moyen de paiement' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Choisis un moyen de paiement');
  });

  it("n'affiche aucune alerte sans erreur", () => {
    expect(render({})).not.toContain('role="alert"');
  });
});
