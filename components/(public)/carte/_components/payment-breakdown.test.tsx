// components/(public)/carte/_components/payment-breakdown.test.tsx
//
// Récapitulatif du montant avec paiement en ligne : le client doit voir la ligne
// de frais ET le total à payer AVANT de cliquer, jamais découvrir les frais chez
// le fournisseur.

import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PaymentBreakdown } from './payment-breakdown';

const text = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
// Le formateur fr-FR sépare les milliers par une espace fine insécable.
const digits = (html: string) => text(html).replace(/[\s  ]/g, '');

describe('PaymentBreakdown', () => {
  it('montre les frais, leur taux et le total à payer', () => {
    const html = renderToStaticMarkup(
      <PaymentBreakdown netTotal={3000} fee={30} feePercent={1} />
    );
    expect(text(html)).toContain('Frais de paiement en ligne (1 %)');
    expect(digits(html)).toContain('+30F');
    expect(text(html)).toContain('Total à payer');
    expect(digits(html)).toContain('3030F');
  });

  it("n'affiche pas de ligne de frais quand il n'y en a pas", () => {
    const html = renderToStaticMarkup(
      <PaymentBreakdown netTotal={0} fee={0} feePercent={1} />
    );
    expect(text(html)).not.toContain('Frais');
    expect(text(html)).toContain('Total à payer');
  });

  it('écrit le taux à la française (1,5 %)', () => {
    const html = renderToStaticMarkup(
      <PaymentBreakdown netTotal={2000} fee={30} feePercent={1.5} />
    );
    expect(text(html)).toContain('(1,5 %)');
  });
});
