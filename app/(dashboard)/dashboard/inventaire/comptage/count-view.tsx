'use client';

// Session de comptage : route dédiée (saisie longue, barre d'action fixe).
// Les puces de zone réduisent N : une étagère, on valide, on passe à la suivante.

import { AlertCircle, ClipboardList } from 'lucide-react';

import type { InventoryItemView } from '@/lib/inventory';
import { todayDateString } from '@/lib/timezone';
import { parseCountValue } from '@/lib/inventory-count-draft';
import { Skeleton } from '@/components/ui/skeleton';

import { CountCard } from './_components/count-card';
import { CountBottomBar } from './_components/count-bottom-bar';
import { CountRecapSheet } from './_components/count-recap-sheet';
import { DraftBanner } from './_components/draft-banner';
import { CountToolbar } from './_components/view/count-toolbar';
import { StartPanel } from './_components/view/start-panel';
import { useCountView } from './_components/view/use-count-view';

export function CountView({ items }: { items: InventoryItemView[] }) {
  const view = useCountView(items);
  const {
    isPending,
    hasHydrated,
    draft,
    start,
    setCount,
    filter,
    recapOpen,
    setRecapOpen,
    error,
    inputRefs,
    counts,
    entered,
    sorted,
    visible,
    selectZone,
    selectFilter,
    focusNext,
    handleSubmit,
  } = view;

  if (!hasHydrated) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border p-10 text-center">
        <ClipboardList className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Aucune référence active à compter. Ajoutez d&apos;abord des articles à
          l&apos;inventaire.
        </p>
      </div>
    );
  }

  if (!draft) {
    return (
      <StartPanel
        total={items.length}
        onStart={() =>
          start(
            todayDateString(),
            items.map((it) => it.id)
          )
        }
      />
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <DraftBanner draft={draft} items={items} />

      <CountToolbar view={view} total={items.length} />

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filter === 'todo'
            ? 'Tout est compté dans cette sélection.'
            : 'Aucune référence ne correspond.'}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((item, i) => (
            <CountCard
              key={item.id}
              item={item}
              raw={counts[item.id] ?? ''}
              counted={parseCountValue(counts[item.id])}
              moved={
                draft.systemAt[item.id] !== undefined &&
                draft.systemAt[item.id] !== item.currentQuantity
              }
              onChange={(raw) => setCount(item.id, raw, item.currentQuantity)}
              inputRef={(el) => {
                inputRefs.current[i] = el;
              }}
              onEnter={() => focusNext(i)}
            />
          ))}
        </div>
      )}

      <CountBottomBar
        entered={entered}
        total={items.length}
        disabled={entered === 0 || isPending}
        onValidate={() => setRecapOpen(true)}
      />

      <CountRecapSheet
        open={recapOpen}
        onClose={() => setRecapOpen(false)}
        draft={draft}
        items={sorted}
        isPending={isPending}
        error={error}
        onConfirm={handleSubmit}
        onSeeRemaining={() => {
          setRecapOpen(false);
          selectZone('all');
          selectFilter('todo');
        }}
      />
    </div>
  );
}
