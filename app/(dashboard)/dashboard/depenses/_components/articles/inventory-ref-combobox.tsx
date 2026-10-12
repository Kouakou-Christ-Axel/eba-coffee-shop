'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BASE_UNIT_TO_INVENTORY } from '@/lib/expense-units';
import { type BaseUnit } from '@/lib/expense-units';
import { type InventoryUnitInput } from '@/lib/schemas/inventory';
import { createInventoryReferenceAction } from '../../actions';
import type { InventoryItemOption } from './types';
import { selectClass } from './format';

/**
 * Sélecteur de référence d'inventaire recherchable, avec création à la volée. Auto-suffisant (pas d'overlay
 * portalé) : le piège de focus des Dialog casse les popovers dans le Sheet Radix.
 */
export function InventoryRefCombobox({
  items,
  value,
  onChange,
  onCreated,
  baseUnit,
}: {
  items: InventoryItemOption[];
  value: string;
  onChange: (id: string) => void;
  onCreated: (item: InventoryItemOption) => void;
  baseUnit: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.id === value) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
      )
    : items;
  const canCreate =
    q.length > 0 && !items.some((i) => i.name.trim().toLowerCase() === q);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  function pick(id: string) {
    onChange(id);
    setQuery('');
    setOpen(false);
    setError(null);
  }

  async function create() {
    const name = query.trim();
    if (!name || creating) return;
    setError(null);
    setCreating(true);
    const invUnit =
      baseUnit && baseUnit in BASE_UNIT_TO_INVENTORY
        ? (BASE_UNIT_TO_INVENTORY[baseUnit as BaseUnit] as InventoryUnitInput)
        : undefined;
    const r = await createInventoryReferenceAction({ name, unit: invUnit });
    setCreating(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onCreated(r.item);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          selectClass,
          'flex items-center justify-between gap-2 text-left'
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected
            ? `${selected.name} (${selected.sku}, ${selected.unit})`
            : '— Aucune —'}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <div className="relative mb-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une référence…"
              className="h-8 pl-8"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            <button
              type="button"
              onClick={() => pick('')}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="text-muted-foreground">— Aucune —</span>
              {!value && <Check className="h-4 w-4" />}
            </button>
            {filtered.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => pick(i.id)}
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span className="truncate">
                  {i.name}{' '}
                  <span className="text-muted-foreground">
                    ({i.sku}, {i.unit})
                  </span>
                </span>
                {value === i.id && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && !canCreate && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                Aucune référence.
              </p>
            )}
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={create}
              disabled={creating}
              className="mt-1 flex w-full items-center gap-1.5 rounded-sm border-t px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Créer la référence « {query.trim()} »
            </button>
          )}
          {error && (
            <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
