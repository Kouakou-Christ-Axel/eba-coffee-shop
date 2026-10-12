'use client';

import { useState, useTransition } from 'react';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { useResettableState } from '@/lib/hooks/use-resettable-state';
import {
  toggleProductAvailabilityAction,
  toggleProductFeaturedAction,
  deleteProductAction,
  restockProductAction,
  moveProductAction,
} from '../../../actions';

export type RowActionsState = ReturnType<typeof useRowActions>;

export function useRowActions({
  id,
  name,
  available,
  featured,
}: {
  id: string;
  name: string;
  available: boolean;
  featured: boolean;
}) {
  const { pushToast } = useUndoToast();
  const [isPending, startTransition] = useTransition();
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [restockDelta, setRestockDelta] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Miroirs optimistes resynchronisés sur la prop (sans `useEffect`) ; en cas
  // d'échec on revient explicitement en arrière.
  const [optimisticAvailable, setOptimisticAvailable] = useResettableState(
    String(available),
    () => available
  );
  const [optimisticFeatured, setOptimisticFeatured] = useResettableState(
    String(featured),
    () => featured
  );

  function toggle(
    next: boolean,
    apply: (updater: (prev: boolean) => boolean) => void,
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    labels: { on: string; off: string }
  ) {
    apply(() => next);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        pushToast(next ? labels.on : labels.off);
        return;
      }
      apply(() => !next);
      pushToast(result.error, 'error');
    });
  }

  function toggleFeatured(next: boolean) {
    toggle(next, setOptimisticFeatured, () => toggleProductFeaturedAction(id), {
      on: `${name} mis en avant`,
      off: `${name} retiré des incontournables`,
    });
  }

  function toggleAvailable(next: boolean) {
    toggle(
      next,
      setOptimisticAvailable,
      () => toggleProductAvailabilityAction(id),
      {
        on: `${name} visible`,
        off: `${name} masqué`,
      }
    );
  }

  function closeRestock() {
    setIsRestockOpen(false);
    setRestockDelta('');
  }

  function handleRestockConfirm() {
    const delta = Number(restockDelta);
    if (!Number.isInteger(delta) || delta <= 0) {
      pushToast('Quantité invalide : entrez un entier positif.', 'error');
      return;
    }
    startTransition(async () => {
      const result = await restockProductAction(id, delta);
      if (!result.ok) {
        pushToast(result.error, 'error');
        return;
      }
      closeRestock();
      pushToast(`${name} : +${delta} en stock`);
    });
  }

  function handleMove(direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await moveProductAction(id, direction);
      if (!result.ok) pushToast(result.error, 'error');
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProductAction(id);
      setConfirmDelete(false);
      pushToast(
        result.ok ? `${name} supprimé` : result.error,
        result.ok ? 'success' : 'error'
      );
    });
  }

  return {
    isPending,
    isRestockOpen,
    setIsRestockOpen,
    restockDelta,
    setRestockDelta,
    confirmDelete,
    setConfirmDelete,
    optimisticAvailable,
    optimisticFeatured,
    toggleFeatured,
    toggleAvailable,
    closeRestock,
    handleRestockConfirm,
    handleMove,
    handleDelete,
  };
}
