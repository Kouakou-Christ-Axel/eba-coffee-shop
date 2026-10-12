import type { ItemFormValues } from '../../item-form';

/** '' → undefined, sinon valeur trimée. */
export function strOrUndef(s: string): string | undefined {
  const t = s.trim();
  return t === '' ? undefined : t;
}

/** '' → undefined, sinon Number. */
export function numOrUndef(s: string): number | undefined {
  const t = s.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export function toCreateInput(v: ItemFormValues) {
  return {
    name: v.name.trim(),
    unit: v.unit,
    category: strOrUndef(v.category),
    safetyStock: numOrUndef(v.safetyStock),
    reorderPoint: numOrUndef(v.reorderPoint),
    supplier: strOrUndef(v.supplier),
    notes: strOrUndef(v.notes),
    initialQuantity: numOrUndef(v.initialQuantity),
    initialUnitCost: numOrUndef(v.initialUnitCost),
  };
}

export function toUpdateInput(v: ItemFormValues) {
  return {
    name: v.name.trim(),
    unit: v.unit,
    category: strOrUndef(v.category) ?? null,
    safetyStock: numOrUndef(v.safetyStock),
    reorderPoint: numOrUndef(v.reorderPoint) ?? null,
    supplier: strOrUndef(v.supplier) ?? null,
    notes: strOrUndef(v.notes) ?? null,
  };
}
