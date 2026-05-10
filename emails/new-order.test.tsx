// emails/new-order.test.tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NewOrderEmail from './new-order';

const mockOrder = {
  id: 'clorder123',
  reference: 'EBA-20260510-AB12',
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: new Date('2026-05-10T14:30:00'),
  items: [
    {
      cartId: 'abc',
      productId: 'prod-1',
      productName: 'Cappuccino',
      basePrice: 3500,
      quantity: 2,
      supplements: [
        { groupName: 'Lait', optionName: 'Lait de soja', price: 500 },
      ],
    },
  ],
  total: 8000,
};

describe('NewOrderEmail', () => {
  it('contient la référence de commande', () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('EBA-20260510-AB12');
  });

  it('contient le prénom du client', () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('Kofi');
  });

  it('contient le téléphone du client', () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('07001234');
  });

  it("contient l'heure de retrait (HHhMM)", () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('14h30');
  });

  it('contient le nom des articles', () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('Cappuccino');
  });

  it('contient le nom des suppléments', () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('Lait de soja');
  });

  it('contient le total en FCFA', () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('FCFA');
    // Intl.NumberFormat('fr-FR').format(8000) → "8 000" (espace fine ou insécable)
    expect(html).toMatch(/8.000/);
  });

  it('contient un lien vers le dashboard', () => {
    const html = renderToStaticMarkup(<NewOrderEmail order={mockOrder} />);
    expect(html).toContain('/dashboard/commandes/clorder123');
  });
});
