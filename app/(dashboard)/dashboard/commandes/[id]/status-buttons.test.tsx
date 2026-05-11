// app/(dashboard)/dashboard/commandes/[id]/status-buttons.test.tsx
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../actions', () => ({
  updateOrderStatus: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useTransition: () => [false, (fn: () => void) => fn()],
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    variant?: string;
  }) =>
    React.createElement(
      'button',
      { disabled, 'data-variant': variant },
      children
    ),
}));

import { StatusButtons } from './status-buttons';

describe('StatusButtons', () => {
  it('affiche Confirmer et Annuler pour PENDING', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusButtons, {
        orderId: 'o1',
        currentStatus: 'PENDING',
      })
    );
    expect(html).toContain('Confirmer');
    expect(html).toContain('Annuler');
  });

  it('affiche Marquer comme prête et Annuler pour CONFIRMED', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusButtons, {
        orderId: 'o1',
        currentStatus: 'CONFIRMED',
      })
    );
    expect(html).toContain('Marquer comme prête');
    expect(html).toContain('Annuler');
  });

  it('affiche uniquement Marquer comme récupérée pour READY', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusButtons, {
        orderId: 'o1',
        currentStatus: 'READY',
      })
    );
    expect(html).toContain('Marquer comme récupérée');
    expect(html).not.toContain('Annuler');
  });

  it('affiche rien pour PICKED_UP (lecture seule)', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusButtons, {
        orderId: 'o1',
        currentStatus: 'PICKED_UP',
      })
    );
    expect(html).toBe('');
  });

  it('affiche rien pour CANCELLED (lecture seule)', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusButtons, {
        orderId: 'o1',
        currentStatus: 'CANCELLED',
      })
    );
    expect(html).toBe('');
  });
});
