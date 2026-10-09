import type { Product } from '@/config/menu';
import type { CartItemSupplement } from '@/lib/cart-store';
import {
  type Selections,
  type SupplementRules,
  isOptionSoldOut,
} from './rules';

export function buildInitialSelections(
  product: Product | null,
  initial: CartItemSupplement[]
): Selections {
  const out: Selections = {};
  (product?.supplements ?? []).forEach((group) => {
    const picked = initial.filter((s) => s.groupName === group.name);
    if (group.type === 'single') {
      out[group.name] = picked[0]?.optionName ?? '';
    } else if (group.type === 'multiple') {
      out[group.name] = picked.map((s) => s.optionName);
    } else {
      const qty: Record<string, number> = {};
      picked.forEach((s) => {
        qty[s.optionName] = s.quantity ?? 1;
      });
      out[group.name] = qty;
    }
  });
  return out;
}

/** Convertit l'état de sélection en suppléments prêts pour le panier. */
export function getSelectedSupplements(
  product: Product,
  selections: Selections,
  rules?: SupplementRules
): CartItemSupplement[] {
  const result: CartItemSupplement[] = [];
  (product.supplements ?? []).forEach((group) => {
    const sel = selections[group.name];
    if (group.type === 'single') {
      if (
        typeof sel === 'string' &&
        sel &&
        !isOptionSoldOut(group, sel, rules)
      ) {
        const opt = group.options.find((o) => o.name === sel);
        if (opt) {
          result.push({
            groupName: group.name,
            optionName: opt.name,
            price: opt.price,
          });
        }
      }
    } else if (group.type === 'multiple') {
      if (Array.isArray(sel)) {
        sel.forEach((name) => {
          if (isOptionSoldOut(group, name, rules)) return;
          const opt = group.options.find((o) => o.name === name);
          if (opt) {
            result.push({
              groupName: group.name,
              optionName: opt.name,
              price: opt.price,
            });
          }
        });
      }
    } else {
      const qty = (sel as Record<string, number>) ?? {};
      group.options.forEach((opt) => {
        if (opt.soldOut && !rules?.ignoreSoldOut) return;
        const n = qty[opt.name] ?? 0;
        if (n > 0) {
          result.push({
            groupName: group.name,
            optionName: opt.name,
            price: opt.price,
            quantity: n,
          });
        }
      });
    }
  });
  return result;
}

export function getSupplementsPrice(supplements: CartItemSupplement[]): number {
  return supplements.reduce((sum, s) => sum + s.price * (s.quantity ?? 1), 0);
}
