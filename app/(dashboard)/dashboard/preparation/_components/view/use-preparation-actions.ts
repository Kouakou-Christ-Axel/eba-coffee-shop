'use client';

import { useCallback, useState, useTransition } from 'react';
import {
  cancelOrderFromKitchen,
  markOrderReady,
  markOrderRetrieved,
  requestDriver,
  revertOrderRetrieved,
  startPreparation,
} from '../../actions';
import { useUndoToast } from '@/lib/hooks/use-undo-toast';
import { useShortageConfirm } from '../../../_components/use-shortage-confirm';
import { type PreparationOrder } from '@/lib/preparation-queue';

export function usePreparationActions(orders: PreparationOrder[]) {
  const [isPending, startTransition] = useTransition();
  // Masquées optimistiquement (annulation) le temps que le serveur réconcilie via SSE.
  const [optimisticHidden, setOptimisticHidden] = useState<Set<string>>(
    () => new Set()
  );
  // Cartes en cours d'action (spinner + double-clic bloqué), par commande.
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  // Échec d'un lancement (stock, concurrence) : affiché, jamais avalé.
  const [launchError, setLaunchError] = useState<string | null>(null);
  const { confirmShortage, shortageDialog } = useShortageConfirm();
  const { pushUndo } = useUndoToast();

  const setPending = useCallback((id: string, on: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleReady = useCallback(
    (id: string) => {
      setPending(id, true);
      startTransition(async () => {
        try {
          await markOrderReady(id);
        } catch (err) {
          console.error('[preparation] markOrderReady échoué :', err);
        } finally {
          setPending(id, false);
        }
      });
    },
    [setPending]
  );

  const handleRetrieved = useCallback(
    (id: string) => {
      // Le statut précédent (READY, ou PREPARING pour une récupération anticipée) détermine où revenir sur « Annuler ».
      const order = orders.find((o) => o.id === id);
      const previousStatus = order?.status;
      setPending(id, true);
      startTransition(async () => {
        try {
          await markOrderRetrieved(id);
          if (
            order &&
            (previousStatus === 'READY' || previousStatus === 'PREPARING')
          ) {
            pushUndo({
              message: `Commande #${String(order.dailyNumber).padStart(3, '0')} marquée récupérée`,
              onUndo: () => revertOrderRetrieved(id, previousStatus),
            });
          }
        } catch (err) {
          console.error('[preparation] markOrderRetrieved échoué :', err);
        } finally {
          setPending(id, false);
        }
      });
    },
    [setPending, orders, pushUndo]
  );

  // Lance une commande programmée ; en cas de pénurie, propose d'enregistrer la production sur place puis relance.

  const handleStartPreparation = useCallback(
    (id: string) => {
      setPending(id, true);
      startTransition(async () => {
        try {
          let result = await startPreparation(id);
          if (
            result?.shortage?.length &&
            (await confirmShortage(result.shortage))
          ) {
            result = await startPreparation(id, { coverShortage: true });
          }
          setLaunchError(result?.error ?? null);
        } catch (err) {
          setLaunchError(
            err instanceof Error ? err.message : 'Erreur inattendue'
          );
        } finally {
          setPending(id, false);
        }
      });
    },
    [setPending, confirmShortage]
  );

  const handleRequestDriver = useCallback(
    (id: string) => {
      setPending(id, true);
      startTransition(async () => {
        try {
          await requestDriver(id);
        } catch (err) {
          console.error('[preparation] requestDriver échoué :', err);
        } finally {
          setPending(id, false);
        }
      });
    },
    [setPending]
  );

  const handleCancel = useCallback(
    (id: string) => {
      const order = orders.find((o) => o.id === id);
      if (!confirm(`Annuler la commande ${order?.reference ?? ''} ?`)) return;
      setPending(id, true);
      setOptimisticHidden((prev) => new Set(prev).add(id));
      startTransition(async () => {
        try {
          await cancelOrderFromKitchen(id);
        } catch (err) {
          console.error('[preparation] cancelOrderFromKitchen échoué :', err);
        } finally {
          setPending(id, false);
        }
      });
    },
    [orders, setPending]
  );
  return {
    isPending,
    optimisticHidden,
    pendingIds,
    launchError,
    shortageDialog,
    handleReady,
    handleRetrieved,
    handleStartPreparation,
    handleRequestDriver,
    handleCancel,
  };
}
