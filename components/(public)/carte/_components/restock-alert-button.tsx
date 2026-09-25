'use client';

// components/(public)/carte/_components/restock-alert-button.tsx
//
// « Préviens-moi » : alerte de retour en stock sur un produit (ou un goût)
// épuisé. Rendu seulement quand l'article est épuisé, et chargé en
// `next/dynamic` par ses hôtes (carte produit, panneau « Résoudre ») : la
// carte n'embarque ce code que s'il y a quelque chose d'épuisé à attendre.
// Invisible sur un appareil sans Web Push.

import { Button } from '@heroui/react';
import { BellPlus, BellRing } from 'lucide-react';
import { useRestockAlert } from '@/lib/hooks/use-restock-alert';
import type { RestockAlertTarget } from '@/lib/schemas/push';

export default function RestockAlertButton({
  target,
  className,
  compact = false,
}: {
  target: RestockAlertTarget;
  className?: string;
  /** Libellé court (carte produit, où la place manque). */
  compact?: boolean;
}) {
  const { supported, active, pending, error, toggle } = useRestockAlert(target);
  if (!supported) return null;

  return (
    <div className={className}>
      <Button
        size="sm"
        variant="flat"
        color={active ? 'success' : 'default'}
        className="min-h-8"
        isLoading={pending}
        aria-pressed={active}
        startContent={
          pending ? null : active ? (
            <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <BellPlus className="h-3.5 w-3.5" aria-hidden="true" />
          )
        }
        // La carte produit entière est cliquable (ajout au panier) : le geste
        // ne doit pas remonter jusqu'à elle.
        onClick={(e) => e.stopPropagation()}
        onPress={() => void toggle()}
      >
        {active
          ? 'Alerte activée'
          : compact
            ? 'Préviens-moi'
            : 'Préviens-moi quand c’est de retour'}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
