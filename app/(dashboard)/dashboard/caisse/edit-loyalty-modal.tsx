'use client';

// Modale d'application / retrait d'une récompense fidélité sur une commande
// déjà créée (CASHIER_PLUS) — contrairement à la création (`new-order-view`),
// où la récompense ne peut être choisie qu'au moment de la commande. Branche
// `PATCH /api/caisse/orders/:id/loyalty`. Récupère la carte fidélité du
// client de la commande via `GET /api/caisse/loyalty?phone=...` (même route
// que l'écran « Nouvelle commande »).

import { useEffect, useState, useTransition } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch,
} from '@heroui/react';
import { Gift, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { LoyaltyCard } from '@/lib/hooks/use-new-order';

const priceFormatter = new Intl.NumberFormat('fr-FR');

type Props = {
  isOpen: boolean;
  onClose: () => void;
  order: CashierOrder;
};

export function EditLoyaltyModal({ isOpen, onClose, order }: Props) {
  const [loyaltyCard, setLoyaltyCard] = useState<LoyaltyCard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Cadeau (produit/geste offert au comptoir) au lieu d'une réduction en
  // numéraire — cf. `setOrderLoyaltyReward` (lib/order-mutations.ts).
  const [redeemAsGift, setRedeemAsGift] = useState(false);

  useEffect(() => {
    if (!isOpen || !order.customerPhone) return;
    // Chargement déclenché par l'ouverture de la modale (synchronisation avec
    // une source externe, l'API), pas un dérivé d'état recalculable au rendu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);
    const controller = new AbortController();
    fetch(
      `/api/caisse/loyalty?phone=${encodeURIComponent(order.customerPhone)}`,
      {
        signal: controller.signal,
      }
    )
      .then((res) => (res.ok ? res.json() : { card: null }))
      .then((data: { card: LoyaltyCard | null }) => setLoyaltyCard(data.card))
      .catch(() => {
        // Requête annulée ou erreur réseau : pas de carte affichée.
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [isOpen, order.customerPhone]);

  function handleClose() {
    if (isPending) return;
    setError(null);
    setRedeemAsGift(false);
    onClose();
  }

  function submit(loyaltyRewardId: string | null, asGift?: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/caisse/orders/${order.id}/loyalty`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loyaltyRewardId, redeemAsGift: asGift }),
        });
        if (!res.ok) {
          let msg = `Erreur ${res.status}`;
          try {
            const data = (await res.json()) as { error?: string };
            if (typeof data.error === 'string') msg = data.error;
          } catch {
            // ignore
          }
          setError(msg);
          return;
        }
        setRedeemAsGift(false);
        onClose();
      } catch {
        setError('Erreur réseau');
      }
    });
  }

  const isApplied = order.loyaltyRewardId !== null;
  // Un plafond nul en pratique n'existe pas (`capAmount` toujours positif) :
  // une remise à 0 sur une récompense appliquée signale donc un cadeau.
  const isGiftApplied = isApplied && !order.loyaltyDiscount;
  const availableRewards = loyaltyCard?.availableRewards ?? [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      placement="center"
      size="lg"
      scrollBehavior="inside"
      isDismissable={!isPending}
      hideCloseButton={isPending}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-base font-semibold">Récompense fidélité</span>
          <span className="text-sm font-normal text-default-500">
            Commande #{String(order.dailyNumber).padStart(3, '0')}
          </span>
        </ModalHeader>

        <ModalBody className="gap-4">
          {error && (
            <p className="rounded-medium bg-danger-50 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {!order.customerPhone && (
            <p className="text-sm text-default-500">
              Aucun client associé à cette commande — associe d&apos;abord un
              client (téléphone) pour pouvoir appliquer une récompense.
            </p>
          )}

          {isApplied && (
            <div className="flex items-center justify-between rounded-medium border border-amber-300 bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
              <span className="flex items-center gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-100">
                <Gift className="h-4 w-4" />
                {isGiftApplied
                  ? 'Récompense offerte en cadeau (sans réduction)'
                  : `Récompense appliquée · -${priceFormatter.format(order.loyaltyDiscount ?? 0)} F`}
              </span>
              <Button
                type="button"
                size="sm"
                color="danger"
                variant="light"
                startContent={<X className="h-4 w-4" />}
                isDisabled={isPending}
                onPress={() => submit(null)}
              >
                Retirer
              </Button>
            </div>
          )}

          {order.customerPhone && !isApplied && (
            <>
              {isLoading && (
                <p className="text-sm text-default-400">Chargement…</p>
              )}
              {!isLoading && availableRewards.length === 0 && (
                <p className="text-sm text-default-500">
                  Aucune récompense fidélité disponible pour ce client.
                </p>
              )}
              {availableRewards.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-default-600">
                      Offrir en cadeau (sans réduction)
                    </span>
                    <Switch
                      size="sm"
                      isSelected={redeemAsGift}
                      onValueChange={setRedeemAsGift}
                      aria-label="Offrir en cadeau, sans réduction"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableRewards.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        disabled={isPending}
                        onClick={() => submit(r.id, redeemAsGift)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                          'border-amber-300 bg-white text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:bg-transparent dark:text-amber-100'
                        )}
                      >
                        {redeemAsGift
                          ? `Cadeau · ${priceFormatter.format(r.capAmount)} F`
                          : `-${priceFormatter.format(r.capAmount)} F`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </ModalBody>

        <ModalFooter>
          <Button
            type="button"
            variant="flat"
            isDisabled={isPending}
            onPress={handleClose}
          >
            Fermer
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
