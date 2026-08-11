'use client';

// components/(public)/carte/_components/share-product-button.tsx
//
// Partage d'un produit précis. C'est ce bouton qui donne sa raison d'être au
// paramètre `?p=` de la carte : sans lui, personne ne produirait jamais un tel
// lien. À Abidjan le partage se fait sur WhatsApp, donc la feuille de partage
// native du téléphone est le bon canal ; le presse-papiers sert de repli sur
// desktop, où `navigator.share` est rarement disponible.

import { useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { Check, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product } from '@/config/menu';

/** Durée de l'accusé de réception visuel (✓), alignée sur `useQuickAdd`. */
const SHARED_FEEDBACK_MS = 1600;

/** Lien profond vers un produit de la carte. Voir `product-deep-link.tsx`. */
export function buildProductShareUrl(productId: string, origin: string): string {
  return `${origin}/carte?p=${encodeURIComponent(productId)}`;
}

export function ShareProductButton({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const [shared, setShared] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  async function handleShare() {
    const url = buildProductShareUrl(product.id, window.location.origin);

    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, url });
        return;
      } catch {
        // Partage annulé par l'utilisateur, ou refusé par le navigateur : on
        // retombe sur le presse-papiers plutôt que de ne rien faire.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé, permission
      // refusée) : le partage est un bonus, jamais bloquant.
      return;
    }

    setShared(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShared(false), SHARED_FEEDBACK_MS);
  }

  return (
    <Button
      isIconOnly
      size="sm"
      radius="full"
      aria-label={shared ? 'Lien copié' : `Partager ${product.name}`}
      onPress={handleShare}
      className={cn(
        'min-h-9 min-w-9 cursor-pointer bg-white/90 text-foreground shadow-md',
        shared && 'text-success-600',
        className
      )}
    >
      {shared ? (
        <Check className="h-4 w-4" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
    </Button>
  );
}
