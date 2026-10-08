import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isParkable,
  pruneParked,
  summarizeParked,
  useParkedOrdersStore,
  type OrderDraftSnapshot,
  type ParkedOrder,
} from './parked-orders-store';
import type { CartItem } from './cart-store';
import { PARKED_ORDER_MAX_AGE_MS, PARKED_ORDERS_MAX } from '@/config/constants';

const item = (over: Partial<CartItem> = {}): CartItem => ({
  cartId: 'a',
  productId: 'p1',
  productName: 'Crêpe',
  basePrice: 1000,
  coutMatiere: 0,
  coutEmballage: 0,
  quantity: 2,
  supplements: [],
  ...over,
});

const draft = (over: Partial<OrderDraftSnapshot> = {}): OrderDraftSnapshot => ({
  step: 'catalog',
  items: [item()],
  customerName: 'Awa',
  customerPhone: '0102030405',
  orderType: 'DELIVERY',
  note: '',
  pickupTime: null,
  orderDate: null,
  loyaltyRewardId: null,
  ...over,
});

const parkedAt = (t: number, id = String(t)): ParkedOrder => ({
  ...draft(),
  id,
  parkedAt: t,
});

describe('parked orders', () => {
  beforeEach(() => {
    useParkedOrdersStore.setState({ parked: [], hasHydrated: true });
    vi.useRealTimers();
  });

  it('refuse de ranger une commande vide', () => {
    expect(isParkable(draft({ items: [] }))).toBe(false);
    expect(useParkedOrdersStore.getState().park(draft({ items: [] }))).toBe(
      null
    );
    expect(useParkedOrdersStore.getState().parked).toHaveLength(0);
  });

  it("park puis take restitue le brouillon à l'identique", () => {
    const d = draft({ step: 'review', note: 'sans sucre' });
    const id = useParkedOrdersStore.getState().park(d)!;
    const taken = useParkedOrdersStore.getState().take(id)!;
    expect(taken).toMatchObject(d);
    expect(useParkedOrdersStore.getState().parked).toHaveLength(0);
    expect(useParkedOrdersStore.getState().take(id)).toBeNull();
  });

  it('discard supprime', () => {
    const id = useParkedOrdersStore.getState().park(draft())!;
    useParkedOrdersStore.getState().discard(id);
    expect(useParkedOrdersStore.getState().parked).toHaveLength(0);
  });

  it('prune écarte les périmés et plafonne en gardant les plus récents', () => {
    const now = 10 * PARKED_ORDER_MAX_AGE_MS;
    const old = parkedAt(now - PARKED_ORDER_MAX_AGE_MS - 1);
    const fresh = Array.from({ length: PARKED_ORDERS_MAX + 2 }, (_, i) =>
      parkedAt(now - 1000 + i)
    );
    const out = pruneParked([old, ...fresh], now);
    expect(out).toHaveLength(PARKED_ORDERS_MAX);
    expect(out).not.toContain(old);
    expect(out[out.length - 1].parkedAt).toBe(now - 1000 + fresh.length - 1);
  });

  it('summarize compte les articles et le total net', () => {
    expect(
      summarizeParked(parkedAt(1)) // 2 × 1000
    ).toEqual({ itemCount: 2, total: 2000 });
  });
});
