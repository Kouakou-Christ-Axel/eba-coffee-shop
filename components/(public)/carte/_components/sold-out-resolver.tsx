'use client';

// components/(public)/carte/_components/sold-out-resolver.tsx
//
// Panneau « Résoudre » : ouvert quand le serveur refuse la commande parce
// qu'un article s'est épuisé entre l'ajout au panier et la validation
// (409 `SOLD_OUT_TODAY`, voir app/api/commandes/route.ts). Principe : jamais
// un mur, toujours un choix — chaque ligne fautive propose, dans cet ordre :
//   1. REMPLACER (mis en avant : le client garde un retrait aujourd'hui) —
//      2-3 alternatives en stock (`selectReplacementProducts`), ou « Changer
//      de goût » quand seul un goût manque ;
//   2. garder la quantité encore disponible, si le stock n'est que court ;
//   3. retirer la ligne.
// Et, pour tout le panier : « Tout garder, retrait demain ».
//
// Utilisé au checkout, sur le panier (checkout-form.tsx).
//
// Chargé via `next/dynamic` : rien de ce code n'entre dans le chunk initial
// des pages qui l'utilisent.

import { useMemo, useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react';
import { CalendarClock, Check } from 'lucide-react';
import type { CartItem } from '@/lib/cart-store';
import type { SoldOutLine } from '@/lib/schemas/order';
import type { MenuCategory } from '@/config/menu';
import { ResolveRow } from './sold-out/resolve-row';
import type { ReplaceHandler } from './sold-out/types';
import { useMenuWhenOpen } from './sold-out/use-menu-when-open';

export type SoldOutResolverProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Lignes refusées par le serveur (toutes, résolues ou non). */
  lines: SoldOutLine[];
  /** Panier courant : une ligne remplacée/retirée en disparaît, c'est ce qui
   * la marque comme résolue. */
  items: CartItem[];
  onReplace: ReplaceHandler;
  /** Garder la quantité encore en stock — panier uniquement (absent = option
   * non proposée). */
  onReduce?: (cartId: string, quantity: number) => void;
  onRemove: (cartId: string) => void;
  /** Garde les lignes restantes telles quelles, retrait reporté à demain. */
  onDeferAll: (cartIds: string[]) => void;
  /** Renvoie la commande une fois tout résolu. */
  onSubmit?: () => void;
  isSubmitting?: boolean;
  /** Menu déjà chargé par l'appelant (page de commande) : évite une seconde
   * requête. Absent = chargé à l'ouverture. */
  menu?: MenuCategory[] | null;
};

export default function SoldOutResolver({
  isOpen,
  onClose,
  lines,
  items,
  onReplace,
  onReduce,
  onRemove,
  onDeferAll,
  onSubmit,
  isSubmitting = false,
  menu: preloadedMenu,
}: SoldOutResolverProps) {
  const menu = useMenuWhenOpen(isOpen, preloadedMenu);
  // Lignes dont la quantité a été réduite au stock restant : toujours dans
  // le panier, mais réglées.
  const [reduced, setReduced] = useState<Set<string>>(() => new Set());

  const byCartId = useMemo(
    () => new Map(items.map((i) => [i.cartId, i])),
    [items]
  );
  const pending = lines.filter((l) => {
    const item = byCartId.get(l.cartId);
    return item && !item.soldOutToday && !reduced.has(l.cartId);
  });
  const resolved = pending.length === 0;
  const productIdsInCart = items.map((i) => i.productId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="auto"
      size="lg"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          {resolved ? 'C’est réglé' : 'Victime de son succès'}
          <span className="text-sm font-normal text-foreground/60">
            {resolved
              ? 'Ton panier est à jour, tu peux valider ta commande.'
              : `${
                  pending.length > 1
                    ? 'Ces articles viennent d’être épuisés.'
                    : 'Cet article vient d’être épuisé.'
                } Choisis comment continuer — ta commande n’est pas perdue.`}
          </span>
        </ModalHeader>

        <ModalBody className="gap-4">
          {pending.map((line) => {
            const item = byCartId.get(line.cartId)!;
            return (
              <ResolveRow
                key={line.cartId}
                line={line}
                item={item}
                menu={menu}
                productIdsInCart={productIdsInCart}
                onReplace={onReplace}
                onReduce={
                  onReduce
                    ? (qty) => {
                        onReduce(line.cartId, qty);
                        setReduced((prev) => new Set(prev).add(line.cartId));
                      }
                    : undefined
                }
                onRemove={() => onRemove(line.cartId)}
              />
            );
          })}

          {resolved && (
            <p className="flex items-center gap-2 rounded-xl bg-success-50 px-3 py-2.5 text-sm text-success-700">
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              Tout est prêt pour un retrait aujourd’hui.
            </p>
          )}
        </ModalBody>

        <ModalFooter className="flex-col gap-2 sm:flex-col">
          {resolved ? (
            <Button
              color="primary"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
              onPress={onSubmit}
            >
              Valider ma commande
            </Button>
          ) : (
            <Button
              variant="bordered"
              size="lg"
              className="w-full"
              startContent={
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
              }
              onPress={() => onDeferAll(pending.map((l) => l.cartId))}
            >
              Tout garder, retrait à partir de demain
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
