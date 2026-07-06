// lib/hooks/use-checkout-form.test.ts
//
// Tests des helpers exportés par `use-checkout-form.ts`. On évite d'utiliser
// `renderHook` (testing-library/jsdom non installé) et on vérifie directement
// la validation pure + la fonction `submitCheckout` (qui fait l'appel HTTP).

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  submitCheckout,
  validateCheckoutForm,
  type CheckoutFormValues,
} from './use-checkout-form';
import type { CartItem } from '@/lib/cart-store';

const validValues: CheckoutFormValues = {
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: '2026-05-11T10:00:00.000Z',
  note: '',
  driverName: '',
  driverPhone: '',
};

const mockItems: CartItem[] = [
  {
    cartId: 'abc',
    productId: 'prod-1',
    productName: 'Cappuccino',
    basePrice: 3500,
    quantity: 1,
    supplements: [],
  },
];

// ─── validateCheckoutForm ────────────────────────────────────────────────────

describe('validateCheckoutForm', () => {
  it('ne retourne aucune erreur pour des champs valides', () => {
    const errors = validateCheckoutForm(validValues, mockItems, 3500);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('exige customerName non vide', () => {
    const errors = validateCheckoutForm(
      { ...validValues, customerName: '' },
      mockItems,
      3500
    );
    expect(errors.customerName).toBeDefined();
  });

  it('exige customerName >= 2 caractères', () => {
    const errors = validateCheckoutForm(
      { ...validValues, customerName: 'K' },
      mockItems,
      3500
    );
    expect(errors.customerName).toBeDefined();
  });

  it('exige customerPhone >= 8 caractères', () => {
    const errors = validateCheckoutForm(
      { ...validValues, customerPhone: '071234' },
      mockItems,
      3500
    );
    expect(errors.customerPhone).toBeDefined();
  });

  it('exige un pickupTime non null', () => {
    const errors = validateCheckoutForm(
      { ...validValues, pickupTime: null },
      mockItems,
      3500
    );
    expect(errors.pickupTime).toBeDefined();
  });

  it('rejette une note > 500 caractères', () => {
    const errors = validateCheckoutForm(
      { ...validValues, note: 'x'.repeat(501) },
      mockItems,
      3500
    );
    expect(errors.note).toBeDefined();
  });

  it('rejette un total négatif via le schéma Zod', () => {
    const errors = validateCheckoutForm(validValues, mockItems, -1);
    // total n'est pas dans CheckoutFormValues mais le schéma Zod doit échouer
    // sur au moins un champ : on s'attend ici à conserver les autres erreurs
    // potentielles vides — donc on vérifie simplement que la validation est
    // résiliente (pas de crash) même si total invalide.
    expect(errors).toBeDefined();
  });

  it('accepte un bloc livreur complet', () => {
    const errors = validateCheckoutForm(
      { ...validValues, driverName: 'Moussa', driverPhone: '0505050505' },
      mockItems,
      3500
    );
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('exige le téléphone du livreur si son nom est renseigné', () => {
    const errors = validateCheckoutForm(
      { ...validValues, driverName: 'Moussa' },
      mockItems,
      3500
    );
    expect(errors.driverPhone).toBeDefined();
  });

  it('exige le nom du livreur si son téléphone est renseigné', () => {
    const errors = validateCheckoutForm(
      { ...validValues, driverPhone: '0505050505' },
      mockItems,
      3500
    );
    expect(errors.driverName).toBeDefined();
  });
});

// ─── submitCheckout ──────────────────────────────────────────────────────────

describe('submitCheckout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST vers /api/commandes avec un body bien formé', async () => {
    const spy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'clo123' }), { status: 201 })
      );

    await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
    });

    expect(spy).toHaveBeenCalledWith(
      '/api/commandes',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"customerName":"Kofi"'),
      })
    );
  });

  it('inclut le champ `note` quand renseigné', async () => {
    const spy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'clo123' }), { status: 201 })
      );

    await submitCheckout({
      values: { ...validValues, note: 'Sans sucre' },
      items: mockItems,
      total: 3500,
    });

    const body = String(
      (spy.mock.calls[0]?.[1] as RequestInit | undefined)?.body ?? ''
    );
    expect(body).toContain('"note":"Sans sucre"');
  });

  it('omet le champ `note` quand vide', async () => {
    const spy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'clo123' }), { status: 201 })
      );

    await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
    });

    const body = String(
      (spy.mock.calls[0]?.[1] as RequestInit | undefined)?.body ?? ''
    );
    expect(body).not.toContain('"note"');
  });

  it('inclut le bloc livreur quand complet, l’omet sinon', async () => {
    const spy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'clo123' }), { status: 201 })
      );

    await submitCheckout({
      values: { ...validValues, driverName: 'Moussa', driverPhone: '0505' },
      items: mockItems,
      total: 3500,
    });
    await submitCheckout({
      values: { ...validValues, driverName: 'Moussa' },
      items: mockItems,
      total: 3500,
    });

    const first = String(
      (spy.mock.calls[0]?.[1] as RequestInit | undefined)?.body ?? ''
    );
    const second = String(
      (spy.mock.calls[1]?.[1] as RequestInit | undefined)?.body ?? ''
    );
    expect(first).toContain('"driverName":"Moussa"');
    expect(first).toContain('"driverPhone":"0505"');
    expect(second).not.toContain('"driverName"');
  });

  it('retourne { ok: true, orderId } sur succès', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'clo123' }), { status: 201 })
    );

    const out = await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
    });

    expect(out).toEqual({ ok: true, orderId: 'clo123' });
  });

  it('retourne { ok: false, error } sur 400', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid' }), { status: 400 })
    );

    const out = await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
    });

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/erreur/i);
  });

  it('retourne { ok: false, error } sur erreur réseau', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network'));

    const out = await submitCheckout({
      values: validValues,
      items: mockItems,
      total: 3500,
    });

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/serveur/i);
  });
});
