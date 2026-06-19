'use client';

import { Select, SelectItem } from '@heroui/react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { InventoryItemView } from '@/lib/inventory';

export type ItemFormValues = {
  name: string;
  unit: string;
  category: string;
  safetyStock: string;
  reorderPoint: string;
  supplier: string;
  notes: string;
  initialQuantity: string;
  initialUnitCost: string;
};

export const emptyItem: ItemFormValues = {
  name: '',
  unit: 'UNIT',
  category: '',
  safetyStock: '',
  reorderPoint: '',
  supplier: '',
  notes: '',
  initialQuantity: '',
  initialUnitCost: '',
};

export function itemFromView(v: InventoryItemView): ItemFormValues {
  return {
    name: v.name,
    unit: v.unit,
    category: v.category ?? '',
    safetyStock: String(v.safetyStock),
    reorderPoint: v.reorderPoint === null ? '' : String(v.reorderPoint),
    supplier: v.supplier ?? '',
    notes: v.notes ?? '',
    initialQuantity: '',
    initialUnitCost: '',
  };
}

const UNIT_OPTIONS = [
  { value: 'UNIT', label: 'Unité' },
  { value: 'KG', label: 'Kg' },
  { value: 'G', label: 'g' },
  { value: 'L', label: 'L' },
  { value: 'ML', label: 'mL' },
  { value: 'BOX', label: 'Carton' },
] as const;

export function ItemForm({
  values,
  onChange,
  isNew,
}: {
  values: ItemFormValues;
  onChange: (v: ItemFormValues) => void;
  isNew: boolean;
}) {
  function set<K extends keyof ItemFormValues>(
    key: K,
    value: ItemFormValues[K]
  ) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="inv-name">Nom</Label>
          <Input
            id="inv-name"
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Ex. Café Arabica"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-unit">Unité</Label>
          <Select
            id="inv-unit"
            aria-label="Unité"
            size="sm"
            selectedKeys={[values.unit]}
            disallowEmptySelection
            onSelectionChange={(keys) =>
              set('unit', String(Array.from(keys)[0] ?? 'UNIT'))
            }
          >
            {UNIT_OPTIONS.map((u) => (
              <SelectItem key={u.value}>{u.label}</SelectItem>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-category">Catégorie (optionnel)</Label>
          <Input
            id="inv-category"
            value={values.category}
            onChange={(e) => set('category', e.target.value)}
            placeholder="Ex. Boissons"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-safety">Stock de sécurité</Label>
          <Input
            id="inv-safety"
            type="number"
            min={0}
            inputMode="numeric"
            value={values.safetyStock}
            onChange={(e) => set('safetyStock', e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-reorder">Point de réappro. (optionnel)</Label>
          <Input
            id="inv-reorder"
            type="number"
            min={0}
            inputMode="numeric"
            value={values.reorderPoint}
            onChange={(e) => set('reorderPoint', e.target.value)}
            placeholder="—"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-supplier">Fournisseur (optionnel)</Label>
          <Input
            id="inv-supplier"
            value={values.supplier}
            onChange={(e) => set('supplier', e.target.value)}
            placeholder="Ex. Grossiste local"
          />
        </div>
      </div>

      {isNew && (
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Stock d’ouverture (optionnel)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-qty">Quantité initiale</Label>
              <Input
                id="inv-qty"
                type="number"
                min={0}
                inputMode="decimal"
                value={values.initialQuantity}
                onChange={(e) => set('initialQuantity', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-cost">Coût unitaire (FCFA)</Label>
              <Input
                id="inv-cost"
                type="number"
                min={0}
                inputMode="numeric"
                value={values.initialUnitCost}
                onChange={(e) => set('initialUnitCost', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="inv-notes">Notes (optionnel)</Label>
        <Textarea
          id="inv-notes"
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Détails, conditionnement…"
        />
      </div>
    </div>
  );
}
