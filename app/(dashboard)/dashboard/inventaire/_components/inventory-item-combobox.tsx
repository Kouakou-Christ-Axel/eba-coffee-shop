'use client';

// Choix d'une référence d'inventaire.
//
// Remplace un `Select` HeroUI non cherchable posé sur 117 références : ouvrir,
// faire défiler jusqu'à la bonne ligne, taper — soit quatre à six gestes par
// article, et aucun moyen de retrouver « Gobelet 25 cl » autrement qu'à l'œil.
//
// Même structure que `depenses/_components/article-combobox.tsx`, dont on garde
// les deux partis pris : dropdown en `absolute` sans portal (un overlay portalé
// est un piège tactile sur mobile), et liste ouverte dès le focus, sans frappe.
// Pas de branche « créer » ici : une référence d'inventaire a besoin d'un SKU
// généré côté serveur, elle se crée depuis l'onglet Références.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, Search } from 'lucide-react';

import {
  createInventoryItemIndex,
  rankInventoryItems,
  type InventoryItemOption,
} from '@/lib/inventory-item-search';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const MAX_SUGGESTIONS = 8;
const f = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

export function InventoryItemCombobox({
  items,
  onPick,
  usedItemIds,
  placeholder = 'Ajouter une référence…',
  autoFocus,
}: {
  items: InventoryItemOption[];
  onPick: (item: InventoryItemOption) => void;
  /** Déjà dans la saisie : coche discrète, jamais désactivées. */
  usedItemIds?: ReadonlySet<string>;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Indexation O(n) : une fois par catalogue, jamais à chaque frappe.
  const index = useMemo(() => createInventoryItemIndex(items), [items]);
  const suggestions = useMemo(
    () => rankInventoryItems(index, items, query, { limit: MAX_SUGGESTIONS }),
    [index, items, query]
  );

  const activeOption =
    suggestions.length === 0
      ? -1
      : Math.min(activeIndex, suggestions.length - 1);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  function commitAt(position: number) {
    const picked = suggestions[position];
    if (!picked) return;
    onPick(picked);
    setQuery('');
    setActiveIndex(0);
    // Le champ garde le focus : on enchaîne les ajouts sans repasser à la
    // souris ni rouvrir quoi que ce soit.
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (query.length > 0) setQuery('');
      else setOpen(false);
      return;
    }
    if (!open || suggestions.length === 0) {
      if (event.key === 'ArrowDown') setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((activeOption + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(
        activeOption <= 0 ? suggestions.length - 1 : activeOption - 1
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      commitAt(activeOption);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          aria-label="Référence d'inventaire"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
          className="h-11 pl-9"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-card py-1 text-sm shadow-md"
        >
          {suggestions.map((item, i) => (
            <li key={item.id} role="option" aria-selected={i === activeOption}>
              <button
                type="button"
                // onMouseDown : se déclenche avant le blur de l'input.
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitAt(i);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'flex min-h-11 w-full items-center justify-between gap-2 px-3 py-1.5 text-left',
                  i === activeOption && 'bg-accent'
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {usedItemIds?.has(item.id) && (
                    <Check className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                  {item.isLowStock && (
                    <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-destructive">
                      sous le seuil
                    </span>
                  )}
                  <span>
                    {f.format(item.currentQuantity)} {item.unit}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
