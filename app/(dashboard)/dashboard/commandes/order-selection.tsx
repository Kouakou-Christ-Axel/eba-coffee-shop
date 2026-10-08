'use client';

// Sélection multiple pour l'annulation en masse. Utile pour les commandes
// NEW non encaissées oubliées (ex. DELIVERY jamais réglée ni livrée) : elles
// restent indéfiniment dans la demande en attente (`getPendingDemand`, cf.
// lib/orders/pending-demand.ts) puisqu'aucune tâche de fond ne les nettoie
// (contrairement aux commandes Jèko impayées, qui expirent seules après 15
// min — cf. lib/jeko/expiry.ts). Combiné au filtre existant
// `?status=NEW&payment=unpaid&range=all`, ça permet de les retrouver TOUTES,
// quel que soit leur âge, et de les annuler en une seule fois.

import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { Checkbox } from '@heroui/react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bulkCancelOrdersAction } from './actions';

type SelectionContextValue = {
  selected: Set<string>;
  toggle: (id: string) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function useOrderSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) {
    throw new Error(
      'useOrderSelection doit être utilisé sous OrderSelectionProvider'
    );
  }
  return ctx;
}

/** Case à cocher d'une ligne/carte de commande. */
export function OrderCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useOrderSelection();
  return (
    <Checkbox
      aria-label="Sélectionner cette commande"
      isSelected={selected.has(id)}
      onValueChange={() => toggle(id)}
    />
  );
}

export function OrderSelectionProvider({
  cancellableIds,
  children,
}: {
  /** Commandes de la page courante qui peuvent passer en CANCELLED (tous
   * statuts sauf déjà annulée — cf. matrice `lib/order-permissions.ts`). */
  cancellableIds: string[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === cancellableIds.length ? new Set() : new Set(cancellableIds)
    );
  }

  function handleCancel() {
    if (selected.size === 0) return;
    const count = selected.size;
    if (
      !window.confirm(
        `Annuler ${count} commande${count > 1 ? 's' : ''} ? Cette action est irréversible.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await bulkCancelOrdersAction([...selected]);
      if (result.failed.length > 0) {
        setError(
          `${result.cancelled} annulée(s), ${result.failed.length} en échec (ex. « ${result.failed[0].error} »)`
        );
      }
      setSelected(new Set());
    });
  }

  return (
    <SelectionContext.Provider value={{ selected, toggle }}>
      {cancellableIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-2.5">
          <Checkbox
            aria-label="Tout sélectionner"
            isSelected={
              selected.size > 0 && selected.size === cancellableIds.length
            }
            isIndeterminate={
              selected.size > 0 && selected.size < cancellableIds.length
            }
            onValueChange={toggleAll}
          >
            Tout sélectionner ({cancellableIds.length})
          </Checkbox>
          {selected.size > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={handleCancel}
            >
              {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Annuler la sélection ({selected.size})
            </Button>
          )}
          {error && (
            <span role="alert" className="text-xs text-destructive">
              {error}
            </span>
          )}
        </div>
      )}
      {children}
    </SelectionContext.Provider>
  );
}
