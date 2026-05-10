import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateCheckoutInput, submitCheckoutForm } from './checkout-submit';
import type { CheckoutFields } from './checkout-submit';
import type { CartItem } from '@/lib/cart-store';

const validFields: CheckoutFields = {
  customerName: 'Kofi',
  customerPhone: '07001234',
  pickupTime: '2026-05-11T10:00:00.000Z',
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

// ─── validateCheckoutInput ────────────────────────────────────────────────────

describe('validateCheckoutInput', () => {
  it('retourne un objet vide si les champs sont valides', () => {
    const errors = validateCheckoutInput(validFields);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('retourne une erreur si customerName est vide', () => {
    const errors = validateCheckoutInput({ ...validFields, customerName: '' });
    expect(errors.customerName).toBeDefined();
  });

  it('retourne une erreur si customerName est trop court (< 2 chars)', () => {
    const errors = validateCheckoutInput({ ...validFields, customerName: 'K' });
    expect(errors.customerName).toBeDefined();
  });

  it('retourne une erreur si customerPhone est trop court (< 8 chars)', () => {
    const errors = validateCheckoutInput({
      ...validFields,
      customerPhone: '071234',
    });
    expect(errors.customerPhone).toBeDefined();
  });

  it('retourne une erreur si pickupTime est null', () => {
    const errors = validateCheckoutInput({ ...validFields, pickupTime: null });
    expect(errors.pickupTime).toBeDefined();
  });
});

// ─── submitCheckoutForm ───────────────────────────────────────────────────────

describe('submitCheckoutForm', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appelle onError sans appeler fetch si les champs sont invalides', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const onError = vi.fn();

    await submitCheckoutForm({
      fields: { ...validFields, customerName: '' },
      items: mockItems,
      total: 3500,
      onSuccess: vi.fn(),
      onError,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('appelle POST /api/commandes avec les bons champs', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'clorder123', reference: 'EBA-20260511-AB12' }),
        { status: 201 }
      )
    );

    await submitCheckoutForm({
      fields: validFields,
      items: mockItems,
      total: 3500,
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/commandes',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"customerName":"Kofi"'),
      })
    );
  });

  it("appelle onSuccess avec l'id après soumission réussie", async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'clorder123', reference: 'EBA-20260511-AB12' }),
        { status: 201 }
      )
    );

    const onSuccess = vi.fn();
    await submitCheckoutForm({
      fields: validFields,
      items: mockItems,
      total: 3500,
      onSuccess,
      onError: vi.fn(),
    });

    expect(onSuccess).toHaveBeenCalledWith('clorder123');
  });

  it("appelle onError avec un message si l'API retourne 400", async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid' }), { status: 400 })
    );

    const onError = vi.fn();
    await submitCheckoutForm({
      fields: validFields,
      items: mockItems,
      total: 3500,
      onSuccess: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ submit: expect.any(String) })
    );
  });

  it("appelle onError avec un message si l'API retourne 500", async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'server error' }), { status: 500 })
    );

    const onError = vi.fn();
    await submitCheckoutForm({
      fields: validFields,
      items: mockItems,
      total: 3500,
      onSuccess: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ submit: expect.any(String) })
    );
  });

  it('appelle onError si fetch lève une erreur réseau', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    const onError = vi.fn();
    await submitCheckoutForm({
      fields: validFields,
      items: mockItems,
      total: 3500,
      onSuccess: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ submit: expect.any(String) })
    );
  });
});
